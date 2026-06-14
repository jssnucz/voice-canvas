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
import { ELEMENT_DEFAULTS, makeCreateCommand, makeDeleteCommand, makeUpdateCommand, makeMoveCommand, makeQueryCommand } from '@shared/types';
import { generateId } from '../utils/id';
import { layoutFlowchart } from '../utils/layout';
import type { NoiseState, NoiseLevel } from '../services/audioLevelMonitor';

type AudioNoiseState = { level: number; state: NoiseState; noiseLevel: NoiseLevel };

const initialData = {
  mode: 'flowchart' as DiagramMode,
  elements: {} as Record<string, CanvasElement>,
  edges: [] as CanvasEdge[],
  selectedId: null as string | null,
  lastMentionedId: null as string | null,
  history: [] as CommandRecord[],
  historyIndex: -1,
  phase: 'idle' as VoicePhase,
  transcript: '',
  interimTranscript: '',
  error: null as string | null,
  theme: 'dark' as const,
  audioState: { level: 0, state: 'silence' as NoiseState, noiseLevel: 'low' as NoiseLevel },
};

export { initialData as initialState };

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
  audioState: AudioNoiseState;

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
  ...initialData,

  setMode: (mode) => set({ mode }),
  setPhase: (phase) => set({ phase }),
  setTranscript: (transcript) => set({ transcript }),
  setInterimTranscript: (interimTranscript) => set({ interimTranscript }),
  setError: (error) => set({ error }),
  setAudioState: (audioState: AudioNoiseState) => set({ audioState }),
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
    const records: CommandRecord[] = [];
    for (const cmd of commands) {
      const preState = get();
      const beforeElementIds = new Set(Object.keys(preState.elements));
      const beforeEdgeIds = new Set(preState.edges.map(e => e.id));

      const inverse = computeInverse(cmd, preState);

      executeCommandLocally(set, get, cmd);

      // Resolve inverses that need post-execution IDs
      const postState = get();

      if (cmd.action === 'create' && inverse.action === 'delete') {
        const afterElementIds = Object.keys(postState.elements);
        const newElementIds = afterElementIds.filter(id => !beforeElementIds.has(id));
        const newEdgeIds = postState.edges
          .filter(e => !beforeEdgeIds.has(e.id))
          .map(e => e.id);
        inverse.targets = [...newElementIds, ...newEdgeIds];
      }

      if (cmd.action === 'connect' && inverse.action === 'delete') {
        const newEdgeId = postState.edges.find(e => !beforeEdgeIds.has(e.id))?.id;
        inverse.targets = newEdgeId ? [newEdgeId] : [];
      }

      records.push({
        id: generateId(),
        timestamp: Date.now(),
        command: cmd,
        inverse,
        utterance,
      });
    }

    // Batch history update: single set() instead of N per-loop-iteration calls.
    // executeCommandLocally already updated elements/edges via set() (needed for
    // correct inverse resolution), but history can be written once at the end.
    const state = get();
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    for (const r of records) newHistory.push(r);
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
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
    return makeDeleteCommand([]); // targets will be filled by caller
  }

  if (cmd.action === 'delete') {
    const ids = resolveTargets(cmd.targets, state);
    const snapshots = ids.map(id => state.elements[id]).filter(Boolean);
    // Bug 3 fix: also snapshot edges connected to deleted elements,
    // otherwise undo-delete restores nodes but loses all their connections.
    const cascadedEdges = state.edges.filter(
      e => ids.includes(e.source) || ids.includes(e.target)
    );
    return makeCreateCommand({
      elements: snapshots as CanvasElement[],
      edges: cascadedEdges,
    });
  }

  if (cmd.action === 'update') {
    const ids = resolveTargets(cmd.targets, state);
    const snapshots = ids.map(id => state.elements[id]).filter(Boolean);
    return makeUpdateCommand(ids, snapshots.map(el => ({ ...el })) as CanvasElement[]);
  }

  if (cmd.action === 'move') {
    const ids = resolveTargets(cmd.targets, state);
    const positions = ids.map(id => state.elements[id]?.position).filter(Boolean);
    return makeMoveCommand(ids, positions);
  }

  if (cmd.action === 'connect') {
    // Edge ID not known yet — resolved post-execution in applyCommands
    return makeDeleteCommand([]); // targets filled by applyCommands after edge creation
  }

  return makeQueryCommand([]);
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

    const newElements: Record<string, CanvasElement> = {};
    let lastCreatedId: string | null = null;

    if (elSpecs) {
      for (const spec of elSpecs) {
        if (!spec.type) continue;
        const newEl = state.createElement(spec.type as ElementType, spec.label);
        if (spec.id) newEl.id = spec.id;
        if (spec.style) Object.assign(newEl.style, spec.style);
        if (spec.size) newEl.size = { ...newEl.size, ...spec.size };
        if (spec.position) newEl.position = spec.position;
        if (spec.voiceAliases) newEl.voiceAliases = spec.voiceAliases;
        newElements[newEl.id] = newEl;
        lastCreatedId = newEl.id;
      }
    }

    const newEdges: CanvasEdge[] = [];
    if (edgeSpecs) {
      for (const edgeSpec of edgeSpecs) {
        const source = edgeSpec.source;
        const target = edgeSpec.target;
        if (!source || !target) continue;
        newEdges.push({
          id: generateId(),
          source,
          target,
          type: (edgeSpec.type || 'solid') as 'solid' | 'dashed',
          label: edgeSpec.label,
          style: edgeSpec.style,
        });
      }
    }

    // Item 1: Apply dagre auto-layout when payload.layout is specified.
    // Overrides LLM's hardcoded coordinates with graph-based positioning.
    if (cmd.payload.layout && Object.keys(newElements).length > 0) {
      const allElements = Object.values({ ...state.elements, ...newElements });
      const allEdges = [...state.edges, ...newEdges];
      const layout = layoutFlowchart(allElements, allEdges);
      for (const [id, pos] of layout) {
        if (newElements[id]) {
          newElements[id].position = pos;
        }
      }
    }

    if (Object.keys(newElements).length > 0 || newEdges.length > 0) {
      set((s) => ({
        elements: { ...s.elements, ...newElements },
        edges: [...s.edges, ...newEdges],
        lastMentionedId: lastCreatedId || s.lastMentionedId,
      }));
    }
    return;
  }

  if (cmd.action === 'update' || cmd.action === 'delete' || cmd.action === 'move') {
    const ids = resolveTargets(cmd.targets, state);

    if (cmd.action === 'update') {
      const patches = cmd.payload?.elements || [];
      if (ids.length > 0 && patches.length > 0) {
        set((s) => {
          const updatedElements = { ...s.elements };
          for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const el = updatedElements[id];
            const patch = patches[i % patches.length];
            if (!el || !patch) continue;
            updatedElements[id] = {
              ...el,
              ...patch,
              id,
              style: patch.style ? { ...el.style, ...patch.style } : el.style,
              size: patch.size ? (
                patch.metadata?.sizeMode === 'scale'
                  ? { width: el.size.width * patch.size.width, height: el.size.height * patch.size.height }
                  : { ...el.size, ...patch.size }
              ) : el.size,
              position: patch.position ? patch.position : el.position,
              voiceAliases: patch.voiceAliases ? patch.voiceAliases : el.voiceAliases,
            };
          }
          return {
            elements: updatedElements,
            lastMentionedId: ids[ids.length - 1],
          };
        });
      }
    } else if (cmd.action === 'delete') {
      set((s) => {
        const newElements = { ...s.elements };
        for (const id of ids) delete newElements[id];
        return {
          elements: newElements,
          edges: s.edges.filter((e) =>
            !ids.includes(e.id) && !ids.includes(e.source) && !ids.includes(e.target)
          ),
          selectedId: ids.includes(s.selectedId || '') ? null : s.selectedId,
          lastMentionedId: ids.includes(s.lastMentionedId || '') ? null : s.lastMentionedId,
        };
      });
    } else if (cmd.action === 'move') {
      const patches = cmd.payload?.elements || [];
      if (ids.length > 0 && patches.length > 0) {
        set((s) => {
          const movedElements = { ...s.elements };
          for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const patch = patches[i % patches.length];
            if (!patch?.position) continue;
            const el = movedElements[id];
            if (!el) continue;
            movedElements[id] = { ...el, position: { x: patch.position.x, y: patch.position.y } };
          }
          return { elements: movedElements };
        });
      }
    }
    return;
  }

  if (cmd.action === 'connect') {
    // Resolve special tokens ('selected', 'lastMentioned') in targets
    const resolvedTargets = resolveTargets(cmd.targets, state);
    let [source, target] = resolvedTargets;

    // Fallback: read source/target from payload.edges[0] (LLM may put them there)
    const edgeSpec = cmd.payload?.edges?.[0];
    if (!source && edgeSpec?.source) source = edgeSpec.source;
    if (!target && edgeSpec?.target) target = edgeSpec.target;

    // Also resolve edge spec source/target in case they contain special tokens
    if (edgeSpec) {
      const [edgeSource, edgeTarget] = resolveTargets(
        [edgeSpec.source || '', edgeSpec.target || ''],
        state
      );
      if (!source && edgeSource) source = edgeSource;
      if (!target && edgeTarget) target = edgeTarget;
    }

    if (source && target) {
      // Bug 4 fix: prevent duplicate edges (same source+target pair)
      const hasDuplicate = state.edges.some(
        e => e.source === source && e.target === target
      );
      if (hasDuplicate) return;

      const edgeId = generateId();
      set((s) => ({
        edges: [
          ...s.edges,
          {
            id: edgeId,
            source,
            target,
            type: edgeSpec?.type || 'solid',
            label: edgeSpec?.label,
            style: edgeSpec?.style,
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
