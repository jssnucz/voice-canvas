import type { CommandRequest, MultimodalRequest, LLMResponse, DiagramListItem, DiagramDetail, CreateDiagramBody, UpdateDiagramBody } from '@shared/types';

const BASE_URL = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Server error: ${res.status}` }));
    throw new Error(err.error || `Server error: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const apiClient = {
  async textCommand(req: CommandRequest, intent: string = 'text'): Promise<LLMResponse> {
    return request('/command', {
      method: 'POST',
      body: JSON.stringify({ ...req, intent }),
    });
  },

  async multimodalCommand(req: MultimodalRequest): Promise<LLMResponse> {
    return request('/multimodal', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  // --- Diagram Storage ---

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
