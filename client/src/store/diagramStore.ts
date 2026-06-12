import { create } from 'zustand';
import type { DiagramMode, CanvasElement, CanvasEdge, CommandRecord, VoicePhase } from '@shared/types';

interface Store {
  mode: DiagramMode;
  elements: Record<string, CanvasElement>;
  edges: CanvasEdge[];
  selectedId: string | null;
  lastMentionedId: string | null;
  history: CommandRecord[];
  historyIndex: number;
  phase: VoicePhase;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  theme: 'light' | 'dark' | 'blue-gray';
}

export const useDiagramStore = create<Store>(() => ({
  mode: 'flowchart',
  elements: {},
  edges: [],
  selectedId: null,
  lastMentionedId: null,
  history: [],
  historyIndex: -1,
  phase: 'idle',
  transcript: '',
  interimTranscript: '',
  error: null,
  theme: 'dark',
}));
