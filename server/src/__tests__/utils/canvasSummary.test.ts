import { describe, it, expect } from 'vitest';
import { generateCanvasSummary } from '../../utils/canvasSummary';
import type { CommandRequest } from '@shared/types';

function makeState(overrides: Partial<CommandRequest['diagramState']> = {}): CommandRequest['diagramState'] {
  return {
    mode: 'flowchart',
    elements: [],
    edges: [],
    selectedId: null,
    lastMentionedId: null,
    ...overrides,
  };
}

function makeElement(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 'rect' as const,
    label: 'Test',
    voiceAliases: { auto: [], manual: [] },
    position: { x: 100, y: 200 },
    size: { width: 160, height: 60 },
    style: { fill: '#E3F2FD', stroke: '#2196F3', fontSize: 14, fontWeight: 'normal' as const },
    ...overrides,
  };
}

function makeEdge(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    source: 'elem_1',
    target: 'elem_2',
    type: 'solid' as const,
    label: undefined,
    style: undefined,
    ...overrides,
  };
}

describe('generateCanvasSummary', () => {
  it('includes mode', () => {
    const summary = generateCanvasSummary(makeState({ mode: 'architecture' }));
    expect(summary).toContain('architecture');
  });

  it('includes element count', () => {
    const summary = generateCanvasSummary(
      makeState({ elements: [makeElement('e1'), makeElement('e2')] })
    );
    expect(summary).toContain('2个');
  });

  it('shows element details — id, type, label, position', () => {
    const summary = generateCanvasSummary(
      makeState({ elements: [makeElement('elem_a', { type: 'diamond', label: '判断', position: { x: 50, y: 100 } })] })
    );
    expect(summary).toContain('elem_a');
    expect(summary).toContain('diamond');
    expect(summary).toContain('判断');
    expect(summary).toContain('50');
    expect(summary).toContain('100');
  });

  it('marks selected element with [已选中]', () => {
    const summary = generateCanvasSummary(
      makeState({
        elements: [makeElement('sel_1')],
        selectedId: 'sel_1',
      })
    );
    expect(summary).toContain('[已选中]');
  });

  it('marks last mentioned element with [最近提及]', () => {
    const summary = generateCanvasSummary(
      makeState({
        elements: [makeElement('lm_1')],
        lastMentionedId: 'lm_1',
      })
    );
    expect(summary).toContain('[最近提及]');
  });

  it('shows both markers when element is both selected and last mentioned', () => {
    const summary = generateCanvasSummary(
      makeState({
        elements: [makeElement('both_1')],
        selectedId: 'both_1',
        lastMentionedId: 'both_1',
      })
    );
    expect(summary).toContain('[已选中]');
    expect(summary).toContain('[最近提及]');
  });

  it('includes edges with source → target and type', () => {
    const summary = generateCanvasSummary(
      makeState({
        edges: [makeEdge('edge_1', { source: 'a', target: 'b', type: 'dashed', label: '异步' })],
      })
    );
    expect(summary).toContain('连线');
    expect(summary).toContain('1条');
    expect(summary).toContain('edge_1');
    expect(summary).toContain('a → b');
    expect(summary).toContain('dashed');
    expect(summary).toContain('异步');
  });

  it('does not crash on an empty canvas', () => {
    const summary = generateCanvasSummary(makeState());
    expect(summary).toContain('0个');
    expect(summary).toContain('0条');
  });

  it('shows aliases when present', () => {
    const summary = generateCanvasSummary(
      makeState({
        elements: [makeElement('ea', { voiceAliases: { auto: ['alias1', 'alias2'], manual: [] } })],
      })
    );
    expect(summary).toContain('alias1');
    expect(summary).toContain('alias2');
  });
});
