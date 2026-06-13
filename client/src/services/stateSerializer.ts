import type { CommandRequest } from '@shared/types';
import { useDiagramStore } from '../store/diagramStore';

/** Serialize current diagram state for LLM API requests. */
export function buildDiagramState(state: ReturnType<typeof useDiagramStore.getState>): CommandRequest['diagramState'] {
  return {
    mode: state.mode,
    elements: Object.values(state.elements).map((el) => ({
      id: el.id,
      type: el.type,
      label: el.label,
      voiceAliases: el.voiceAliases,
      position: el.position,
      size: el.size,
      style: el.style,
    })),
    edges: state.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      label: e.label,
      style: e.style,
    })),
    selectedId: state.selectedId,
    lastMentionedId: state.lastMentionedId,
  };
}
