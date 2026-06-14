import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Mock the pool
const mockQuery = vi.fn();
const mockPool = {
  query: mockQuery,
  on: vi.fn(),
  end: vi.fn(),
};

const { mockCallLLM, mockCallMultimodalLLM } = vi.hoisted(() => ({
  mockCallLLM: vi.fn(),
  mockCallMultimodalLLM: vi.fn(),
}));

vi.mock('../../services/llm', () => ({
  callLLM: mockCallLLM,
  callMultimodalLLM: mockCallMultimodalLLM,
  selectModel: vi.fn(),
  MODEL_CHAT: 'deepseek-v4-pro',
  MODEL_LITE: 'deepseek-v4-flash',
}));

import { buildApp } from '../../index';

let app: FastifyInstance;

beforeEach(async () => {
  vi.clearAllMocks();
  app = await buildApp(mockPool as unknown as Parameters<typeof buildApp>[0]);
  await app.ready();
});

function makeRequestBody(overrides: Record<string, unknown> = {}) {
  return {
    utterance: '把那个红色的菱形变大',
    imageBase64: 'iVBORw0KGgo...',
    diagramState: {
      mode: 'flowchart' as const,
      elements: [],
      edges: [],
      selectedId: null,
      lastMentionedId: null,
    },
    ...overrides,
  };
}

describe('POST /api/multimodal', () => {
  it('returns 200 on successful multimodal call', async () => {
    mockCallMultimodalLLM.mockResolvedValueOnce(
      JSON.stringify({
        commands: [{ action: 'update', targets: ['elem_1'], payload: { elements: [{ size: { width: 200, height: 100 } }] } }],
        voiceReply: '已将红色菱形放大',
      })
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/multimodal',
      payload: makeRequestBody(),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.commands).toHaveLength(1);
    expect(body.commands[0].action).toBe('update');
    expect(body.voiceReply).toBe('已将红色菱形放大');
  });

  it('injects visual instruction into system prompt', async () => {
    mockCallMultimodalLLM.mockResolvedValueOnce(JSON.stringify({ commands: [] }));

    await app.inject({
      method: 'POST',
      url: '/api/multimodal',
      payload: makeRequestBody(),
    });

    const systemPrompt: string = mockCallMultimodalLLM.mock.calls[0][0].systemPrompt;
    expect(systemPrompt).toContain('多模态视觉定位');
  });

  it('uses MODEL_CHAT for multimodal call', async () => {
    mockCallMultimodalLLM.mockResolvedValueOnce(JSON.stringify({ commands: [] }));

    await app.inject({
      method: 'POST',
      url: '/api/multimodal',
      payload: makeRequestBody(),
    });

    expect(mockCallMultimodalLLM).toHaveBeenCalledOnce();
    expect(mockCallMultimodalLLM.mock.calls[0][0].model).toBe('deepseek-v4-pro');
  });

  it('falls back to text-only on multimodal failure', async () => {
    mockCallMultimodalLLM
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error again'));
    mockCallLLM.mockResolvedValueOnce(
      JSON.stringify({ commands: [{ action: 'query', targets: ['elem_1'] }], voiceReply: '视觉定位失败，已根据文本上下文推测。' })
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/multimodal',
      payload: makeRequestBody(),
    });

    expect(response.statusCode).toBe(200);
    expect(mockCallMultimodalLLM).toHaveBeenCalledTimes(2);
    expect(mockCallLLM).toHaveBeenCalledOnce();
    expect(mockCallLLM.mock.calls[0][0].model).toBe('deepseek-v4-flash');
  });

  it('returns 422 when both multimodal and text fallback fail', async () => {
    mockCallMultimodalLLM
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error again'));
    mockCallLLM.mockRejectedValueOnce(new Error('Text fallback failed'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/multimodal',
      payload: makeRequestBody(),
    });

    expect(response.statusCode).toBe(422);
    const body = response.json();
    expect(body.error).toContain('视觉定位和文本消解均失败');
  });
});
