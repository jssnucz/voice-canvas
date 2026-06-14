import { describe, it, expect, beforeEach } from 'vitest';
import type { CanvasElement, CanvasEdge } from '@shared/types';
import { makeCreateCommand, makeDeleteCommand, makeUpdateCommand, makeMoveCommand, makeConnectCommand } from '@shared/types';
import { useDiagramStore, initialState } from '../../store/diagramStore';

// Helpers
type Elem = CanvasElement;
function el(overrides: Partial<Elem> & { id: string; type: Elem['type'] }): Elem {
  return {
    label: '',
    voiceAliases: { auto: [], manual: [] },
    position: { x: 100, y: 100 },
    size: { width: 160, height: 60 },
    style: { fill: '#fff', stroke: '#1a1a1a', fontSize: 14, fontWeight: 'normal' },
    ...overrides,
  };
}

/** Set up elements + edges directly via setState (bypasses actions, avoids React dependency) */
function setup(elements: Record<string, Elem>, edges: CanvasEdge[] = [], extra: Partial<ReturnType<typeof useDiagramStore.getState>> = {}) {
  useDiagramStore.setState({
    ...initialState,
    elements,
    edges,
    ...extra,
  });
}

describe('commandEngine', () => {
  beforeEach(() => {
    useDiagramStore.setState(initialState); // merge, NOT replace — preserves actions
  });

  // ── resolveTargets ──

  describe('resolveTargets', () => {
    it('resolves "selected" to selectedId', () => {
      setup(
        { elem_1: el({ id: 'elem_1', type: 'rect' }) },
        [],
        { selectedId: 'elem_1' }
      );

      useDiagramStore.getState().applyCommands([
        makeUpdateCommand(['selected'], [{ label: 'updated' }]),
      ], 'test');

      expect(useDiagramStore.getState().elements['elem_1'].label).toBe('updated');
    });

    it('resolves "lastMentioned" to lastMentionedId', () => {
      setup(
        {
          elem_a: el({ id: 'elem_a', type: 'rect', label: 'A' }),
          elem_b: el({ id: 'elem_b', type: 'rect', label: 'B' }),
        },
        [],
        { lastMentionedId: 'elem_b' }
      );

      useDiagramStore.getState().applyCommands([
        makeUpdateCommand(['lastMentioned'], [{ label: 'B-updated' }]),
      ], 'test');

      expect(useDiagramStore.getState().elements['elem_b'].label).toBe('B-updated');
    });

    it('passes through literal element IDs unchanged', () => {
      setup({ elem_x: el({ id: 'elem_x', type: 'rect', label: 'X' }) });

      useDiagramStore.getState().applyCommands([
        makeUpdateCommand(['elem_x'], [{ label: 'X-updated' }]),
      ], 'test');

      expect(useDiagramStore.getState().elements['elem_x'].label).toBe('X-updated');
    });

    it('filters out null resolved targets (no crash on no-selection delete)', () => {
      expect(() => {
        useDiagramStore.getState().applyCommands([makeDeleteCommand(['selected'])], 'test');
      }).not.toThrow();
    });
  });

  // ── computeInverse / undo ──

  describe('computeInverse / undo', () => {
    it('undoes a create by deleting created elements and edges', () => {
      useDiagramStore.getState().applyCommands([
        makeCreateCommand({
          elements: [
            { id: 'n1', type: 'rect', label: 'A' },
            { id: 'n2', type: 'rect', label: 'B' },
          ],
          edges: [{ source: 'n1', target: 'n2', type: 'solid' }],
        }),
      ], 'create');

      expect(Object.keys(useDiagramStore.getState().elements)).toHaveLength(2);
      expect(useDiagramStore.getState().edges).toHaveLength(1);

      useDiagramStore.getState().undo();

      expect(Object.keys(useDiagramStore.getState().elements)).toHaveLength(0);
      expect(useDiagramStore.getState().edges).toHaveLength(0);
    });

    it('undoes a delete and restores cascaded edges (Bug 3 fix)', () => {
      useDiagramStore.getState().applyCommands([
        makeCreateCommand({
          elements: [
            { id: 'n1', type: 'rect', label: 'A' },
            { id: 'n2', type: 'rect', label: 'B' },
          ],
          edges: [{ source: 'n1', target: 'n2', type: 'solid' }],
        }),
      ], 'create');
      useDiagramStore.getState().applyCommands([makeDeleteCommand(['n1'])], 'delete n1');

      expect(useDiagramStore.getState().elements['n1']).toBeUndefined();
      expect(useDiagramStore.getState().edges).toHaveLength(0);

      useDiagramStore.getState().undo();

      expect(useDiagramStore.getState().elements['n1']).toBeDefined();
      expect(useDiagramStore.getState().edges).toHaveLength(1);
      expect(useDiagramStore.getState().edges[0].source).toBe('n1');
      expect(useDiagramStore.getState().edges[0].target).toBe('n2');
    });

    it('undoes an update by restoring previous state', () => {
      setup({
        n1: el({ id: 'n1', type: 'rect', label: 'old', style: { fill: '#fff', stroke: '#000', fontSize: 14, fontWeight: 'normal' } }),
      });

      useDiagramStore.getState().applyCommands([
        makeUpdateCommand(['n1'], [{ label: 'new', style: { fill: '#f00' } }]),
      ], 'update');

      expect(useDiagramStore.getState().elements['n1'].label).toBe('new');

      useDiagramStore.getState().undo();

      expect(useDiagramStore.getState().elements['n1'].label).toBe('old');
    });

    it('undoes a move by restoring previous position', () => {
      setup({
        n1: el({ id: 'n1', type: 'rect', position: { x: 100, y: 100 } }),
      });

      useDiagramStore.getState().applyCommands([
        makeMoveCommand(['n1'], [{ x: 300, y: 400 }]),
      ], 'move');

      expect(useDiagramStore.getState().elements['n1'].position).toEqual({ x: 300, y: 400 });

      useDiagramStore.getState().undo();

      expect(useDiagramStore.getState().elements['n1'].position).toEqual({ x: 100, y: 100 });
    });

    it('undoes a connect by deleting the created edge', () => {
      setup({
        src: el({ id: 'src', type: 'rect' }),
        dst: el({ id: 'dst', type: 'rect' }),
      });

      useDiagramStore.getState().applyCommands([
        makeConnectCommand('src', 'dst', { type: 'solid', label: 'link' }),
      ], 'connect');

      expect(useDiagramStore.getState().edges).toHaveLength(1);

      useDiagramStore.getState().undo();

      expect(useDiagramStore.getState().edges).toHaveLength(0);
    });
  });

  // ── executeCommandLocally ──

  describe('executeCommandLocally', () => {
    it('create: adds elements and edges to the store', () => {
      useDiagramStore.getState().applyCommands([
        makeCreateCommand({
          elements: [
            { id: 'n1', type: 'rounded-rect', label: 'Start' },
            { id: 'n2', type: 'diamond', label: 'Check' },
          ],
          edges: [{ source: 'n1', target: 'n2', type: 'solid', label: 'yes' }],
        }),
      ], 'create');

      const s = useDiagramStore.getState();
      expect(Object.keys(s.elements)).toHaveLength(2);
      expect(s.elements['n1'].type).toBe('rounded-rect');
      expect(s.elements['n2'].type).toBe('diamond');
      expect(s.edges).toHaveLength(1);
      expect(s.edges[0].source).toBe('n1');
      expect(s.edges[0].label).toBe('yes');
    });

    it('update: applies style and label changes, preserves unmodified', () => {
      setup({
        n1: el({ id: 'n1', type: 'rect', label: 'Old', style: { fill: '#fff', stroke: '#000', fontSize: 14, fontWeight: 'normal' } }),
      });

      useDiagramStore.getState().applyCommands([
        makeUpdateCommand(['n1'], [{ label: 'New', style: { fill: '#f00', stroke: '#c00' } }]),
      ], 'update');

      const e = useDiagramStore.getState().elements['n1'];
      expect(e.label).toBe('New');
      expect(e.style.fill).toBe('#f00');
      expect(e.style.fontSize).toBe(14);
    });

    it('delete: removes element and cascaded edges', () => {
      useDiagramStore.getState().applyCommands([
        makeCreateCommand({
          elements: [
            { id: 'n1', type: 'rect' },
            { id: 'n2', type: 'rect' },
            { id: 'n3', type: 'rect' },
          ],
          edges: [
            { source: 'n1', target: 'n2', type: 'solid' },
            { source: 'n1', target: 'n3', type: 'dashed' },
          ],
        }),
      ], 'create');
      useDiagramStore.getState().applyCommands([makeDeleteCommand(['n1'])], 'delete');

      const s = useDiagramStore.getState();
      expect(s.elements['n1']).toBeUndefined();
      expect(s.elements['n2']).toBeDefined();
      expect(s.edges).toHaveLength(0);
    });

    it('connect: creates an edge between two existing elements', () => {
      setup({ a: el({ id: 'a', type: 'rect' }), b: el({ id: 'b', type: 'diamond' }) });

      useDiagramStore.getState().applyCommands([
        makeConnectCommand('a', 'b', { type: 'dashed', label: 'async' }),
      ], 'connect');

      const s = useDiagramStore.getState();
      expect(s.edges).toHaveLength(1);
      expect(s.edges[0].source).toBe('a');
      expect(s.edges[0].target).toBe('b');
      expect(s.edges[0].type).toBe('dashed');
      expect(s.edges[0].label).toBe('async');
    });

    it('connect: blocks duplicate edges (Bug 4 fix)', () => {
      setup({ a: el({ id: 'a', type: 'rect' }), b: el({ id: 'b', type: 'rect' }) });

      useDiagramStore.getState().applyCommands([makeConnectCommand('a', 'b')], 'first');
      useDiagramStore.getState().applyCommands([makeConnectCommand('a', 'b')], 'dup');

      expect(useDiagramStore.getState().edges).toHaveLength(1);
    });

    it('connect: resolves "selected" and "lastMentioned" tokens', () => {
      setup(
        { src: el({ id: 'src', type: 'rect' }), dst: el({ id: 'dst', type: 'rect' }) },
        [],
        { selectedId: 'src', lastMentionedId: 'dst' }
      );

      useDiagramStore.getState().applyCommands([
        makeConnectCommand('selected', 'lastMentioned', { type: 'solid' }),
      ], 'connect tokens');

      const s = useDiagramStore.getState();
      expect(s.edges).toHaveLength(1);
      expect(s.edges[0].source).toBe('src');
      expect(s.edges[0].target).toBe('dst');
    });
  });

  // ── undo/redo multi-step ──

  describe('undo/redo multi-step', () => {
    it('undo/redo chain restores state correctly', () => {
      useDiagramStore.getState().applyCommands([
        makeCreateCommand({ elements: [{ id: 'n1', type: 'rect', label: 'First' }] }),
      ], 'step1');
      useDiagramStore.getState().applyCommands([
        makeUpdateCommand(['n1'], [{ label: 'Second' }]),
      ], 'step2');

      // Undo step2
      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().elements['n1'].label).toBe('First');
      // Undo step1
      useDiagramStore.getState().undo();
      expect(useDiagramStore.getState().elements['n1']).toBeUndefined();
      // Redo step1
      useDiagramStore.getState().redo();
      expect(useDiagramStore.getState().elements['n1'].label).toBe('First');
      // Redo step2
      useDiagramStore.getState().redo();
      expect(useDiagramStore.getState().elements['n1'].label).toBe('Second');
    });
  });
});
