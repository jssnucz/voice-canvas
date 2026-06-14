/**
 * Real-time audio level monitoring for noise-gated speech recognition.
 *
 * Uses AudioContext + AnalyserNode to measure mic input volume via RMS
 * (Root Mean Square) with correct DC-offset removal. Drives a state machine
 * that classifies each ~100ms window as silence / noise / speech.
 *
 * getByteTimeDomainData() returns 0-255 unsigned bytes centered at 128.
 * Corrected RMS = sqrt(Σ((sample - 128)²) / N), normalised to 0-100%.
 */

export type NoiseState = 'silence' | 'noise' | 'speech';
export type NoiseLevel = 'low' | 'medium' | 'high';

export interface AudioLevelMonitorOptions {
  /** RMS percentage above which we consider the window "speech" (default 20) */
  speechThreshold?: number;
  /** RMS percentage below which we consider the window "silence" (default 5) */
  silenceThreshold?: number;
  /** Consecutive silence windows before firing onSilence (default 30 ≈ 3s @100ms) */
  silenceWindowCount?: number;
  /** How many recent samples to keep for median filtering (default 10) */
  smoothingWindow?: number;
  /** Sampling interval in ms (default 100) */
  sampleIntervalMs?: number;
}

export interface AudioLevelCallbacks {
  onLevel?: (level: number, state: NoiseState) => void;
  onSpeechDetected?: () => void;
  onSilence?: (durationMs: number) => void;
  onNoiseLevelChange?: (level: NoiseLevel) => void;
}

export class AudioLevelMonitor {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private rafId: number | null = null;
  private lastSampleTime = 0;

  // Configuration
  private readonly speechThreshold: number;
  private readonly silenceThreshold: number;
  private readonly silenceWindowCount: number;
  private readonly smoothingWindow: number;
  private readonly sampleIntervalMs: number;

  // State
  private history: number[] = [];
  private currentState: NoiseState = 'silence';
  private silenceCounter = 0;
  private silenceStartTime = 0;
  private noiseLevel: NoiseLevel = 'low';
  private callbacks: AudioLevelCallbacks;
  private destroyed = false;

  // Bound event handlers (for proper removal)
  private onVisibilityChange: (() => void) | null = null;
  private onPageHide: (() => void) | null = null;

  constructor(
    stream: MediaStream,
    callbacks: AudioLevelCallbacks = {},
    options: AudioLevelMonitorOptions = {}
  ) {
    this.callbacks = callbacks;
    this.speechThreshold = options.speechThreshold ?? 20;
    this.silenceThreshold = options.silenceThreshold ?? 5;
    this.silenceWindowCount = options.silenceWindowCount ?? 30; // 3s @100ms
    this.smoothingWindow = options.smoothingWindow ?? 10;
    this.sampleIntervalMs = options.sampleIntervalMs ?? 100;

    try {
      this.audioCtx = new AudioContext();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256; // 128 time-domain samples
      this.analyser.smoothingTimeConstant = 0.4;

      this.source = this.audioCtx.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
      // Do NOT connect to destination — we only analyse, never play back

      this.stream = stream;
    } catch (err) {
      console.warn('[AudioLevelMonitor] AudioContext setup failed, monitor disabled:', err);
      // Leave all fields null — isAvailable() returns false, all public methods are no-ops
      return;
    }

    this.registerLifecycleListeners();
  }

  // ---- Public API ----

  get isAvailable(): boolean {
    return this.audioCtx !== null && this.analyser !== null && !this.destroyed;
  }

  get state(): NoiseState {
    return this.currentState;
  }

  get environmentalNoise(): NoiseLevel {
    return this.noiseLevel;
  }

  start(): void {
    if (!this.isAvailable) return;
    this.lastSampleTime = performance.now();
    this.loop();
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.history = [];
    this.silenceCounter = 0;
    this.currentState = 'silence';
  }

  destroy(): void {
    this.stop();
    this.removeLifecycleListeners();
    this.source?.disconnect();
    this.analyser?.disconnect();
    // Close AudioContext if not already closed by pagehide handler
    if (this.audioCtx?.state !== 'closed') {
      this.audioCtx?.close().catch(() => {});
    }
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.destroyed = true;
  }

