import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock OpenAI before importing the module under test
const mockCreate = vi.hoisted(() => vi.fn());
vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: {
      completions: { create: mockCreate },
    },
  })),
}));

import { selectModel, callLLM, callMultimodalLLM, MODEL_CHAT, MODEL_LITE } from '../../services/llm';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('selectModel', () => {
  it('returns MODEL_CHAT for visual intent', () => {
    expect(selectModel('visual')).toBe(MODEL_CHAT);
  });

  it('returns MODEL_CHAT for generate intent', () => {
    expect(selectModel('generate')).toBe(MODEL_CHAT);
  });

  it('returns MODEL_LITE for text intent', () => {
    expect(selectModel('text')).toBe(MODEL_LITE);
  });

  it('returns MODEL_LITE for query intent', () => {
    expect(selectModel('query')).toBe(MODEL_LITE);
  });
});

describe('callLLM', () => {
  it('forwards parameters to OpenAI client and returns content', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"commands":[]}' } }],
    });

    const result = await callLLM({
      model: MODEL_CHAT,
      systemPrompt: 'You are a diagram assistant.',
      userMessage: 'Draw a flowchart',
      temperature: 0.5,
      maxTokens: 2048,
    });

    expect(result).toBe('{"commands":[]}');
    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe(MODEL_CHAT);
    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.messages[0]).toEqual({ role: 'system', content: 'You are a diagram assistant.' });
    expect(callArgs.messages[1]).toEqual({ role: 'user', content: 'Draw a flowchart' });
    expect(callArgs.temperature).toBe(0.5);
    expect(callArgs.max_tokens).toBe(2048);
  });

  it('throws when LLM returns empty content', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '' } }],
    });

    await expect(
      callLLM({
        model: MODEL_LITE,
        systemPrompt: '',
        userMessage: '',
      })
    ).rejects.toThrow('LLM returned empty response');
  });

  it('sets response_format to json_object when specified', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{}' } }],
    });

    await callLLM({
      model: MODEL_LITE,
      systemPrompt: '',
      userMessage: '',
      responseFormat: 'json_object',
    });

    expect(mockCreate.mock.calls[0][0].response_format).toEqual({ type: 'json_object' });
  });

  it('does not set response_format when not json_object', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'plain text' } }],
    });

    await callLLM({
      model: MODEL_LITE,
      systemPrompt: '',
      userMessage: '',
      responseFormat: 'text',
    });

    expect(mockCreate.mock.calls[0][0].response_format).toBeUndefined();
  });
});

describe('callMultimodalLLM', () => {
  it('forwards parameters including imageBase64 and returns content', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"commands":[{"action":"update","targets":["elem_1"]}]}' } }],
    });

    const result = await callMultimodalLLM({
      model: MODEL_CHAT,
      systemPrompt: 'Analyze the canvas.',
      userMessage: 'Make the red diamond bigger',
      imageBase64: 'iVBORw0KGgo...',
      temperature: 0.2,
      maxTokens: 4096,
    });

    expect(result).toContain('"action":"update"');
    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe(MODEL_CHAT);
    expect(callArgs.messages[1].content).toHaveLength(2);
    expect(callArgs.messages[1].content[0]).toEqual({ type: 'text', text: 'Make the red diamond bigger' });
    expect(callArgs.messages[1].content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,iVBORw0KGgo...' },
    });
    expect(callArgs.temperature).toBe(0.2);
    expect(callArgs.max_tokens).toBe(4096);
  });

  it('always uses response_format json_object for multimodal calls', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"commands":[]}' } }],
    });

    await callMultimodalLLM({
      model: MODEL_CHAT,
      systemPrompt: '',
      userMessage: '',
      imageBase64: 'abc',
    });

    expect(mockCreate.mock.calls[0][0].response_format).toEqual({ type: 'json_object' });
  });

  it('throws when multimodal LLM returns empty content', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '' } }],
    });

    await expect(
      callMultimodalLLM({
        model: MODEL_CHAT,
        systemPrompt: '',
        userMessage: '',
        imageBase64: '',
      })
    ).rejects.toThrow('LLM returned empty response');
  });
});
