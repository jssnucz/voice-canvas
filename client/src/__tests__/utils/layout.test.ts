import { describe, it, expect } from 'vitest';
import { layoutFlowchart } from '../../utils/layout';
import type { CanvasElement, CanvasEdge } from '@shared/types';

function makeEl(id: string, overrides: Partial<CanvasElement> = {}): CanvasElement {
  return {
    id,
    type: 'rect',
    label: id,
    voiceAliases: { auto: [], manual: [] },
    position: { x: 0, y: 0 },
    size: { width: 160, height: 60 },
    style: { fill: '#E3F2FD', stroke: '#2196F3', fontSize: 14, fontWeight: 'normal' },
    ...overrides,
  };
}

function makeEdge(id: string, source: string, target: string): CanvasEdge {
  return { id, source, target, type: 'solid' };
}

describe('layoutFlowchart', () => {
  it('returns empty map for empty input', () => {
    const result = layoutFlowchart([], []);
    expect(result.size).toBe(0);
  });

  it('returns valid coordinates for a single node', () => {
    const els = [makeEl('n1')];
    const result = layoutFlowchart(els, []);

    expect(result.has('n1')).toBe(true);
    const pos = result.get('n1')!;
    expect(pos.x).toBeDefined();
    expect(pos.y).toBeDefined();
    expect(Number.isNaN(pos.x)).toBe(false);
    expect(Number.isNaN(pos.y)).toBe(false);
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.y)).toBe(true);
  });

  it('chains 3 nodes with y coordinates strictly increasing (TB layout)', () => {
    const els = [makeEl('a'), makeEl('b'), makeEl('c')];
    const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')];
    const result = layoutFlowchart(els, edges);

    const ay = result.get('a')!.y;
    const by = result.get('b')!.y;
    const cy = result.get('c')!.y;

    expect(ay).toBeLessThan(by);
    expect(by).toBeLessThan(cy);
  });

  it('produces non-overlapping y positions for 3 nodes', () => {
    const els = [makeEl('a'), makeEl('b'), makeEl('c')];
    const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')];
    const result = layoutFlowchart(els, edges);

    const a = result.get('a')!;
    const b = result.get('b')!;
    const c = result.get('c')!;

    // Each node's bottom edge should be above the next node's top edge
    expect(a.y + 60).toBeLessThanOrEqual(b.y);
    expect(b.y + 60).toBeLessThanOrEqual(c.y);
  });

  it('returns coordinates for all input nodes', () => {
    const els = [makeEl('a'), makeEl('b'), makeEl('c'), makeEl('d'), makeEl('e')];
    const edges = [
      makeEdge('e1', 'a', 'b'),
      makeEdge('e2', 'b', 'c'),
      makeEdge('e3', 'b', 'd'),
      makeEdge('e4', 'c', 'e'),
    ];
    const result = layoutFlowchart(els, edges);

    for (const el of els) {
      expect(result.has(el.id)).toBe(true);
      const pos = result.get(el.id)!;
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    }
  });

  it('handles disconnected nodes (no edges)', () => {
    const els = [makeEl('a'), makeEl('b')];
    const result = layoutFlowchart(els, []);

    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
    const a = result.get('a')!;
    expect(Number.isFinite(a.x)).toBe(true);
    expect(Number.isFinite(a.y)).toBe(true);
  });
});
