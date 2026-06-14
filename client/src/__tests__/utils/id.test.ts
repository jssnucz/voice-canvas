import { describe, it, expect } from 'vitest';
import { generateId } from '../../utils/id';

describe('generateId', () => {
  it('returns a string matching elem_<timestamp>_<counter> format', () => {
    const id = generateId();
    expect(id).toMatch(/^elem_\d+_\d+$/);
  });

  it('increments counter with each call', () => {
    const id1 = generateId();
    const id2 = generateId();

    const counter1 = Number(id1.split('_')[2]);
    const counter2 = Number(id2.split('_')[2]);
    expect(counter2).toBe(counter1 + 1);
  });

  it('has timestamp part close to current time', () => {
    const before = Date.now();
    const id = generateId();
    const after = Date.now();

    const ts = Number(id.split('_')[1]);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('produces unique values over many calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});
