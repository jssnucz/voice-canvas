import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../../services/api';
import type { CommandRequest, MultimodalRequest } from '@shared/types';

function makeCommandRequest(): CommandRequest {
  return {
    utterance: '画一个矩形',
    diagramState: {
      mode: 'flowchart',
      elements: [],
      edges: [],
      selectedId: null,
      lastMentionedId: null,
    },
  };
}

function makeMultimodalRequest(): MultimodalRequest {
  return {
    utterance: '把那个红色的变大',
    imageBase64: 'iVBORw0KGgo...',
    diagramState: {
      mode: 'flowchart',
      elements: [],
      edges: [],
      selectedId: null,
      lastMentionedId: null,
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('apiClient.textCommand', () => {
  it('POSTs to /api/command and returns JSON on 200', async () => {
    const mockResponse = { commands: [], voiceReply: '好的' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const result = await apiClient.textCommand(makeCommandRequest(), 'text');

    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith('/api/command', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...makeCommandRequest(), intent: 'text' }),
    }));
  });

  it('throws on non-200 with JSON error body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal error' }),
    } as Response);

    await expect(apiClient.textCommand(makeCommandRequest())).rejects.toThrow('Internal error');
  });

  it('throws generic error when error body cannot be parsed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.reject(new Error('parse error')),
    } as Response);

    await expect(apiClient.textCommand(makeCommandRequest())).rejects.toThrow('Server error: 503');
  });

  it('throws on timeout', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
    );

    await expect(apiClient.textCommand(makeCommandRequest())).rejects.toThrow('请求超时');
  });
});

describe('apiClient.multimodalCommand', () => {
  it('POSTs to /api/multimodal with imageBase64 and returns JSON on 200', async () => {
    const mockResponse = { commands: [{ action: 'update', targets: ['e1'] }] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const req = makeMultimodalRequest();
    const result = await apiClient.multimodalCommand(req);

    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith('/api/multimodal', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }));
  });

  it('throws on non-200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ error: 'Unprocessable' }),
    } as Response);

    await expect(apiClient.multimodalCommand(makeMultimodalRequest())).rejects.toThrow('Unprocessable');
  });
});
