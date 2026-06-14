import type { CommandRequest, MultimodalRequest, LLMResponse, DiagramListItem, DiagramDetail, CreateDiagramBody, UpdateDiagramBody } from '@shared/types';

const BASE_URL = '/api';

interface RequestOptions extends RequestInit {
  /** Timeout in milliseconds (default: 10000) */
  timeoutMs?: number;
}

async function request<T>(url: string, options?: RequestOptions): Promise<T> {
  const { timeoutMs = 10000, ...fetchOptions } = options ?? {};

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}${url}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...fetchOptions,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Server error: ${res.status}` }));
      throw new Error(err.error || `Server error: ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`请求超时 (${timeoutMs / 1000}s)`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const apiClient = {
  /** LLM text/generate/query — 30s timeout (LLM inference can be slow) */
  async textCommand(req: CommandRequest, intent: string = 'text'): Promise<LLMResponse> {
    return request('/command', {
      method: 'POST',
      body: JSON.stringify({ ...req, intent }),
      timeoutMs: 30000,
    });
  },

  /** Multimodal (vision) — 45s timeout (image transfer + LLM inference) */
  async multimodalCommand(req: MultimodalRequest): Promise<LLMResponse> {
    return request('/multimodal', {
      method: 'POST',
      body: JSON.stringify(req),
      timeoutMs: 45000,
    });
  },

  // --- Diagram Storage (10s timeout each) ---

  async listDiagrams(): Promise<DiagramListItem[]> {
    return request('/diagrams');
  },

  async getDiagram(id: string): Promise<DiagramDetail> {
    return request(`/diagrams/${id}`);
  },

  async createDiagram(body: CreateDiagramBody): Promise<DiagramDetail> {
    return request('/diagrams', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async updateDiagram(id: string, body: UpdateDiagramBody): Promise<DiagramDetail> {
    return request(`/diagrams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  async deleteDiagram(id: string): Promise<void> {
    return request(`/diagrams/${id}`, { method: 'DELETE' });
  },
};
