import { describe, it, expect } from 'vitest';
import { cleanUtterance } from '../../services/utteranceCleaner';

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
