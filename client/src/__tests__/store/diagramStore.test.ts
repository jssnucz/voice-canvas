import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore, initialState } from '../../store/diagramStore';
import type { CanvasElement, CanvasEdge, DeltaCommand } from '@shared/types';
import { makeCreateCommand, makeUpdateCommand, makeDeleteCommand, makeMoveCommand, makeConnectCommand } from '@shared/types';

beforeEach(() => {
  useDiagramStore.setState(initialState);
});

function makeEl(id: string, overrides: Partial<CanvasElement> = {}): CanvasElement {
  return {
    id,
    type: 'rect',
    label: 'Test',
    voiceAliases: { auto: [], manual: [] },
    position: { x: 100, y: 200 },
    size: { width: 160, height: 60 },
    style: { fill: '#E3F2FD', stroke: '#2196F3', fontSize: 14, fontWeight: 'normal' },
    ...overrides,
  };
}

function makeEdge(id: string, source: string, target: string): CanvasEdge {
  return { id, source, target, type: 'solid' };
}

describe('initial state', () => {
  it('has flowchart mode, empty elements and edges', () => {
    const s = useDiagramStore.getState();
    expect(s.mode).toBe('flowchart');
    expect(s.elements).toEqual({});
    expect(s.edges).toEqual([]);
    expect(s.selectedId).toBeNull();
    expect(s.lastMentionedId).toBeNull();
    expect(s.history).toEqual([]);
    expect(s.historyIndex).toBe(-1);
  });
});

