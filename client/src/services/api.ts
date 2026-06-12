import type { CommandRequest, MultimodalRequest, LLMResponse } from '@shared/types';

const BASE_URL = '/api';

export const apiClient = {
  async textCommand(req: CommandRequest, intent: string = 'text'): Promise<LLMResponse> {
    const res = await fetch(`${BASE_URL}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...req, intent }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Server error: ${res.status}` }));
      throw new Error(err.error || `Server error: ${res.status}`);
    }
    return res.json();
  },

  async multimodalCommand(req: MultimodalRequest): Promise<LLMResponse> {
    const res = await fetch(`${BASE_URL}/multimodal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Server error: ${res.status}` }));
      throw new Error(err.error || `Server error: ${res.status}`);
    }
    return res.json();
  },
};
