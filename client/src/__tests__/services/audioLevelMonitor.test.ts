import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// jsdom doesn't have MediaStream — provide a minimal mock
class MockMediaStream {
  private _active = true;
  get active() { return this._active; }
  getTracks() { return []; }
  // Stub: tracks aren't used by AudioLevelMonitor beyond existence check
}
vi.stubGlobal('MediaStream', MockMediaStream);

// Mock Web Audio API before importing the module under test
const mockAnalyserData = new Uint8Array(128).fill(128); // All samples at DC offset = silence

const mockAnalyser = {
  fftSize: 256,
  getByteTimeDomainData: vi.fn((buffer: Uint8Array) => {
    buffer.set(mockAnalyserData);
  }),
  connect: vi.fn(),
  disconnect: vi.fn(),
  smoothingTimeConstant: 0.4,
};

const mockSource = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockAudioCtx = {
  createAnalyser: vi.fn(() => mockAnalyser),
  createMediaStreamSource: vi.fn(() => mockSource),
  close: vi.fn(() => Promise.resolve()),
  suspend: vi.fn(() => Promise.resolve()),
  resume: vi.fn(() => Promise.resolve()),
  state: 'running',
};

// Mock requestAnimationFrame — recursive: each call re-registers the callback
let rafCallback: (() => void) | null = null;
let fakeTime = 0;

vi.stubGlobal('AudioContext', vi.fn(() => mockAudioCtx));
vi.stubGlobal('requestAnimationFrame', vi.fn((cb: () => void) => {
  rafCallback = cb;
  return 1;
}));
vi.stubGlobal('cancelAnimationFrame', vi.fn(() => { rafCallback = null; }));
// Mock performance.now with incrementing counter (avoids same-ms issue)
vi.stubGlobal('performance', { now: () => { const t = fakeTime; fakeTime += 100; return t; } });

/** Fire N RAF ticks, re-registering the callback each time (simulating real RAF loop) */
function tick(n = 1) {
  for (let i = 0; i < n; i++) {
    const cb = rafCallback;
    if (cb) cb(); // cb calls requestAnimationFrame again, re-setting rafCallback
  }
}

// Mock document/window lifecycle events
const listeners: Record<string, (() => void)[]> = {};
vi.stubGlobal('document', {
  hidden: false,
  addEventListener: vi.fn((event: string, handler: () => void) => {
    (listeners[event] ??= []).push(handler);
  }),
  removeEventListener: vi.fn((event: string, handler: () => void) => {
    listeners[event] = listeners[event]?.filter(h => h !== handler) ?? [];
  }),
});
vi.stubGlobal('window', {
  addEventListener: vi.fn((event: string, handler: () => void) => {
    (listeners[event] ??= []).push(handler);
  }),
  removeEventListener: vi.fn((event: string, handler: () => void) => {
    listeners[event] = listeners[event]?.filter(h => h !== handler) ?? [];
  }),
});

import { AudioLevelMonitor, createNoopMonitor } from '../../services/audioLevelMonitor';