describe('createElement', () => {
  it('returns a complete CanvasElement with generated id', () => {
    const s = useDiagramStore.getState();
    const el = s.createElement('diamond', '判断');
    expect(el.id).toMatch(/^elem_/);
    expect(el.type).toBe('diamond');
    expect(el.label).toBe('判断');
    expect(el.position.x).toBeGreaterThan(0);
    expect(el.position.y).toBeGreaterThan(0);
    expect(el.size.width).toBeGreaterThan(0);
    expect(el.size.height).toBeGreaterThan(0);
    expect(el.style.fill).toMatch(/^#/);
    expect(el.voiceAliases).toEqual({ auto: [], manual: [] });
  });

  it('uses provided label and position when given', () => {
    const s = useDiagramStore.getState();
    const el = s.createElement('rect', '订单', { x: 50, y: 100 });
    expect(el.label).toBe('订单');
    expect(el.position).toEqual({ x: 50, y: 100 });
  });

  it('defaults label to empty string', () => {
    const s = useDiagramStore.getState();
    const el = s.createElement('rect');
    expect(el.label).toBe('');
  });
});

describe('addElement', () => {
  it('adds element to store and sets lastMentionedId', () => {
    const el = makeEl('e1');
    useDiagramStore.getState().addElement(el);

    const s = useDiagramStore.getState();
    expect(s.elements['e1']).toEqual(el);
    expect(s.lastMentionedId).toBe('e1');
  });
});

describe('updateElement', () => {
  it('merges label update', () => {
    const el = makeEl('e1');
    useDiagramStore.getState().addElement(el);
    useDiagramStore.getState().updateElement('e1', { label: 'updated' });

    expect(useDiagramStore.getState().elements['e1'].label).toBe('updated');
    expect(useDiagramStore.getState().lastMentionedId).toBe('e1');
  });

  it('merges style update without losing existing style keys', () => {
    const el = makeEl('e1');
    useDiagramStore.getState().addElement(el);
    useDiagramStore.getState().updateElement('e1', { style: { fill: '#FF0000' } });

    const updated = useDiagramStore.getState().elements['e1'];
    expect(updated.style.fill).toBe('#FF0000');
    expect(updated.style.stroke).toBe('#2196F3'); // preserved
    expect(updated.style.fontSize).toBe(14);       // preserved
  });

  it('does nothing for non-existent id', () => {
    useDiagramStore.getState().updateElement('nonexistent', { label: 'nope' });
    // Should not throw
  });
});

describe('deleteElement', () => {
  it('removes element and associated edges', () => {
    useDiagramStore.getState().addElement(makeEl('e1'));
    useDiagramStore.getState().addElement(makeEl('e2'));
    useDiagramStore.getState().addEdge(makeEdge('edge1', 'e1', 'e2'));

    useDiagramStore.getState().deleteElement('e1');

    const s = useDiagramStore.getState();
    expect(s.elements['e1']).toBeUndefined();
    expect(s.elements['e2']).toBeDefined();
    expect(s.edges).toHaveLength(0);
  });

  it('clears selectedId if deleted element was selected', () => {
    useDiagramStore.getState().addElement(makeEl('e1'));
    useDiagramStore.getState().setSelected('e1');
    useDiagramStore.getState().deleteElement('e1');

    expect(useDiagramStore.getState().selectedId).toBeNull();
  });

  it('clears lastMentionedId if deleted element was last mentioned', () => {
    useDiagramStore.getState().addElement(makeEl('e1'));
    useDiagramStore.getState().setLastMentioned('e1');
    useDiagramStore.getState().deleteElement('e1');

    expect(useDiagramStore.getState().lastMentionedId).toBeNull();
  });
});

describe('moveElement', () => {
  it('updates position', () => {
    useDiagramStore.getState().addElement(makeEl('e1'));
    useDiagramStore.getState().moveElement('e1', 300, 400);

    expect(useDiagramStore.getState().elements['e1'].position).toEqual({ x: 300, y: 400 });
  });

  it('does nothing for non-existent id', () => {
    useDiagramStore.getState().moveElement('nonexistent', 0, 0);
    // Should not throw
  });
});

describe('addEdge / deleteEdge', () => {
  it('adds edge to edges array', () => {
    useDiagramStore.getState().addEdge(makeEdge('e1', 'a', 'b'));
    expect(useDiagramStore.getState().edges).toHaveLength(1);
  });

  it('deletes edge by id', () => {
    useDiagramStore.getState().addEdge(makeEdge('e1', 'a', 'b'));
    useDiagramStore.getState().deleteEdge('e1');
    expect(useDiagramStore.getState().edges).toHaveLength(0);
  });
});

describe('applyCommands — create', () => {
  it('creates an element and records inverse delete in history', () => {
    const cmd: DeltaCommand = {
      action: 'create',
      targets: [],
      payload: { elements: [{ type: 'rect', label: '订单服务' }] },
    };

    useDiagramStore.getState().applyCommands([cmd], '画一个矩形');

    const s = useDiagramStore.getState();
    const keys = Object.keys(s.elements);
    expect(keys).toHaveLength(1);
    expect(s.elements[keys[0]].label).toBe('订单服务');
    expect(s.history).toHaveLength(1);
    expect(s.historyIndex).toBe(0);
    expect(s.history[0].inverse.action).toBe('delete');
  });

  it('creates edges when specified', () => {
    useDiagramStore.getState().addElement(makeEl('a'));
    useDiagramStore.getState().addElement(makeEl('b'));

    const cmd: DeltaCommand = {
      action: 'create',
      targets: [],
      payload: { edges: [{ source: 'a', target: 'b', type: 'dashed' }] },
    };

    useDiagramStore.getState().applyCommands([cmd], 'connect');

    const s = useDiagramStore.getState();
    expect(s.edges).toHaveLength(1);
    expect(s.edges[0].type).toBe('dashed');
  });

  it('skips element specs without a type (if (!spec.type) continue)', () => {
    const cmd: DeltaCommand = {
      action: 'create',
      targets: [],
      payload: { elements: [{ label: 'no type' } as Record<string, unknown> as { type: string; label: string }] },
    };

    useDiagramStore.getState().applyCommands([cmd], 'create without type');

    const s = useDiagramStore.getState();
    expect(Object.keys(s.elements)).toHaveLength(0);
    // History continues to record
    expect(s.history).toHaveLength(1);
  });
});

describe('applyCommands — delete', () => {
  it('deletes elements and records inverse create in history', () => {
    const el = makeEl('to_delete', { label: '旧节点' });
    useDiagramStore.getState().addElement(el);

    const cmd = makeDeleteCommand(['to_delete']);
    useDiagramStore.getState().applyCommands([cmd], '删掉它');

    const s = useDiagramStore.getState();
    expect(s.elements['to_delete']).toBeUndefined();
    expect(s.history).toHaveLength(1);
    expect(s.history[0].inverse.action).toBe('create');
    expect(s.history[0].inverse.payload?.elements?.[0].label).toBe('旧节点');
  });
});

describe('applyCommands — update', () => {
  it('updates element label and records inverse with old values', () => {
    const el = makeEl('e1', { label: '旧标签' });
    useDiagramStore.getState().addElement(el);

    const cmd = makeUpdateCommand(['e1'], [{ label: '新标签' }]);
    useDiagramStore.getState().applyCommands([cmd], '改名');

    const s = useDiagramStore.getState();
    expect(s.elements['e1'].label).toBe('新标签');
    expect(s.history).toHaveLength(1);
    expect(s.history[0].inverse.action).toBe('update');
    expect(s.history[0].inverse.payload?.elements?.[0].label).toBe('旧标签');
  });
});

describe('applyCommands — move', () => {
  it('moves element and records inverse with old position', () => {
    useDiagramStore.getState().addElement(makeEl('e1', { position: { x: 100, y: 200 } }));

    const cmd = makeMoveCommand(['e1'], [{ x: 500, y: 600 }]);
    useDiagramStore.getState().applyCommands([cmd], '移过去');

    const s = useDiagramStore.getState();
    expect(s.elements['e1'].position).toEqual({ x: 500, y: 600 });
    expect(s.history).toHaveLength(1);
    expect(s.history[0].inverse.action).toBe('move');
    expect(s.history[0].inverse.payload?.elements?.[0].position).toEqual({ x: 100, y: 200 });
  });
});

describe('applyCommands — connect', () => {
  it('creates edge and records inverse delete in history', () => {
    useDiagramStore.getState().addElement(makeEl('a'));
    useDiagramStore.getState().addElement(makeEl('b'));

    const cmd = makeConnectCommand('a', 'b', { type: 'solid' });
    useDiagramStore.getState().applyCommands([cmd], '连线');

    const s = useDiagramStore.getState();
    expect(s.edges).toHaveLength(1);
    expect(s.edges[0].source).toBe('a');
    expect(s.edges[0].target).toBe('b');
    expect(s.history).toHaveLength(1);
    expect(s.history[0].inverse.action).toBe('delete');
  });
});

describe('applyCommands — query', () => {
  it('advances history but does not mutate elements or edges', () => {
    useDiagramStore.getState().addElement(makeEl('e1'));

    const cmd: DeltaCommand = {
      action: 'query',
      targets: ['e1'],
    };

    useDiagramStore.getState().applyCommands([cmd], '查询');

    const s = useDiagramStore.getState();
    expect(s.elements['e1']).toBeDefined(); // unchanged
    expect(s.edges).toHaveLength(0);        // unchanged
    expect(s.history).toHaveLength(1);
    expect(s.historyIndex).toBe(0);
  });
});

describe('undo / redo', () => {
  it('undo reverts the last command', () => {
    const el = makeEl('e1');
    useDiagramStore.getState().addElement(el);

    const cmd = makeUpdateCommand(['e1'], [{ label: 'changed' }]);
    useDiagramStore.getState().applyCommands([cmd], 'change');

    expect(useDiagramStore.getState().elements['e1'].label).toBe('changed');

    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().elements['e1'].label).toBe('Test');
    expect(useDiagramStore.getState().historyIndex).toBe(-1);
  });

  it('redo re-applies the last undone command', () => {
    useDiagramStore.getState().addElement(makeEl('e1'));
    useDiagramStore.getState().applyCommands(
      [makeUpdateCommand(['e1'], [{ label: 'changed' }])],
      'change'
    );
    useDiagramStore.getState().undo();
    useDiagramStore.getState().redo();

    expect(useDiagramStore.getState().elements['e1'].label).toBe('changed');
    expect(useDiagramStore.getState().historyIndex).toBe(0);
  });

  it('undo is a no-op when historyIndex is -1', () => {
    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().historyIndex).toBe(-1);
  });

  it('redo is a no-op when at end of history', () => {
    useDiagramStore.getState().redo();
    expect(useDiagramStore.getState().historyIndex).toBe(-1);
  });

  it('supports multiple undo steps', () => {
    useDiagramStore.getState().addElement(makeEl('e1'));
    useDiagramStore.getState().applyCommands(
      [makeUpdateCommand(['e1'], [{ label: 'A' }])], 'to A'
    );
    useDiagramStore.getState().applyCommands(
      [makeUpdateCommand(['e1'], [{ label: 'B' }])], 'to B'
    );

    expect(useDiagramStore.getState().elements['e1'].label).toBe('B');
    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().elements['e1'].label).toBe('A');
    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().elements['e1'].label).toBe('Test');
  });
});

