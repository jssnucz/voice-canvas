import { describe, it, expect } from 'vitest';
import { createPool } from '../../db/pool';

describe('createPool', () => {
  it('throws when DATABASE_URL is not set and no argument provided', () => {
    const old = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(() => createPool()).toThrow('DATABASE_URL');
    process.env.DATABASE_URL = old;
  });

  it('uses provided argument over env var', () => {
    const pool = createPool('postgresql://test:test@localhost:5432/testdb');
    expect(pool).toBeDefined();
    expect(pool.options.max).toBe(50);
    expect(pool.options.min).toBe(10);
  });
});
