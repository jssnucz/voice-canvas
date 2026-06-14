import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockUtteranceInstance = { lang: '', rate: 0, text: '' };
const MockUtterance = vi.fn(function (this: typeof mockUtteranceInstance, text: string) {
  this.text = text;
  this.lang = '';
  this.rate = 0;
  return this;
}) as unknown as typeof SpeechSynthesisUtterance;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);

  const mockSpeechSynthesis = {
    speak: vi.fn(),
    cancel: vi.fn(),
  };
  vi.stubGlobal('speechSynthesis', mockSpeechSynthesis);
  Object.defineProperty(window, 'speechSynthesis', {
    value: mockSpeechSynthesis,
    writable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

import { speak } from '../../services/speechSynthesis';

describe('speak', () => {
  it('creates SpeechSynthesisUtterance with text, zh-CN, rate 1.0', () => {
    speak('你好');

    expect(MockUtterance).toHaveBeenCalledWith('你好');
    const instance = (MockUtterance as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(instance.lang).toBe('zh-CN');
    expect(instance.rate).toBe(1.0);
  });

  it('calls speechSynthesis.cancel before speaking', () => {
    speak('hello');

    const synthesis = window.speechSynthesis as unknown as { cancel: ReturnType<typeof vi.fn>; speak: ReturnType<typeof vi.fn> };
    const cancelOrder = synthesis.cancel.mock.invocationCallOrder[0];
    const speakOrder = synthesis.speak.mock.invocationCallOrder[0];
    expect(cancelOrder).toBeLessThan(speakOrder);
  });

  it('calls speechSynthesis.speak with the utterance', () => {
    speak('测试');

    const instance = (MockUtterance as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(window.speechSynthesis.speak).toHaveBeenCalledWith(instance);
  });

  it('does not throw when speechSynthesis is unavailable', () => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, writable: true });

    expect(() => speak('should not crash')).not.toThrow();
  });
});