describe('resolveTargets', () => {
  it('resolves "selected" to selectedId (via delete)', () => {
    useDiagramStore.getState().addElement(makeEl('e1'));
    useDiagramStore.getState().setSelected('e1');

    const cmd = makeDeleteCommand(['selected']);
    useDiagramStore.getState().applyCommands([cmd], 'delete selected');

    expect(useDiagramStore.getState().elements['e1']).toBeUndefined();
  });

  it('resolves "lastMentioned" to lastMentionedId (via delete)', () => {
    useDiagramStore.getState().addElement(makeEl('e1'));
    useDiagramStore.getState().setLastMentioned('e1');

    const cmd = makeDeleteCommand(['lastMentioned']);
    useDiagramStore.getState().applyCommands([cmd], 'delete last mentioned');

    expect(useDiagramStore.getState().elements['e1']).toBeUndefined();
  });
});

describe('clearAll', () => {
  it('resets all state to initial', () => {
    useDiagramStore.getState().addElement(makeEl('e1'));
    useDiagramStore.getState().addElement(makeEl('e2'));
    useDiagramStore.getState().addEdge(makeEdge('edge1', 'e1', 'e2'));
    useDiagramStore.getState().setSelected('e1');
    useDiagramStore.getState().setLastMentioned('e2');

    useDiagramStore.getState().clearAll();

    const s = useDiagramStore.getState();
    expect(s.elements).toEqual({});
    expect(s.edges).toEqual([]);
    expect(s.selectedId).toBeNull();
    expect(s.lastMentionedId).toBeNull();
    expect(s.history).toEqual([]);
    expect(s.historyIndex).toBe(-1);
  });
});
