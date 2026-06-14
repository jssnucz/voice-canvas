import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Mock the pool
const mockQuery = vi.fn();
const mockPool = {
  query: mockQuery,
  on: vi.fn(),
  end: vi.fn(),
};

import { buildApp } from '../../index';

let app: FastifyInstance;

beforeEach(async () => {
  vi.clearAllMocks();
  // Pass mock pool — buildApp skips migrate + onClose when pool is provided
  app = await buildApp(mockPool as unknown as Parameters<typeof buildApp>[0]);
  await app.ready();
});

describe('GET /api/diagrams', () => {
  it('returns list of diagrams', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: '1', name: '测试图', mode: 'flowchart', updated_at: '2026-01-01' }],
    });

    const response = await app.inject({ method: 'GET', url: '/api/diagrams' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
  });
});

describe('GET /api/diagrams/:id', () => {
  it('returns 404 for missing diagram', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const response = await app.inject({ method: 'GET', url: '/api/diagrams/nonexistent' });
    expect(response.statusCode).toBe(404);
  });

  it('returns diagram detail on hit', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: '1', name: '我的图', mode: 'flowchart',
        state: { mode: 'flowchart', elements: [], edges: [], selectedId: null, lastMentionedId: null },
        created_at: '2026-01-01', updated_at: '2026-01-02',
      }],
    });
    const response = await app.inject({ method: 'GET', url: '/api/diagrams/1' });
    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe('我的图');
  });
});

describe('POST /api/diagrams', () => {
  it('creates diagram and strips history from state', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'new-1', name: '新图', mode: 'flowchart', state: {}, created_at: 'now', updated_at: 'now' }],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/diagrams',
      payload: {
        name: '新图',
        state: {
          mode: 'flowchart',
          elements: [],
          edges: [],
          selectedId: null,
          lastMentionedId: null,
          history: [{ fake: 'should be stripped' }],
          historyIndex: 5,
        },
      },
    });

    expect(response.statusCode).toBe(201);
    // Verify history was stripped from the INSERT
    const insertCall = mockQuery.mock.calls[0];
    const savedState = JSON.parse(insertCall[1][2]);
    expect(savedState).not.toHaveProperty('history');
    expect(savedState).not.toHaveProperty('historyIndex');
    expect(savedState.mode).toBe('flowchart');
  });
});

describe('PUT /api/diagrams/:id', () => {
  it('returns 404 if diagram not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // exists check
    const response = await app.inject({
      method: 'PUT', url: '/api/diagrams/1', payload: { name: 'x' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('updates and returns diagram', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: '1' }] }); // exists check
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: '1', name: '改名', mode: 'architecture', state: {}, created_at: 'now', updated_at: 'now' }],
    });

    const response = await app.inject({
      method: 'PUT', url: '/api/diagrams/1', payload: { name: '改名' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe('改名');
  });
});

describe('DELETE /api/diagrams/:id', () => {
  it('returns 204', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // delete
    const response = await app.inject({ method: 'DELETE', url: '/api/diagrams/1' });
    expect(response.statusCode).toBe(204);
  });
});