describe('AudioLevelMonitor', () => {
  let stream: MediaStream;

  beforeEach(() => {
    stream = new MediaStream();
    vi.clearAllMocks();
    mockAnalyserData.fill(128); // Reset to silence
    Object.keys(listeners).forEach(k => delete listeners[k]);
  });

  afterEach(() => {
    rafCallback = null;
  });

  it('creates successfully with a MediaStream', () => {
    const monitor = new AudioLevelMonitor(stream);
    expect(monitor.isAvailable).toBe(true);
    expect(mockAudioCtx.createAnalyser).toHaveBeenCalled();
    expect(mockAudioCtx.createMediaStreamSource).toHaveBeenCalledWith(stream);
    monitor.destroy();
  });

  it('starts in silence state', () => {
    const monitor = new AudioLevelMonitor(stream);
    expect(monitor.state).toBe('silence');
    monitor.destroy();
  });

  it('computes correct RMS: silence → ~0', () => {
    // All samples at 128 (DC offset) → RMS ≈ 0
    const onLevel = vi.fn();
    const monitor = new AudioLevelMonitor(stream, { onLevel });
    monitor.start();

    // Fire one sampling tick
    tick();
    tick(); // Second tick to build history

    // Should report very low level for silence
    expect(onLevel).toHaveBeenCalled();
    const calls = onLevel.mock.calls;
    const levels = calls.map((c: [number, string]) => c[0]);
    // All levels should be near 0 for pure DC offset
    for (const level of levels) {
      expect(level).toBeLessThanOrEqual(2); // RMS of DC-only signal ≈ 0
    }
    monitor.destroy();
  });

  it('computes correct RMS: max signal → ~100', () => {
    // Fill with max amplitude sine wave: alternating 0 and 255
    // (0-128)*(0-128) = 16384, (255-128)*(255-128) = 16129
    // RMS ≈ sqrt((16384+16129)/2) ≈ 127.5 → 127.5/128*100 ≈ 99.6
    for (let i = 0; i < mockAnalyserData.length; i++) {
      mockAnalyserData[i] = i % 2 === 0 ? 0 : 255;
    }

    const onLevel = vi.fn();
    const monitor = new AudioLevelMonitor(stream, { onLevel });
    monitor.start();

    tick();
    tick();

    const calls = onLevel.mock.calls;
    const levels = calls.map((c: [number, string]) => c[0]);
    // Should be near 100 for max amplitude
    for (const level of levels) {
      expect(level).toBeGreaterThanOrEqual(90); // RMS of max signal ≈ 99.6
    }
    monitor.destroy();
  });

  it('classifies state correctly: silence → noise → speech', () => {
    const onSpeechDetected = vi.fn();
    const monitor = new AudioLevelMonitor(stream, { onSpeechDetected }, {
      silenceThreshold: 5,
      speechThreshold: 20,
      smoothingWindow: 2, // small window for fast test
    });
    monitor.start();

    // Phase 1: silence (all 128)
    mockAnalyserData.fill(128);
    tick(5);
    expect(monitor.state).toBe('silence');

    // Phase 2: noise (RMS ≈ 15)
    // Approx: 128+15 = 143 for all samples → RMS=15
    mockAnalyserData.fill(143);
    tick(5);
    expect(monitor.state).toBe('noise');
    expect(onSpeechDetected).not.toHaveBeenCalled(); // noise ≠ speech

    // Phase 3: speech (RMS ≈ 30)
    mockAnalyserData.fill(158); // 128+30
    tick(5);
    expect(monitor.state).toBe('speech');
    expect(onSpeechDetected).toHaveBeenCalledTimes(1);

    monitor.destroy();
  });

  it('fires onSilence after sustained silence', () => {
    const onSilence = vi.fn();
    const monitor = new AudioLevelMonitor(stream, { onSilence }, {
      silenceWindowCount: 3, // 3 windows of silence → trigger
    });
    monitor.start();

    mockAnalyserData.fill(128); // Silence
    tick(); // count 1
    tick(); // count 2
    tick(); // count 3 → should fire

    expect(onSilence).toHaveBeenCalledTimes(1);
    const duration = onSilence.mock.calls[0][0];
    expect(duration).toBeGreaterThan(0);
    monitor.destroy();
  });

  it('median filter resists impulse noise', () => {
    const onLevel = vi.fn();
    const monitor = new AudioLevelMonitor(stream, { onLevel }, {
      smoothingWindow: 5,
      sampleIntervalMs: 0, // sample every tick
    });
    monitor.start();

    // Build baseline: silence
    mockAnalyserData.fill(128);
    tick(6);

    // Single impulse (keyboard click)
    mockAnalyserData.fill(255);
    tick();

    // Back to silence
    mockAnalyserData.fill(128);
    tick(5);

    // With median filter (window=5), a single impulse surrounded by silence
    // should be completely filtered to 0. All calls should report low level.
    const calls = onLevel.mock.calls;
    for (const [level] of calls) {
      // Raw impulse would be ~100; median-smoothed should be ≤ 20
      expect(level).toBeLessThanOrEqual(20);
    }
    // The monitor should never transition to 'speech' from a single impulse
    expect(monitor.state).toBe('silence');
    monitor.destroy();
  });

  it('stop() pauses monitoring', () => {
    const onLevel = vi.fn();
    const monitor = new AudioLevelMonitor(stream, { onLevel });
    monitor.start();
    tick();
    expect(onLevel).toHaveBeenCalled();

    monitor.stop();
    const callCountAfterStop = onLevel.mock.calls.length;
    tick();
    // No new calls after stop
    expect(onLevel.mock.calls.length).toBe(callCountAfterStop);
    monitor.destroy();
  });

  it('destroy() releases all resources', () => {
    const monitor = new AudioLevelMonitor(stream);
    monitor.start();
    monitor.destroy();

    expect(monitor.isAvailable).toBe(false);
    expect(mockAudioCtx.close).toHaveBeenCalled();
  });

  it('registers visibilitychange and pagehide listeners', () => {
    const monitor = new AudioLevelMonitor(stream);
    expect(document.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('pagehide', expect.any(Function));
    monitor.destroy();
  });

  it('createNoopMonitor produces a safe fallback (no callbacks, no crash)', () => {
    const monitor = createNoopMonitor();
    // In mock env with stubbed AudioContext this may be available;
    // in real browsers without AudioContext it returns unavailable.
    // Either way, start/stop/destroy must not throw.
    expect(() => {
      monitor.start();
      tick(5);
      monitor.stop();
      monitor.destroy();
    }).not.toThrow();
  });
});