  // ---- Private: main sampling loop ----

  private loop = (): void => {
    if (this.destroyed || !this.isAvailable) return;

    const now = performance.now();
    if (now - this.lastSampleTime >= this.sampleIntervalMs) {
      this.lastSampleTime = now;
      this.sample();
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private sample(): void {
    if (!this.analyser) return;

    const buffer = new Uint8Array(this.analyser.fftSize / 2); // 128 samples
    this.analyser.getByteTimeDomainData(buffer);

    // Corrected RMS: subtract DC offset of 128
    // formula: sqrt(Σ((sample - 128)²) / N) / 128 * 100
    let sumSquared = 0;
    for (let i = 0; i < buffer.length; i++) {
      const centered = buffer[i] - 128;
      sumSquared += centered * centered;
    }
    const rms = Math.sqrt(sumSquared / buffer.length);
    const level = Math.min(100, Math.round((rms / 128) * 100));

    // Median-filtered sliding window (impulse-noise resistant)
    this.history.push(level);
    if (this.history.length > this.smoothingWindow) {
      this.history.shift();
    }
    const smoothed = this.median(this.history);

    // State classification
    const prevState = this.currentState;
    let newState: NoiseState;

    if (smoothed < this.silenceThreshold) {
      newState = 'silence';
      this.silenceCounter++;
      if (this.silenceCounter === 1) {
        this.silenceStartTime = performance.now();
      }
    } else if (smoothed < this.speechThreshold) {
      newState = 'noise';
      this.silenceCounter = 0;
    } else {
      newState = 'speech';
      this.silenceCounter = 0;
    }

    // State transitions
    if (newState !== prevState) {
      this.currentState = newState;
      if (newState === 'speech') {
        this.callbacks.onSpeechDetected?.();
      }
    }

    // Silence duration callback
    if (
      newState === 'silence' &&
      this.silenceCounter === this.silenceWindowCount
    ) {
      const duration = performance.now() - this.silenceStartTime;
      this.callbacks.onSilence?.(duration);
    }

    // Background noise level (based on RMS during non-speech periods)
    if (newState !== 'speech') {
      const newNoiseLevel: NoiseLevel =
        smoothed < 5 ? 'low' : smoothed < 15 ? 'medium' : 'high';
      if (newNoiseLevel !== this.noiseLevel) {
        this.noiseLevel = newNoiseLevel;
        this.callbacks.onNoiseLevelChange?.(newNoiseLevel);
      }
    }

    // Per-sample level callback
    this.callbacks.onLevel?.(smoothed, newState);
  }

  private median(sorted: number[]): number {
    if (sorted.length === 0) return 0;
    const copy = [...sorted].sort((a, b) => a - b);
    const mid = Math.floor(copy.length / 2);
    return copy.length % 2 === 1
      ? copy[mid]
      : Math.round((copy[mid - 1] + copy[mid]) / 2);
  }

  // ---- Lifecycle: handle background tab AudioContext suspension ----

  private registerLifecycleListeners(): void {
    this.onVisibilityChange = () => {
      if (!this.audioCtx) return;
      if (document.hidden) {
        this.audioCtx.suspend().catch(() => {});
      } else {
        this.audioCtx.resume().catch(() => {});
      }
    };

    this.onPageHide = () => {
      // Page is being unloaded — close AudioContext to free resources
      this.audioCtx?.close().catch(() => {});
      this.audioCtx = null;
    };

    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.onPageHide);
  }

  private removeLifecycleListeners(): void {
    if (this.onVisibilityChange) {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (this.onPageHide) {
      window.removeEventListener('pagehide', this.onPageHide);
    }
  }
}

// ---- Noop fallback for environments without AudioContext ----

export function createNoopMonitor(): AudioLevelMonitor {
  return new AudioLevelMonitor(
    new MediaStream(), // dummy — never connected because AudioContext creation will fail
    {},
    {}
  );
}
