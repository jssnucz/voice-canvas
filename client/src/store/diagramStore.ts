import { create } from 'zustand';
import type {
  DiagramMode,
  CanvasElement,
  CanvasEdge,
  CommandRecord,
  DeltaCommand,
  VoicePhase,
  ElementType,
} from '@shared/types';
import { ELEMENT_DEFAULTS } from '@shared/types';
import { generateId } from '../utils/id';

interface Store {
  // --- Diagram State ---
  mode: DiagramMode;
  elements: Record<string, CanvasElement>;
  edges: CanvasEdge[];
  selectedId: string | null;
  lastMentionedId: string | null;
  history: CommandRecord[];
  historyIndex: number;

  // --- UI State ---
  phase: VoicePhase;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  theme: 'light' | 'dark' | 'blue-gray';

  // --- Actions ---
  setMode: (mode: DiagramMode) => void;
  setPhase: (phase: VoicePhase) => void;
  setTranscript: (text: string) => void;
  setInterimTranscript: (text: string) => void;
  setError: (err: string | null) => void;
  setSelected: (id: string | null) => void;
  setLastMentioned: (id: string | null) => void;

  // Element CRUD
  addElement: (el: CanvasElement) => void;
  updateElement: (id: string, patch: Partial<CanvasElement>) => void;
  deleteElement: (id: string) => void;
  moveElement: (id: string, x: number, y: number) => void;
  addEdge: (edge: CanvasEdge) => void;
  deleteEdge: (id: string) => void;

  // Batch apply LLM commands
  applyCommands: (commands: DeltaCommand[], utterance: string) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;

  // Clear
  clearAll: () => void;

  // Factory
  createElement: (type: ElementType, label?: string, position?: { x: number; y: number }) => CanvasElement;
}

export const useDiagramStore = create<Store>((set, get) => ({
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

  setMode: (mode) => set({ mode }),
  setPhase: (phase) => set({ phase }),
  setTranscript: (transcript) => set({ transcript }),
  setInterimTranscript: (interimTranscript) => set({ interimTranscript }),
  setError: (error) => set({ error }),
  setSelected: (selectedId) => set({ selectedId }),
  setLastMentioned: (lastMentionedId) => set({ lastMentionedId }),

  createElement: (type, label, position) => {
    const defaults = ELEMENT_DEFAULTS[type];
    const id = generateId();
    return {
      id,
      type,
      label: label || '',
      voiceAliases: { auto: [], manual: [] },
      position: position || { x: 250 + Math.random() * 100, y: 200 + Math.random() * 100 },
      size: { width: defaults.width, height: defaults.height },
      style: {
        fill: defaults.fill,
        stroke: defaults.stroke,
        fontSize: 14,
        fontWeight: 'normal',
      },
    };
  },

  addElement: (el) =>
    set((s) => ({
      elements: { ...s.elements, [el.id]: el },
      lastMentionedId: el.id,
    })),

  updateElement: (id, patch) =>
    set((s) => {
      const existing = s.elements[id];
      if (!existing) return s;
      return {
        elements: {
          ...s.elements,
          [id]: {
            ...existing,
            ...patch,
            id: existing.id,
            style: patch.style ? { ...existing.style, ...patch.style } : existing.style,
            size: patch.size ? { ...existing.size, ...patch.size } : existing.size,
            position: patch.position ? patch.position : existing.position,
            voiceAliases: patch.voiceAliases ? patch.voiceAliases : existing.voiceAliases,
          },
        },
        lastMentionedId: id,
      };
    }),

  deleteElement: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.elements;
      return {
        elements: rest,
        edges: s.edges.filter((e) => e.source !== id && e.target !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
        lastMentionedId: s.lastMentionedId === id ? null : s.lastMentionedId,
      };
    }),

  moveElement: (id, x, y) =>
    set((s) => {
      const el = s.elements[id];
      if (!el) return s;
      return {
        elements: {
          ...s.elements,
          [id]: { ...el, position: { x, y } },
        },
      };
    }),

  addEdge: (edge) =>
    set((s) => ({
      edges: [...s.edges, edge],
    })),

  deleteEdge: (id) =>
    set((s) => ({
      edges: s.edges.filter((e) => e.id !== id),
    })),

  applyCommands: (commands, utterance) => {
    for (const cmd of commands) {
      const state = get();
      const beforeIds = new Set(Object.keys(state.elements));
      const inverse = computeInverse(cmd, state);

      executeCommandLocally(set, get, cmd);

      // Resolve create inverses: capture newly created IDs after execution
      if (cmd.action === 'create' && inverse.action === 'delete') {
        const afterIds = Object.keys(get().elements);
        const newIds = afterIds.filter(id => !beforeIds.has(id));
        inverse.targets = newIds;
      }

      const record: CommandRecord = {
        id: generateId(),
        timestamp: Date.now(),
        command: cmd,
        inverse,
        utterance,
      };

      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(record);
      set({
        history: newHistory,
        historyIndex: newHistory.length - 1,
      });
    }
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < 0) return;
    const record = history[historyIndex];
    executeCommandLocally(set, get, record.inverse);
    set({ historyIndex: historyIndex - 1 });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const record = history[historyIndex + 1];
    executeCommandLocally(set, get, record.command);
    set({ historyIndex: historyIndex + 1 });
  },

  clearAll: () =>
    set({
      elements: {},
      edges: [],
      selectedId: null,
      lastMentionedId: null,
      history: [],
      historyIndex: -1,
    }),
}));

// --- Helper functions (file-private) ---

