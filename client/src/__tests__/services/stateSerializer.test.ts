import { describe, it, expect } from 'vitest';
import { buildDiagramState } from '../../services/stateSerializer';
import { useDiagramStore, initialState } from '../../store/diagramStore';
import type { CanvasElement, CanvasEdge } from '@shared/types';

describe('buildDiagramState', () => {
  it('serializes mode, elements, edges, selectedId, lastMentionedId', () => {
    const el: CanvasElement = {
      id: 'e1',
      type: 'rect',
      label: '订单服务',
      voiceAliases: { auto: ['订单'], manual: [] },
      position: { x: 100, y: 200 },
      size: { width: 160, height: 60 },
      style: { fill: '#E3F2FD', stroke: '#2196F3', fontSize: 14, fontWeight: 'normal' },
    };

    const edge: CanvasEdge = {
      id: 'edge1',
      source: 'e1',
      target: 'e2',
      type: 'solid',
    };

    useDiagramStore.setState({
      mode: 'architecture',
      elements: { e1: el },
      edges: [edge],
      selectedId: 'e1',
      lastMentionedId: null,
    });

    const result = buildDiagramState(useDiagramStore.getState());

    expect(result.mode).toBe('architecture');
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0].id).toBe('e1');
    expect(result.elements[0].label).toBe('订单服务');
    expect(result.elements[0].voiceAliases.auto).toEqual(['订单']);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].source).toBe('e1');
    expect(result.edges[0].target).toBe('e2');
    expect(result.selectedId).toBe('e1');
    expect(result.lastMentionedId).toBeNull();
  });

  it('converts elements Record to array', () => {
    useDiagramStore.setState({
      elements: {
        'a': {
          id: 'a', type: 'rect', label: 'A',
          voiceAliases: { auto: [], manual: [] },
          position: { x: 0, y: 0 }, size: { width: 100, height: 50 },
          style: { fill: '#fff', stroke: '#000', fontSize: 14, fontWeight: 'normal' },
        },
        'b': {
          id: 'b', type: 'diamond', label: 'B',
          voiceAliases: { auto: [], manual: [] },
          position: { x: 100, y: 100 }, size: { width: 100, height: 50 },
          style: { fill: '#fff', stroke: '#000', fontSize: 14, fontWeight: 'normal' },
        },
      },
    });

    const result = buildDiagramState(useDiagramStore.getState());
    expect(result.elements).toHaveLength(2);
  });

  it('handles empty canvas gracefully', () => {
    useDiagramStore.setState(initialState, true);

    const result = buildDiagramState(useDiagramStore.getState());
    expect(result.elements).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.selectedId).toBeNull();
  });
});
