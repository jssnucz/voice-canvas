import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Mock the llm module — vi.hoisted ensures these are initialized before vi.mock factory runs
const { mockCallLLM, mockSelectModel } = vi.hoisted(() => ({
  mockCallLLM: vi.fn(),
  mockSelectModel: vi.fn(),
}));

vi.mock('../../services/llm', () => ({
  callLLM: mockCallLLM,
  selectModel: mockSelectModel,
  callMultimodalLLM: vi.fn(),
  MODEL_CHAT: 'deepseek-v4-pro',
  MODEL_LITE: 'deepseek-v4-flash',
}));

import { buildApp } from '../../index';

let app: FastifyInstance;

beforeEach(async () => {
  vi.clearAllMocks();
  app = await buildApp();
  await app.ready();
});

function makeRequestBody(overrides: Record<string, unknown> = {}) {
  return {
    utterance: '画一个矩形',
    diagramState: {
      mode: 'flowchart' as const,
      elements: [],
      edges: [],
      selectedId: null,
      lastMentionedId: null,
    },
    intent: 'text',
    ...overrides,
  };
}

describe('POST /api/command', () => {
  it('returns 200 with commands and voiceReply on success', async () => {
    mockSelectModel.mockReturnValue('deepseek-v4-flash');
    mockCallLLM.mockResolvedValueOnce(
      JSON.stringify({
        commands: [{ action: 'create', targets: [], payload: { elements: [{ type: 'rect', label: '矩形' }] } }],
        voiceReply: '已添加矩形',
      })
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/command',
      payload: makeRequestBody(),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.commands).toHaveLength(1);
    expect(body.commands[0].action).toBe('create');
    expect(body.voiceReply).toBe('已添加矩形');
  });

  it('passes intent to selectModel', async () => {
    mockSelectModel.mockReturnValue('deepseek-v4-pro');
    mockCallLLM.mockResolvedValueOnce(JSON.stringify({ commands: [] }));

    await app.inject({
      method: 'POST',
      url: '/api/command',
      payload: makeRequestBody({ intent: 'generate' }),
    });

    expect(mockSelectModel).toHaveBeenCalledWith('generate');
  });

  it('injects "查询模式" into system prompt for query intent', async () => {
    mockSelectModel.mockReturnValue('deepseek-v4-flash');
    mockCallLLM.mockResolvedValueOnce(JSON.stringify({ commands: [] }));

    await app.inject({
      method: 'POST',
      url: '/api/command',
      payload: makeRequestBody({ intent: 'query' }),
    });

    const systemPrompt: string = mockCallLLM.mock.calls[0][0].systemPrompt;
    expect(systemPrompt).toContain('查询模式');
  });

  it('injects DIAGRAM_TYPE_PROMPTS for architecture mode', async () => {
    mockSelectModel.mockReturnValue('deepseek-v4-flash');
    mockCallLLM.mockResolvedValueOnce(JSON.stringify({ commands: [] }));

    await app.inject({
      method: 'POST',
      url: '/api/command',
      payload: makeRequestBody({
        diagramState: { ...makeRequestBody().diagramState, mode: 'architecture' },
      }),
    });

    const systemPrompt: string = mockCallLLM.mock.calls[0][0].systemPrompt;
    expect(systemPrompt.length).toBeGreaterThan(100);
  });

  it('does not retry on JSON parse failure (SyntaxError)', async () => {
    mockSelectModel.mockReturnValue('deepseek-v4-flash');
    mockCallLLM.mockResolvedValueOnce('not valid json {{{');

    const response = await app.inject({
      method: 'POST',
      url: '/api/command',
      payload: makeRequestBody(),
    });

    expect(response.statusCode).toBe(422);
    expect(mockCallLLM).toHaveBeenCalledTimes(1);
  });

  it('does not retry on Zod validation failure', async () => {
    mockSelectModel.mockReturnValue('deepseek-v4-flash');
    mockCallLLM.mockResolvedValueOnce(
      JSON.stringify({ commands: [{ action: 'INVALID_ACTION', targets: [] }], voiceReply: null })
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/command',
      payload: makeRequestBody(),
    });

    expect(response.statusCode).toBe(422);
    expect(mockCallLLM).toHaveBeenCalledTimes(1);
  });

  it('retries once on network error then returns 422', async () => {
    mockSelectModel.mockReturnValue('deepseek-v4-flash');
    mockCallLLM
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error again'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/command',
      payload: makeRequestBody(),
    });

    expect(response.statusCode).toBe(422);
    expect(mockCallLLM).toHaveBeenCalledTimes(2);
    const body = response.json();
    expect(body.error).toContain('指令解析失败');
  });

  it('omits voiceReply from response when LLM returns null', async () => {
    mockSelectModel.mockReturnValue('deepseek-v4-flash');
    mockCallLLM.mockResolvedValueOnce(
      JSON.stringify({ commands: [], voiceReply: null })
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/command',
      payload: makeRequestBody(),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).not.toHaveProperty('voiceReply');
  });
});
