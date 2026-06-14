import { describe, it, expect } from 'vitest';
import { LLMResponseSchema } from '../../validators/command';

describe('LLMResponseSchema', () => {
  it('accepts minimal valid payload', () => {
    const input = { commands: [] };
    const result = LLMResponseSchema.parse(input);
    expect(result.commands).toEqual([]);
    expect(result.voiceReply).toBeUndefined();
  });

  it('accepts a complete payload with create + connect + voiceReply', () => {
    const input = {
      commands: [
        {
          action: 'create',
          targets: [],
          payload: {
            elements: [{ type: 'rect', label: '订单服务' }],
            edges: [{ type: 'solid', source: 'a', target: 'b' }],
            layout: 'vertical',
          },
          reasoning: 'create a microservice node',
        },
        {
          action: 'connect',
          targets: ['elem_1', 'elem_2'],
          payload: {
            edges: [{ type: 'dashed', label: '异步消息' }],
          },
        },
      ],
      voiceReply: '已为您添加订单服务节点，并连接到消息队列',
    };

    const result = LLMResponseSchema.parse(input);
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].action).toBe('create');
    expect(result.commands[1].action).toBe('connect');
    expect(result.voiceReply).toBe('已为您添加订单服务节点，并连接到消息队列');
  });

  it('rejects missing commands', () => {
    expect(() => LLMResponseSchema.parse({})).toThrow();
  });

  it('rejects invalid action', () => {
    expect(() =>
      LLMResponseSchema.parse({ commands: [{ action: 'invalid', targets: [] }] })
    ).toThrow();
  });

  it('rejects invalid element type', () => {
    expect(() =>
      LLMResponseSchema.parse({
        commands: [
          {
            action: 'create',
            targets: [],
            payload: { elements: [{ type: 'invalid_type' }] },
          },
        ],
      })
    ).toThrow();
  });

  it('rejects invalid edge type (not solid/dashed)', () => {
    expect(() =>
      LLMResponseSchema.parse({
        commands: [
          {
            action: 'connect',
            targets: ['a', 'b'],
            payload: { edges: [{ type: 'dotted' }] },
          },
        ],
      })
    ).toThrow();
  });

  it('accepts voiceReply as null', () => {
    const input = { commands: [], voiceReply: null };
    const result = LLMResponseSchema.parse(input);
    expect(result.voiceReply).toBeNull();
  });

  it('accepts delete command with targets', () => {
    const input = {
      commands: [{ action: 'delete', targets: ['elem_1', 'elem_2'] }],
    };
    const result = LLMResponseSchema.parse(input);
    expect(result.commands[0].action).toBe('delete');
  });

  it('accepts move command with position', () => {
    const input = {
      commands: [
        {
          action: 'move',
          targets: ['elem_1'],
          payload: { elements: [{ position: { x: 100, y: 200 } }] },
        },
      ],
    };
    const result = LLMResponseSchema.parse(input);
    expect(result.commands[0].action).toBe('move');
  });

  it('accepts query command', () => {
    const input = {
      commands: [{ action: 'query', targets: ['elem_1'] }],
    };
    const result = LLMResponseSchema.parse(input);
    expect(result.commands[0].action).toBe('query');
  });
});