function computeInverse(cmd: DeltaCommand, state: Store): DeltaCommand {
  if (cmd.action === 'create') {
    // Inverse of create is delete all created elements
    // We need to know what IDs were created — they're in the elements after execution
    // For now, snapshot element IDs before and diff after
    const beforeIds = new Set(Object.keys(state.elements));
    // Return a marker that will be resolved after execution
    return {
      action: 'delete',
      targets: [], // will be filled by caller
    } as DeltaCommand;
  }

  if (cmd.action === 'delete') {
    const ids = resolveTargets(cmd.targets, state);
    const snapshots = ids.map(id => state.elements[id]).filter(Boolean);
    return {
      action: 'create',
      payload: { elements: snapshots as any[] },
    } as DeltaCommand;
  }

  if (cmd.action === 'update') {
    const ids = resolveTargets(cmd.targets, state);
    const snapshots = ids.map(id => state.elements[id]).filter(Boolean);
    return {
      action: 'update',
      targets: ids,
      payload: { elements: snapshots.map(el => ({ ...el })) as any[] },
    } as DeltaCommand;
  }

  if (cmd.action === 'move') {
    const ids = resolveTargets(cmd.targets, state);
    const positions = ids.map(id => state.elements[id]?.position).filter(Boolean);
    return {
      action: 'move',
      targets: ids,
      payload: { elements: positions.map(p => ({ position: p })) as any[] },
    } as DeltaCommand;
  }

  if (cmd.action === 'connect') {
    return {
      action: 'delete',
      targets: cmd.targets,
    } as DeltaCommand;
  }

  return { action: 'query', targets: [] } as DeltaCommand;
}

function executeCommandLocally(
  set: (p: Partial<Store> | ((s: Store) => Partial<Store>)) => void,
  get: () => Store,
  cmd: DeltaCommand
): void {
  const state = get();

  if (cmd.action === 'create') {
    const elSpecs = cmd.payload.elements;
    const edgeSpecs = cmd.payload.edges;
    if (elSpecs) {
      for (const spec of elSpecs) {
        if (!spec.type) continue;
        const newEl = state.createElement(spec.type as ElementType, spec.label);
        if (spec.style) Object.assign(newEl.style, spec.style);
        if (spec.size) newEl.size = { ...newEl.size, ...spec.size };
        if (spec.position) newEl.position = spec.position;
        if (spec.voiceAliases) newEl.voiceAliases = spec.voiceAliases;
        set((s) => ({
          elements: { ...s.elements, [newEl.id]: newEl },
          lastMentionedId: newEl.id,
        }));
      }
    }
    if (edgeSpecs) {
      for (const edgeSpec of edgeSpecs) {
        const source = edgeSpec.source;
        const target = edgeSpec.target;
        if (!source || !target) continue;
        const edgeId = generateId();
        set((s) => ({
          edges: [
            ...s.edges,
            {
              id: edgeId,
              source,
              target,
              type: edgeSpec.type || 'solid',
              label: edgeSpec.label,
              style: edgeSpec.style,
            },
          ],
        }));
      }
    }
    return;
  }

  if (cmd.action === 'update' || cmd.action === 'delete' || cmd.action === 'move') {
    const ids = resolveTargets(cmd.targets, state);

    if (cmd.action === 'update') {
      const patches = cmd.payload?.elements || [];
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const el = state.elements[id];
        const patch = patches[i % patches.length];
        if (!el || !patch) continue;
        set((s) => ({
          elements: {
            ...s.elements,
            [id]: {
              ...s.elements[id],
              ...patch,
              id,
              style: patch.style ? { ...s.elements[id].style, ...patch.style } : s.elements[id].style,
              size: patch.size ? { ...s.elements[id].size, ...patch.size } : s.elements[id].size,
              position: patch.position ? patch.position : s.elements[id].position,
              voiceAliases: patch.voiceAliases ? patch.voiceAliases : s.elements[id].voiceAliases,
            },
          },
          lastMentionedId: id,
        }));
      }
    } else if (cmd.action === 'delete') {
      set((s) => {
        const newElements = { ...s.elements };
        for (const id of ids) delete newElements[id];
        return {
          elements: newElements,
          edges: s.edges.filter((e) => !ids.includes(e.source) && !ids.includes(e.target)),
          selectedId: ids.includes(s.selectedId || '') ? null : s.selectedId,
          lastMentionedId: ids.includes(s.lastMentionedId || '') ? null : s.lastMentionedId,
        };
      });
    } else if (cmd.action === 'move') {
      const patches = cmd.payload?.elements || [];
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const patch = patches[i % patches.length];
        if (!patch?.position) continue;
        const { x, y } = patch.position;
        set((s) => {
          const el = s.elements[id];
          if (!el) return s;
          return {
            elements: { ...s.elements, [id]: { ...el, position: { x, y } } },
          };
        });
      }
    }
    return;
  }

  if (cmd.action === 'connect') {
    const [source, target] = cmd.targets;
    if (source && target && cmd.payload?.edges?.[0]) {
      const edgeId = generateId();
      set((s) => ({
        edges: [
          ...s.edges,
          {
            id: edgeId,
            source,
            target,
            type: cmd.payload!.edges![0].type || 'solid',
            label: cmd.payload!.edges![0].label,
            style: cmd.payload!.edges![0].style,
          },
        ],
      }));
    }
    return;
  }

  // query action — nothing to execute locally
}

function resolveTargets(targets: string[], state: Store): string[] {
  return targets
    .map((t) => {
      if (t === 'selected') return state.selectedId;
      if (t === 'lastMentioned') return state.lastMentionedId;
      return t;
    })
    .filter(Boolean) as string[];
}
