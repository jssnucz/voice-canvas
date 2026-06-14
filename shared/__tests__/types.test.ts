import { describe, it, expect } from 'vitest';
import {
  makeCreateCommand,
  makeUpdateCommand,
  makeDeleteCommand,
  makeMoveCommand,
  makeConnectCommand,
  makeQueryCommand,
  ELEMENT_DEFAULTS,
  ELEMENT_LABELS,
} from '../types';
import type { ElementType } from '../types';

describe('makeCreateCommand', () => {
  it('returns a create command with elements, edges, and layout', () => {
    const cmd = makeCreateCommand({
      elements: [{ type: 'rect', label: 'test' }],
      edges: [{ type: 'solid', source: 'a', target: 'b' }],
      layout: 'vertical',
      reasoning: 'user asked for a rectangle',
    });

    expect(cmd.action).toBe('create');
    expect(cmd.payload?.elements).toHaveLength(1);
    expect(cmd.payload?.elements?.[0].type).toBe('rect');
    expect(cmd.payload?.edges).toHaveLength(1);
    expect(cmd.payload?.edges?.[0].type).toBe('solid');
    expect(cmd.payload?.layout).toBe('vertical');
    expect(cmd.reasoning).toBe('user asked for a rectangle');
  });

  it('returns a create command with only elements (rest undefined)', () => {
    const cmd = makeCreateCommand({ elements: [{ type: 'diamond' }] });
    expect(cmd.action).toBe('create');
    expect(cmd.payload?.edges).toBeUndefined();
    expect(cmd.payload?.layout).toBeUndefined();
    expect(cmd.reasoning).toBeUndefined();
  });
});

describe('makeUpdateCommand', () => {
  it('returns an update command with targets and element patches', () => {
    const cmd = makeUpdateCommand(['elem_1', 'elem_2'], [{ label: 'new label' }], 'rename');

    expect(cmd.action).toBe('update');
    expect(cmd.targets).toEqual(['elem_1', 'elem_2']);
    expect(cmd.payload?.elements).toHaveLength(1);
    expect(cmd.payload?.elements?.[0].label).toBe('new label');
    expect(cmd.reasoning).toBe('rename');
  });
});

describe('makeDeleteCommand', () => {
  it('returns a delete command with targets and empty payload elements', () => {
    const cmd = makeDeleteCommand(['elem_1'], 'obsolete');

    expect(cmd.action).toBe('delete');
    expect(cmd.targets).toEqual(['elem_1']);
    expect(cmd.payload?.elements).toEqual([]);
    expect(cmd.reasoning).toBe('obsolete');
  });
});

describe('makeMoveCommand', () => {
  it('returns a move command with position array for each target', () => {
    const cmd = makeMoveCommand(
      ['elem_1', 'elem_2'],
      [{ x: 100, y: 200 }, { x: 300, y: 400 }],
      'align'
    );

    expect(cmd.action).toBe('move');
    expect(cmd.targets).toEqual(['elem_1', 'elem_2']);
    expect(cmd.payload?.elements).toHaveLength(2);
    expect(cmd.payload?.elements?.[0].position).toEqual({ x: 100, y: 200 });
    expect(cmd.payload?.elements?.[1].position).toEqual({ x: 300, y: 400 });
    expect(cmd.reasoning).toBe('align');
  });
});

describe('makeConnectCommand', () => {
  it('returns a connect command with source, target, and default solid edge', () => {
    const cmd = makeConnectCommand('elem_1', 'elem_2');

    expect(cmd.action).toBe('connect');
    expect(cmd.targets).toEqual(['elem_1', 'elem_2']);
    expect(cmd.payload?.edges).toHaveLength(1);
    expect(cmd.payload?.edges?.[0].type).toBe('solid');
  });

  it('accepts custom edge properties', () => {
    const cmd = makeConnectCommand('a', 'b', { type: 'dashed', label: 'async' }, 'msg');

    expect(cmd.payload?.edges?.[0].type).toBe('dashed');
    expect(cmd.payload?.edges?.[0].label).toBe('async');
    expect(cmd.reasoning).toBe('msg');
  });
});

describe('makeQueryCommand', () => {
  it('returns a query command with targets and no payload', () => {
    const cmd = makeQueryCommand(['elem_1', 'elem_2'], 'check');

    expect(cmd.action).toBe('query');
    expect(cmd.targets).toEqual(['elem_1', 'elem_2']);
    expect(cmd.payload).toBeUndefined();
    expect(cmd.reasoning).toBe('check');
  });
});

describe('ELEMENT_DEFAULTS', () => {
  const types: ElementType[] = [
    'rounded-rect', 'rect', 'diamond', 'cylinder',
    'ellipse', 'actor', 'queue', 'cache', 'gateway',
    'lifeline', 'sticky-note',
  ];

  it.each(types)('%s has width, height, fill, and stroke', (type) => {
    const d = ELEMENT_DEFAULTS[type];
    expect(d.width).toBeGreaterThan(0);
    expect(d.height).toBeGreaterThan(0);
    expect(d.fill).toMatch(/^(#[0-9A-Fa-f]{6}|transparent)$/);
    expect(d.stroke).toMatch(/^(#[0-9A-Fa-f]{6}|transparent)$/);
  });
});

describe('ELEMENT_LABELS', () => {
  const types: ElementType[] = [
    'rounded-rect', 'rect', 'diamond', 'cylinder',
    'ellipse', 'actor', 'queue', 'cache', 'gateway',
    'lifeline', 'sticky-note',
  ];

  it.each(types)('%s has a non-empty Chinese label', (type) => {
    expect(ELEMENT_LABELS[type]).toBeTruthy();
    expect(ELEMENT_LABELS[type].length).toBeGreaterThan(0);
  });
});
