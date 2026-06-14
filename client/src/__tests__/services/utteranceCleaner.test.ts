import { describe, it, expect } from 'vitest';
import { cleanUtterance, isUtteranceNoise } from '../../services/utteranceCleaner';

describe('cleanUtterance', () => {
  it('strips leading filler words', () => {
    expect(cleanUtterance('嗯画一个矩形')).toBe('画一个矩形');
    expect(cleanUtterance('那个画一个矩形')).toBe('画一个矩形');
    expect(cleanUtterance('就是画一个流程图')).toBe('画一个流程图');
    expect(cleanUtterance('然后把它变红')).toBe('把它变红');
  });

  it('removes standalone filler words', () => {
    expect(cleanUtterance('画一个 那个 矩形')).toBe('画一个 矩形');
    expect(cleanUtterance('这个 判断节点 变红')).toBe('判断节点 变红');
  });

  it('collapses stutter repetitions', () => {
    expect(cleanUtterance('画画画一个矩形')).toBe('画一个矩形');
    expect(cleanUtterance('大大大大一点')).toBe('大一点');
  });

  it('normalizes repeated punctuation', () => {
    expect(cleanUtterance('画矩形，，，然后变红')).toBe('画矩形，然后变红');
    expect(cleanUtterance('完成！！')).toBe('完成！');
  });

  it('handles empty input', () => {
    expect(cleanUtterance('')).toBe('');
    expect(cleanUtterance('   ')).toBe('');
  });

  it('returns empty for pure filler', () => {
    expect(cleanUtterance('嗯 啊 那个 这个')).toBe('');
  });

  it('preserves valid commands', () => {
    expect(cleanUtterance('画一个用户登录的流程图')).toBe('画一个用户登录的流程图');
    expect(cleanUtterance('把判断节点变红，然后变大')).toBe('把判断节点变红，然后变大');
    expect(cleanUtterance('切换到架构图模式')).toBe('切换到架构图模式');
  });
});

// ── Layer 3c: Noise text detection ──

describe('isUtteranceNoise', () => {
  it('detects repeated single characters as noise', () => {
    expect(isUtteranceNoise('哦哦哦')).toBe(true);
    expect(isUtteranceNoise('嗯嗯嗯嗯')).toBe(true);
    expect(isUtteranceNoise('啊啊啊')).toBe(true);
  });

  it('detects pure symbols as noise', () => {
    expect(isUtteranceNoise('123')).toBe(true);
    expect(isUtteranceNoise('...')).toBe(true);
    expect(isUtteranceNoise('！？')).toBe(true);
    expect(isUtteranceNoise('12345 67890')).toBe(true);
  });

  it('detects standalone noise words', () => {
    expect(isUtteranceNoise('嗯')).toBe(true);
    expect(isUtteranceNoise('啊')).toBe(true);
    expect(isUtteranceNoise('嗨')).toBe(true);
  });

  it('detects very short text as noise', () => {
    expect(isUtteranceNoise('a')).toBe(true);
    expect(isUtteranceNoise('我')).toBe(true); // single meaningful char but too short
  });

  it('detects empty/whitespace input as noise', () => {
    expect(isUtteranceNoise('')).toBe(true);
    expect(isUtteranceNoise('   ')).toBe(true);
  });

  it('does NOT flag valid commands as noise', () => {
    expect(isUtteranceNoise('画一个矩形')).toBe(false);
    expect(isUtteranceNoise('连接开始节点和判断节点')).toBe(false);
    expect(isUtteranceNoise('切换到架构图模式')).toBe(false);
    expect(isUtteranceNoise('MCP协议架构图')).toBe(false);
  });

  it('does NOT flag standalone noise words when part of longer text', () => {
    // "喂" is only discarded when alone, not when part of a sentence
    // (But cleanUtterance handles that, not isUtteranceNoise)
    expect(isUtteranceNoise('喂喂喂')).toBe(true); // repeated
    expect(isUtteranceNoise('喂，你好')).toBe(false); // part of sentence
  });
});
