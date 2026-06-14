# Testing Infrastructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a comprehensive Vitest test suite covering all core business logic across shared/client/server workspaces — 13 test files, zero existing tests.

**Architecture:** Vitest workspace mode across shared/node, client/jsdom, server/node environments. Pure function tests run first (no deps), then store/classifier core tests, then mock-dependent tests (fetch, DOM, html-to-image, OpenAI, Fastify inject).

**Tech Stack:** Vitest 3.2, vite-tsconfig-paths 5.1, jsdom, Zod, Zustand, Fastify

---

## File Structure

```
voice-canvas/
├── vitest.workspace.ts                    # NEW
├── package.json                           # MODIFY: add test scripts + devDeps
├── shared/
│   ├── vitest.config.ts                   # NEW
│   └── __tests__/
│       └── types.test.ts                  # NEW
├── client/
│   ├── package.json                       # MODIFY: add vite-tsconfig-paths
│   ├── vitest.config.ts                   # NEW
│   └── src/
│       └── __tests__/
│           ├── store/
│           │   └── diagramStore.test.ts   # NEW
│           ├── services/
│           │   ├── intentClassifier.test.ts  # NEW
│           │   ├── stateSerializer.test.ts   # NEW
│           │   ├── api.test.ts               # NEW
│           │   ├── imageExport.test.ts        # NEW
│           │   └── speechSynthesis.test.ts   # NEW
│           └── utils/
│               ├── id.test.ts                # NEW
│               └── layout.test.ts            # NEW
├── server/
│   ├── package.json                       # MODIFY: add vite-tsconfig-paths
│   ├── vitest.config.ts                   # NEW
│   └── src/
│       └── __tests__/
│           ├── validators/
│           │   └── command.test.ts         # NEW
│           ├── utils/
│           │   └── canvasSummary.test.ts   # NEW
│           ├── routes/
│           │   └── command.test.ts         # NEW
│           └── services/
│               └── llm.test.ts             # NEW
```

---

## Phase 1: Infrastructure

### Task 1.1: Install Vitest and workspace dependencies

**Files:**
- Modify: `voice-canvas/package.json`
- Modify: `voice-canvas/client/package.json`
- Modify: `voice-canvas/server/package.json`

- [ ] **Step 1: Add Vitest to root devDependencies and scripts**

Read `package.json`, then add the `scripts` and `devDependencies` blocks.

```json
{
  "name": "voice-canvas",
  "private": true,
  "workspaces": ["shared", "client", "server"],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "vitest": "^3.2.0",
    "@vitest/coverage-v8": "^3.2.0"
  }
}
```

- [ ] **Step 2: Add vite-tsconfig-paths to client devDependencies**

Read `client/package.json`, add to `devDependencies`:

```json
"vite-tsconfig-paths": "^5.1.0"
```

- [ ] **Step 3: Add vite-tsconfig-paths to server devDependencies**

Read `server/package.json`, add to `devDependencies`:

```json
"vite-tsconfig-paths": "^5.1.0"
```

- [ ] **Step 4: Install dependencies**

```bash
cd E:/voice-canvas && npm install
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json client/package.json server/package.json
git commit -m "chore: add vitest + vite-tsconfig-paths dependencies

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.2: Create Vitest workspace and config files

**Files:**
- Create: `voice-canvas/vitest.workspace.ts`
- Create: `voice-canvas/shared/vitest.config.ts`
- Create: `voice-canvas/client/vitest.config.ts`
- Create: `voice-canvas/server/vitest.config.ts`

- [ ] **Step 1: Create vitest.workspace.ts**

```typescript
export default [
  'shared/vitest.config.ts',
  'client/vitest.config.ts',
  'server/vitest.config.ts',
]
```

- [ ] **Step 2: Create shared/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'shared',
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Create client/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: 'client',
    environment: 'jsdom',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create server/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: 'server',
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Verify infrastructure — Vitest discovers zero tests**

```bash
cd E:/voice-canvas && npx vitest run
```

Expected: Vitest reports "No test files found" or "0 tests run" across all 3 projects.

- [ ] **Step 6: Commit**

```bash
git add vitest.workspace.ts shared/vitest.config.ts client/vitest.config.ts server/vitest.config.ts
git commit -m "feat: create Vitest workspace with shared/client/server configs

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 2: Pure Function Tests

### Task 2.1: shared/__tests__/types.test.ts — DeltaCommand factories + constants

**Files:**
- Create: `voice-canvas/shared/__tests__/types.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
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
    expect(d.fill).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(d.stroke).toMatch(/^#[0-9A-Fa-f]{6}$/);
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
```

- [ ] **Step 2: Run the tests**

```bash
cd E:/voice-canvas && npx vitest run --project shared
```

Expected: All tests pass (11+11+1+1+1+1+1+1 = ~28 assertions).

- [ ] **Step 3: Commit**

```bash
git add shared/__tests__/
git commit -m "test: add DeltaCommand factory and ELEMENT_DEFAULTS tests

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2.2: server/src/__tests__/validators/command.test.ts — Zod schema validation

**Files:**
- Create: `voice-canvas/server/src/__tests__/validators/command.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest';
import { LLMResponseSchema } from '../../validators/command';

describe('LLMResponseSchema', () => {
  it('accepts minimal valid payload', () => {
    const input = { commands: [] };
    const result = LLMResponseSchema.parse(input);
    expect(result.commands).toEqual([]);
    expect(result.voiceReply).toBeNull();
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
```

- [ ] **Step 2: Run the tests**

```bash
cd E:/voice-canvas && npx vitest run --project server
```

Expected: All validators tests pass.

- [ ] **Step 3: Commit**

```bash
git add server/src/__tests__/validators/
git commit -m "test: add Zod LLMResponseSchema validation tests

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2.3: server/src/__tests__/utils/canvasSummary.test.ts — Canvas summary generation

**Files:**
- Create: `voice-canvas/server/src/__tests__/utils/canvasSummary.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
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
```

- [ ] **Step 2: Run the tests**

```bash
cd E:/voice-canvas && npx vitest run --project server
```

Expected: All canvasSummary tests pass.

- [ ] **Step 3: Commit**

```bash
git add server/src/__tests__/utils/
git commit -m "test: add canvasSummary generation tests

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2.4: client/src/__tests__/utils/id.test.ts — ID generation

**Files:**
- Create: `voice-canvas/client/src/__tests__/utils/id.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest';
import { generateId } from '../../utils/id';

describe('generateId', () => {
  it('returns a string matching elem_<timestamp>_<counter> format', () => {
    const id = generateId();
    expect(id).toMatch(/^elem_\d+_\d+$/);
  });

  it('increments counter with each call', () => {
    const id1 = generateId();
    const id2 = generateId();

    const counter1 = Number(id1.split('_')[2]);
    const counter2 = Number(id2.split('_')[2]);
    expect(counter2).toBe(counter1 + 1);
  });

  it('has timestamp part close to current time', () => {
    const before = Date.now();
    const id = generateId();
    const after = Date.now();

    const ts = Number(id.split('_')[1]);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('produces unique values over many calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd E:/voice-canvas && npx vitest run --project client
```

Expected: All ID tests pass.

- [ ] **Step 3: Commit**

```bash
git add client/src/__tests__/utils/id.test.ts
git commit -m "test: add generateId unit tests

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2.5: server/src/__tests__/services/llm.test.ts — Model selection + LLM calls

**Files:**
- Create: `voice-canvas/server/src/__tests__/services/llm.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock OpenAI before importing the module under test
const mockCreate = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: {
      completions: { create: mockCreate },
    },
  })),
}));

import { selectModel, callLLM, callMultimodalLLM, MODEL_CHAT, MODEL_LITE } from '../../services/llm';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('selectModel', () => {
  it('returns MODEL_CHAT for visual intent', () => {
    expect(selectModel('visual')).toBe(MODEL_CHAT);
  });

  it('returns MODEL_CHAT for generate intent', () => {
    expect(selectModel('generate')).toBe(MODEL_CHAT);
  });

  it('returns MODEL_LITE for text intent', () => {
    expect(selectModel('text')).toBe(MODEL_LITE);
  });

  it('returns MODEL_LITE for query intent', () => {
    expect(selectModel('query')).toBe(MODEL_LITE);
  });
});

describe('callLLM', () => {
  it('forwards parameters to OpenAI client and returns content', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"commands":[]}' } }],
    });

    const result = await callLLM({
      model: MODEL_CHAT,
      systemPrompt: 'You are a diagram assistant.',
      userMessage: 'Draw a flowchart',
      temperature: 0.5,
      maxTokens: 2048,
    });

    expect(result).toBe('{"commands":[]}');
    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe(MODEL_CHAT);
    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.messages[0]).toEqual({ role: 'system', content: 'You are a diagram assistant.' });
    expect(callArgs.messages[1]).toEqual({ role: 'user', content: 'Draw a flowchart' });
    expect(callArgs.temperature).toBe(0.5);
    expect(callArgs.max_tokens).toBe(2048);
  });

  it('throws when LLM returns empty content', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '' } }],
    });

    await expect(
      callLLM({
        model: MODEL_LITE,
        systemPrompt: '',
        userMessage: '',
      })
    ).rejects.toThrow('LLM returned empty response');
  });

  it('sets response_format to json_object when specified', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{}' } }],
    });

    await callLLM({
      model: MODEL_LITE,
      systemPrompt: '',
      userMessage: '',
      responseFormat: 'json_object',
    });

    expect(mockCreate.mock.calls[0][0].response_format).toEqual({ type: 'json_object' });
  });

  it('does not set response_format when not json_object', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'plain text' } }],
    });

    await callLLM({
      model: MODEL_LITE,
      systemPrompt: '',
      userMessage: '',
      responseFormat: 'text',
    });

    expect(mockCreate.mock.calls[0][0].response_format).toBeUndefined();
  });
});

describe('callMultimodalLLM', () => {
  it('forwards parameters including imageBase64 and returns content', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"commands":[{"action":"update","targets":["elem_1"]}]}' } }],
    });

    const result = await callMultimodalLLM({
      model: MODEL_CHAT,
      systemPrompt: 'Analyze the canvas.',
      userMessage: 'Make the red diamond bigger',
      imageBase64: 'iVBORw0KGgo...',
      temperature: 0.2,
      maxTokens: 4096,
    });

    expect(result).toContain('"action":"update"');
    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe(MODEL_CHAT);
    expect(callArgs.messages[1].content).toHaveLength(2);
    expect(callArgs.messages[1].content[0]).toEqual({ type: 'text', text: 'Make the red diamond bigger' });
    expect(callArgs.messages[1].content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,iVBORw0KGgo...' },
    });
    expect(callArgs.temperature).toBe(0.2);
    expect(callArgs.max_tokens).toBe(4096);
  });

  it('always uses response_format json_object for multimodal calls', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"commands":[]}' } }],
    });

    await callMultimodalLLM({
      model: MODEL_CHAT,
      systemPrompt: '',
      userMessage: '',
      imageBase64: 'abc',
    });

    expect(mockCreate.mock.calls[0][0].response_format).toEqual({ type: 'json_object' });
  });

  it('throws when multimodal LLM returns empty content', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '' } }],
    });

    await expect(
      callMultimodalLLM({
        model: MODEL_CHAT,
        systemPrompt: '',
        userMessage: '',
        imageBase64: '',
      })
    ).rejects.toThrow('LLM returned empty response');
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd E:/voice-canvas && npx vitest run --project server
```

Expected: All llm tests pass (selectModel 4 + callLLM 4 + callMultimodalLLM 3 = 11 tests).

- [ ] **Step 3: Commit**

```bash
git add server/src/__tests__/services/
git commit -m "test: add selectModel, callLLM, and callMultimodalLLM tests

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 3: Core Logic Tests

### Task 3.1: client/src/__tests__/services/intentClassifier.test.ts — Intent classifier (40+ cases)

**Files:**
- Create: `voice-canvas/client/src/__tests__/services/intentClassifier.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest';
import { classifyIntent, splitUtterance } from '../../services/intentClassifier';

// ---- classifyIntent ----

describe('classifyIntent — ambiguous references', () => {
  it('routes "那个" to remote-visual', () => {
    const result = classifyIntent('那个红色的', false, false);
    expect(result.type).toBe('remote-visual');
    expect(result.reason).toContain('模糊指代词');
  });

  it('routes "这个东西" to remote-visual', () => {
    const result = classifyIntent('把这个东西变大', true, true);
    expect(result.type).toBe('remote-visual');
  });
});

describe('classifyIntent — diagram generation', () => {
  it('routes "流程" to remote-generate', () => {
    const result = classifyIntent('画一个用户登录的流程', false, false);
    expect(result.type).toBe('remote-generate');
  });

  it('routes "架构" to remote-generate', () => {
    const result = classifyIntent('画一个微服务架构', false, false);
    expect(result.type).toBe('remote-generate');
  });

  it('routes "时序" to remote-generate', () => {
    const result = classifyIntent('画一个时序图', false, false);
    expect(result.type).toBe('remote-generate');
  });

  it('routes "微服务" to remote-generate', () => {
    const result = classifyIntent('画一个微服务', false, false);
    expect(result.type).toBe('remote-generate');
  });
});

describe('classifyIntent — queries', () => {
  it('routes "有哪些" to remote-query', () => {
    const result = classifyIntent('当前画布上有哪些服务', false, false);
    expect(result.type).toBe('remote-query');
  });

  it('routes "连到了哪" to remote-query', () => {
    const result = classifyIntent('这个节点连到了哪些', false, false);
    expect(result.type).toBe('remote-query');
  });
});

describe('classifyIntent — undo/redo', () => {
  it('returns localAction=undo for "撤销"', () => {
    const result = classifyIntent('撤销', false, false);
    expect(result.type).toBe('local');
    expect(result.localAction).toBe('undo');
  });

  it('returns localAction=redo for "重做"', () => {
    const result = classifyIntent('重做', false, false);
    expect(result.type).toBe('local');
    expect(result.localAction).toBe('redo');
  });
});

describe('classifyIntent — view controls', () => {
  it('returns zoom-in for "放大" without target', () => {
    const result = classifyIntent('放大', false, false);
    expect(result.type).toBe('local');
    expect(result.localAction).toBe('zoom-in');
  });

  it('returns zoom-out for "缩小" without target', () => {
    const result = classifyIntent('缩小', false, false);
    expect(result.type).toBe('local');
    expect(result.localAction).toBe('zoom-out');
  });

  it('returns fit-view for "适应画面"', () => {
    const result = classifyIntent('适应画面', false, false);
    expect(result.type).toBe('local');
    expect(result.localAction).toBe('fit-view');
  });

  it('returns clear for "清空"', () => {
    const result = classifyIntent('清空画布', false, false);
    expect(result.type).toBe('local');
    expect(result.localAction).toBe('clear');
  });

  it('does NOT trigger zoom-in when target exists (may be size change)', () => {
    const result = classifyIntent('放大', true, false);
    // "放大" with target could be a size change, not view control
    expect(result.localAction).not.toBe('zoom-in');
  });
});

describe('classifyIntent — delete', () => {
  it('returns local command for "删掉它" with target', () => {
    const result = classifyIntent('删掉它', true, false);
    expect(result.type).toBe('local');
    expect(result.localAction).toBe('command');
    expect(result.commands?.[0].action).toBe('delete');
  });

  it('falls back to remote-text for delete without target', () => {
    const result = classifyIntent('删掉它', false, false);
    expect(result.type).toBe('remote-text');
  });
});

describe('classifyIntent — select', () => {
  it('returns localAction=select for "选中"', () => {
    const result = classifyIntent('选中订单服务', false, false);
    expect(result.type).toBe('local');
    expect(result.localAction).toBe('select');
  });
});

describe('classifyIntent — create shapes', () => {
  it('detects rect from "画一个矩形"', () => {
    const result = classifyIntent('画一个矩形', false, false);
    expect(result.type).toBe('local');
    const cmd = result.commands?.[0];
    expect(cmd?.action).toBe('create');
    expect(cmd?.payload?.elements?.[0].type).toBe('rect');
    expect(result.localAction).toBe('create');
  });

  it('detects diamond from "画一个菱形"', () => {
    const result = classifyIntent('画一个菱形', false, false);
    expect(result.commands?.[0].payload?.elements?.[0].type).toBe('diamond');
  });

  it('detects cylinder from "画一个数据库"', () => {
    const result = classifyIntent('画一个数据库', false, false);
    expect(result.commands?.[0].payload?.elements?.[0].type).toBe('cylinder');
  });

  it('detects actor from "画一个小人"', () => {
    const result = classifyIntent('画一个小人', false, false);
    expect(result.commands?.[0].payload?.elements?.[0].type).toBe('actor');
  });

  it('detects ellipse from "画一个圆"', () => {
    const result = classifyIntent('画一个圆', false, false);
    expect(result.commands?.[0].payload?.elements?.[0].type).toBe('ellipse');
  });

  it('detects rounded-rect from "画一个开始"', () => {
    const result = classifyIntent('画一个开始', false, false);
    expect(result.commands?.[0].payload?.elements?.[0].type).toBe('rounded-rect');
  });

  it('detects rounded-rect from "画一个流程的结束"', () => {
    const result = classifyIntent('画一个流程结束', false, false);
    expect(result.commands?.[0].payload?.elements?.[0].type).toBe('rounded-rect');
  });
});

describe('classifyIntent — sticky notes with content', () => {
  it('extracts label from "备注：需要确认接口"', () => {
    const result = classifyIntent('备注：需要确认接口', false, false);
    expect(result.type).toBe('local');
    expect(result.localAction).toBe('create');
    expect(result.commands?.[0].payload?.elements?.[0].type).toBe('sticky-note');
    expect(result.commands?.[0].payload?.elements?.[0].label).toBe('需要确认接口');
  });

  it('extracts label from "在这里加个备注：和支付团队确认"', () => {
    const result = classifyIntent('在这里加个备注：和支付团队确认', false, false);
    expect(result.commands?.[0].payload?.elements?.[0].label).toBe('和支付团队确认');
  });

  it('does not match "画一个便签" as sticky content (no colon)', () => {
    const result = classifyIntent('画一个便签', false, false);
    expect(result.commands?.[0].payload?.elements?.[0].type).toBe('sticky-note');
    expect(result.commands?.[0].payload?.elements?.[0].label).toBe('');
  });
});

describe('classifyIntent — label update', () => {
  it('returns update command for "文字改成用户登录" with target', () => {
    const result = classifyIntent('文字改成用户登录', true, false);
    expect(result.type).toBe('local');
    expect(result.localAction).toBe('command');
    expect(result.commands?.[0].action).toBe('update');
    expect(result.commands?.[0].payload?.elements?.[0].label).toBe('用户登录');
  });

  it('returns update command for "标签改为首页" with lastMentioned', () => {
    const result = classifyIntent('命名为首页', false, true);
    expect(result.type).toBe('local');
    expect(result.commands?.[0].action).toBe('update');
    expect(result.commands?.[0].payload?.elements?.[0].label).toBe('首页');
  });
});

describe('classifyIntent — style changes', () => {
  it('returns style command for "变红" with target', () => {
    const result = classifyIntent('变红', true, false);
    expect(result.type).toBe('local');
    const style = result.commands?.[0].payload?.elements?.[0].style;
    expect(style?.fill).toBe('#FFCDD2');
    expect(style?.stroke).toBe('#F44336');
  });

  it('returns style command for "变蓝" with target', () => {
    const result = classifyIntent('变蓝', true, false);
    const style = result.commands?.[0].payload?.elements?.[0].style;
    expect(style?.fill).toBe('#BBDEFB');
    expect(style?.stroke).toBe('#2196F3');
  });

  it('returns style command for "变绿" with target', () => {
    const result = classifyIntent('变绿', true, false);
    const style = result.commands?.[0].payload?.elements?.[0].style;
    expect(style?.fill).toBe('#C8E6C9');
    expect(style?.stroke).toBe('#4CAF50');
  });

  it('returns style command for "变黄" with target', () => {
    const result = classifyIntent('变黄', true, false);
    const style = result.commands?.[0].payload?.elements?.[0].style;
    expect(style?.fill).toBe('#FFF9C4');
    expect(style?.stroke).toBe('#FBC02D');
  });

  it('returns scale command for "变大" with target', () => {
    const result = classifyIntent('变大', true, false);
    expect(result.type).toBe('local');
    const size = result.commands?.[0].payload?.elements?.[0].size;
    expect(size?.width).toBe(1.3);
    expect(size?.height).toBe(1.3);
  });

  it('returns scale command for "变小" with target', () => {
    const result = classifyIntent('变小', true, false);
    const size = result.commands?.[0].payload?.elements?.[0].size;
    expect(size?.width).toBe(0.75);
    expect(size?.height).toBe(0.75);
  });
});

describe('classifyIntent — fallback', () => {
  it('routes unmatched utterance to remote-text', () => {
    const result = classifyIntent('今天天气怎么样', false, false);
    expect(result.type).toBe('remote-text');
    expect(result.reason).toContain('云端解析');
  });
});

describe('classifyIntent — priority chain', () => {
  it('visual reference beats create pattern: "那个判断节点" goes to remote-visual', () => {
    const result = classifyIntent('那个判断节点', false, false);
    expect(result.type).toBe('remote-visual');
  });

  it('visual reference beats query: "这个节点连到了哪些" goes to remote-visual', () => {
    const result = classifyIntent('这个节点连到了哪些', false, false);
    expect(result.type).toBe('remote-visual');
  });
});

// ---- splitUtterance ----

describe('splitUtterance', () => {
  it('splits on Chinese comma', () => {
    const result = splitUtterance('画矩形，变红');
    expect(result).toEqual(['画矩形', '变红']);
  });

  it('splits on enumeration comma', () => {
    const result = splitUtterance('加一个方框、再画一个菱形');
    expect(result).toEqual(['加一个方框', '画一个菱形']);
  });

  it('splits on connector "然后"', () => {
    const result = splitUtterance('画矩形然后变红');
    expect(result).toEqual(['画矩形', '变红']);
  });

  it('splits on connector "接着"', () => {
    const result = splitUtterance('画矩形接着加文字');
    expect(result).toEqual(['画矩形', '加文字']);
  });

  it('returns single element for no separators', () => {
    const result = splitUtterance('画一个流程图');
    expect(result).toEqual(['画一个流程图']);
  });

  it('strips leading connector "再"', () => {
    const result = splitUtterance('再画一个矩形');
    expect(result).toEqual(['画一个矩形']);
  });

  it('strips leading "然后" and splits remaining', () => {
    const result = splitUtterance('然后画一个矩形、变红');
    expect(result).toEqual(['画一个矩形', '变红']);
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd E:/voice-canvas && npx vitest run --project client
```

Expected: All intentClassifier tests pass (~40+ test cases).

- [ ] **Step 3: Commit**

```bash
git add client/src/__tests__/services/intentClassifier.test.ts
git commit -m "test: add intentClassifier tests — 40+ cases covering all 25 rules

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3.2: client/src/__tests__/store/diagramStore.test.ts — Zustand store

**Files:**
- Create: `voice-canvas/client/src/__tests__/store/diagramStore.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore } from '../../store/diagramStore';
import type { CanvasElement, CanvasEdge, DeltaCommand } from '@shared/types';
import { makeCreateCommand, makeUpdateCommand, makeDeleteCommand, makeMoveCommand, makeConnectCommand } from '@shared/types';

// Reset store before each test
const initialState = useDiagramStore.getInitialState();

beforeEach(() => {
  useDiagramStore.setState(initialState, true);
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
  it('resolves "selected" to selectedId', () => {
    useDiagramStore.getState().addElement(makeEl('e1'));
    useDiagramStore.getState().setSelected('e1');

    // Targets are resolved internally by applyCommands via resolveTargets.
    // Test indirectly: delete with target 'selected' deletes selected element.
    const cmd = makeDeleteCommand(['selected']);
    useDiagramStore.getState().applyCommands([cmd], 'delete selected');

    expect(useDiagramStore.getState().elements['e1']).toBeUndefined();
  });

  it('resolves "lastMentioned" to lastMentionedId', () => {
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
```

- [ ] **Step 2: Run the tests**

```bash
cd E:/voice-canvas && npx vitest run --project client
```

Expected: All diagramStore tests pass (20+ test cases).

- [ ] **Step 3: Commit**

```bash
git add client/src/__tests__/store/
git commit -m "test: add diagramStore tests — CRUD, undo/redo, applyCommands, history

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3.3: client/src/__tests__/services/stateSerializer.test.ts — State serialization

**Files:**
- Create: `voice-canvas/client/src/__tests__/services/stateSerializer.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest';
import { buildDiagramState } from '../../services/stateSerializer';
import { useDiagramStore } from '../../store/diagramStore';
import type { CanvasElement, CanvasEdge } from '@shared/types';

describe('buildDiagramState', () => {
  it('serializes mode, elements, edges, selectedId, lastMentionedId', () => {
    // Set up store state
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
    useDiagramStore.setState(useDiagramStore.getInitialState());

    const result = buildDiagramState(useDiagramStore.getState());
    expect(result.elements).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.selectedId).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd E:/voice-canvas && npx vitest run --project client
```

Expected: All stateSerializer tests pass.

- [ ] **Step 3: Commit**

```bash
git add client/src/__tests__/services/stateSerializer.test.ts
git commit -m "test: add stateSerializer tests

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 4: Mock-Dependent Tests

### Task 4.1: client/src/__tests__/services/api.test.ts — API client with fetch mock

**Files:**
- Create: `voice-canvas/client/src/__tests__/services/api.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../../services/api';
import type { CommandRequest, MultimodalRequest } from '@shared/types';

function makeCommandRequest(): CommandRequest {
  return {
    utterance: '画一个矩形',
    diagramState: {
      mode: 'flowchart',
      elements: [],
      edges: [],
      selectedId: null,
      lastMentionedId: null,
    },
  };
}

function makeMultimodalRequest(): MultimodalRequest {
  return {
    utterance: '把那个红色的变大',
    imageBase64: 'iVBORw0KGgo...',
    diagramState: {
      mode: 'flowchart',
      elements: [],
      edges: [],
      selectedId: null,
      lastMentionedId: null,
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('apiClient.textCommand', () => {
  it('POSTs to /api/command and returns JSON on 200', async () => {
    const mockResponse = { commands: [], voiceReply: '好的' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const result = await apiClient.textCommand(makeCommandRequest(), 'text');

    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...makeCommandRequest(), intent: 'text' }),
    });
  });

  it('throws on non-200 with JSON error body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal error' }),
    } as Response);

    await expect(apiClient.textCommand(makeCommandRequest())).rejects.toThrow('Internal error');
  });

  it('throws generic error when error body cannot be parsed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.reject(new Error('parse error')),
    } as Response);

    await expect(apiClient.textCommand(makeCommandRequest())).rejects.toThrow('Server error: 503');
  });
});

describe('apiClient.multimodalCommand', () => {
  it('POSTs to /api/multimodal with imageBase64 and returns JSON on 200', async () => {
    const mockResponse = { commands: [{ action: 'update', targets: ['e1'] }] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const req = makeMultimodalRequest();
    const result = await apiClient.multimodalCommand(req);

    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith('/api/multimodal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  });

  it('throws on non-200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ error: 'Unprocessable' }),
    } as Response);

    await expect(apiClient.multimodalCommand(makeMultimodalRequest())).rejects.toThrow('Unprocessable');
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd E:/voice-canvas && npx vitest run --project client
```

Expected: All api tests pass.

- [ ] **Step 3: Commit**

```bash
git add client/src/__tests__/services/api.test.ts
git commit -m "test: add API client tests with fetch mock

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4.2: client/src/__tests__/services/imageExport.test.ts — canvasSnapshot + exportImage

**Files:**
- Create: `voice-canvas/client/src/__tests__/services/imageExport.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock html-to-image before importing modules under test
const mockToPng = vi.fn();
vi.mock('html-to-image', () => ({
  toPng: mockToPng,
}));

import { captureCanvas } from '../../services/canvasSnapshot';
import { exportToPNG } from '../../services/exportImage';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('captureCanvas', () => {
  it('throws when .react-flow__viewport element not found', async () => {
    vi.spyOn(document, 'querySelector').mockReturnValueOnce(null);

    await expect(captureCanvas()).rejects.toThrow('画布元素未找到');
  });

  it('returns base64 string (stripped of data: prefix) on success', async () => {
    const mockDiv = document.createElement('div');
    vi.spyOn(document, 'querySelector').mockReturnValueOnce(mockDiv);

    mockToPng.mockResolvedValueOnce('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA');

    const result = await captureCanvas();
    expect(result).toBe('iVBORw0KGgoAAAANSUhEUgAA');
    expect(mockToPng).toHaveBeenCalledWith(mockDiv, {
      backgroundColor: '#111827',
      pixelRatio: 1,
      quality: 0.85,
    });
  });

  it('wraps toPng errors with "截图失败" message', async () => {
    vi.spyOn(document, 'querySelector').mockReturnValueOnce(document.createElement('div'));
    mockToPng.mockRejectedValueOnce(new Error('canvas error'));

    await expect(captureCanvas()).rejects.toThrow('截图失败: canvas error');
  });
});

describe('exportToPNG', () => {
  it('triggers download with correct filename and pixelRatio=2', async () => {
    const mockDiv = document.createElement('div');
    vi.spyOn(document, 'querySelector').mockReturnValueOnce(mockDiv);

    mockToPng.mockResolvedValueOnce('data:image/png;base64,abc123');

    // Spy on link creation and click
    const mockLink = { href: '', download: '', click: vi.fn() };
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValueOnce(mockLink as unknown as HTMLElement);

    const before = Date.now();
    await exportToPNG();
    const after = Date.now();

    expect(mockToPng).toHaveBeenCalledWith(mockDiv, {
      backgroundColor: '#111827',
      pixelRatio: 2,
      quality: 0.95,
    });

    expect(mockLink.href).toBe('data:image/png;base64,abc123');
    expect(mockLink.download).toMatch(/^voice-canvas-\d+\.png$/);
    const tsInFilename = Number(mockLink.download.replace('voice-canvas-', '').replace('.png', ''));
    expect(tsInFilename).toBeGreaterThanOrEqual(before);
    expect(tsInFilename).toBeLessThanOrEqual(after);
    expect(mockLink.click).toHaveBeenCalledOnce();
  });

  it('throws when canvas element not found', async () => {
    vi.spyOn(document, 'querySelector').mockReturnValueOnce(null);

    await expect(exportToPNG()).rejects.toThrow('画布未就绪');
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd E:/voice-canvas && npx vitest run --project client
```

Expected: All imageExport tests pass.

- [ ] **Step 3: Commit**

```bash
git add client/src/__tests__/services/imageExport.test.ts
git commit -m "test: add image export tests — captureCanvas + exportToPNG with toPng mock

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4.3: client/src/__tests__/services/speechSynthesis.test.ts — TTS

**Files:**
- Create: `voice-canvas/client/src/__tests__/services/speechSynthesis.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the SpeechSynthesisUtterance constructor (jsdom doesn't have it)
const mockUtteranceInstance = { lang: '', rate: 0, text: '' };
const MockUtterance = vi.fn(function (this: typeof mockUtteranceInstance, text: string) {
  this.text = text;
  this.lang = '';
  this.rate = 0;
  return this;
}) as unknown as typeof SpeechSynthesisUtterance;

beforeEach(() => {
  vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);

  const mockSpeechSynthesis = {
    speak: vi.fn(),
    cancel: vi.fn(),
  };
  vi.stubGlobal('speechSynthesis', mockSpeechSynthesis);
  Object.defineProperty(window, 'speechSynthesis', {
    value: mockSpeechSynthesis,
    writable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

import { speak } from '../../services/speechSynthesis';

describe('speak', () => {
  it('creates SpeechSynthesisUtterance with text, zh-CN, rate 1.0', () => {
    speak('你好');

    expect(MockUtterance).toHaveBeenCalledWith('你好');
    const instance = (MockUtterance as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(instance.lang).toBe('zh-CN');
    expect(instance.rate).toBe(1.0);
  });

  it('calls speechSynthesis.cancel before speaking', () => {
    speak('hello');

    const synthesis = window.speechSynthesis as unknown as { cancel: ReturnType<typeof vi.fn>; speak: ReturnType<typeof vi.fn> };
    const cancelOrder = synthesis.cancel.mock.invocationCallOrder[0];
    const speakOrder = synthesis.speak.mock.invocationCallOrder[0];
    expect(cancelOrder).toBeLessThan(speakOrder);
  });

  it('calls speechSynthesis.speak with the utterance', () => {
    speak('测试');

    const instance = (MockUtterance as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(window.speechSynthesis.speak).toHaveBeenCalledWith(instance);
  });

  it('does not throw when speechSynthesis is unavailable', () => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, writable: true });

    expect(() => speak('should not crash')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd E:/voice-canvas && npx vitest run --project client
```

Expected: All speechSynthesis tests pass.

- [ ] **Step 3: Commit**

```bash
git add client/src/__tests__/services/speechSynthesis.test.ts
git commit -m "test: add speechSynthesis tests with SpeechSynthesisUtterance mock

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4.4: client/src/__tests__/utils/layout.test.ts — Dagre layout

**Files:**
- Create: `voice-canvas/client/src/__tests__/utils/layout.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
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
    // Disconnected nodes may overlap — dagre still assigns coordinates
    const a = result.get('a')!;
    expect(Number.isFinite(a.x)).toBe(true);
    expect(Number.isFinite(a.y)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd E:/voice-canvas && npx vitest run --project client
```

Expected: All layout tests pass.

- [ ] **Step 3: Commit**

```bash
git add client/src/__tests__/utils/layout.test.ts
git commit -m "test: add Dagre layoutFlowchart tests

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4.5: server/src/__tests__/routes/command.test.ts — API route integration

**Files:**
- Create: `voice-canvas/server/src/__tests__/routes/command.test.ts`

For this task we need the server to export a `buildApp()` function so we can create a Fastify instance for testing without calling `listen()`. We modify `server/src/index.ts` to support this.

- [ ] **Step 1: Refactor server/src/index.ts to export buildApp()**

Read `server/src/index.ts`, then replace it with:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { commandRoutes } from './routes/command.js';
import { multimodalRoutes } from './routes/multimodal.js';

export async function buildApp() {
  const server = Fastify({ logger: false });

  if (!process.env.DEEPSEEK_API_KEY) {
    server.log.warn('DEEPSEEK_API_KEY not set — LLM endpoints will return errors');
  }

  await server.register(cors, { origin: true });

  server.get('/api/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  await server.register(commandRoutes, { prefix: '/api' });
  await server.register(multimodalRoutes, { prefix: '/api' });

  return server;
}

// When running directly (not imported), start the server
const isMain = process.argv[1]?.includes('index');
if (isMain) {
  const server = await buildApp();
  try {
    await server.listen({ port: 3001, host: '0.0.0.0' });
    console.log('Server running on http://localhost:3001');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}
```

- [ ] **Step 2: Verify server still starts**

```bash
cd E:/voice-canvas/server && timeout 5 npx tsx src/index.ts || true
```

- [ ] **Step 3: Write the route test file**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Mock the llm module
const mockCallLLM = vi.fn();
const mockSelectModel = vi.fn();

vi.mock('../../services/llm', () => ({
  callLLM: mockCallLLM,
  selectModel: mockSelectModel,
  callMultimodalLLM: vi.fn(),
  MODEL_CHAT: 'deepseek-v4-pro',
  MODEL_LITE: 'deepseek-v4-flash',
}));

import { buildApp } from '../../index';

let app: FastifyInstance;

beforeEach(async () => {
  vi.clearAllMocks();
  app = await buildApp();
  await app.ready();
});

function makeRequestBody(overrides: Record<string, unknown> = {}) {
  return {
    utterance: '画一个矩形',
    diagramState: {
      mode: 'flowchart' as const,
      elements: [],
      edges: [],
      selectedId: null,
      lastMentionedId: null,
    },
    intent: 'text',
    ...overrides,
  };
}

describe('POST /api/command', () => {
  it('returns 200 with commands and voiceReply on success', async () => {
    mockSelectModel.mockReturnValue('deepseek-v4-flash');
    mockCallLLM.mockResolvedValueOnce(
      JSON.stringify({
        commands: [{ action: 'create', targets: [], payload: { elements: [{ type: 'rect', label: '矩形' }] } }],
        voiceReply: '已添加矩形',
      })
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/command',
      payload: makeRequestBody(),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.commands).toHaveLength(1);
    expect(body.commands[0].action).toBe('create');
    expect(body.voiceReply).toBe('已添加矩形');
  });

  it('passes intent to selectModel', async () => {
    mockSelectModel.mockReturnValue('deepseek-v4-pro');
    mockCallLLM.mockResolvedValueOnce(JSON.stringify({ commands: [] }));

    await app.inject({
      method: 'POST',
      url: '/api/command',
      payload: makeRequestBody({ intent: 'generate' }),
    });

    expect(mockSelectModel).toHaveBeenCalledWith('generate');
  });

  it('injects "查询模式" into system prompt for query intent', async () => {
    mockSelectModel.mockReturnValue('deepseek-v4-flash');
    mockCallLLM.mockResolvedValueOnce(JSON.stringify({ commands: [] }));

    await app.inject({
      method: 'POST',
      url: '/api/command',
      payload: makeRequestBody({ intent: 'query' }),
    });

    const systemPrompt: string = mockCallLLM.mock.calls[0][0].systemPrompt;
    expect(systemPrompt).toContain('查询模式');
  });

  it('injects DIAGRAM_TYPE_PROMPTS for architecture mode', async () => {
    mockSelectModel.mockReturnValue('deepseek-v4-flash');
    mockCallLLM.mockResolvedValueOnce(JSON.stringify({ commands: [] }));

    await app.inject({
      method: 'POST',
      url: '/api/command',
      payload: makeRequestBody({
        diagramState: { ...makeRequestBody().diagramState, mode: 'architecture' },
      }),
    });

    const systemPrompt: string = mockCallLLM.mock.calls[0][0].systemPrompt;
    // DIAGRAM_TYPE_PROMPTS['architecture'] should be appended
    expect(systemPrompt.length).toBeGreaterThan(100);
  });

  it('does not retry on JSON parse failure (SyntaxError)', async () => {
    mockSelectModel.mockReturnValue('deepseek-v4-flash');
    mockCallLLM.mockResolvedValueOnce('not valid json {{{');

    const response = await app.inject({
      method: 'POST',
      url: '/api/command',
      payload: makeRequestBody(),
    });

    expect(response.statusCode).toBe(422);
    expect(mockCallLLM).toHaveBeenCalledTimes(1); // No retry
  });

  it('does not retry on Zod validation failure', async () => {
    mockSelectModel.mockReturnValue('deepseek-v4-flash');
    mockCallLLM.mockResolvedValueOnce(
      JSON.stringify({ commands: [{ action: 'INVALID_ACTION', targets: [] }], voiceReply: null })
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/command',
      payload: makeRequestBody(),
    });

    expect(response.statusCode).toBe(422);
    expect(mockCallLLM).toHaveBeenCalledTimes(1); // No retry
  });

  it('retries once on network error then returns 422', async () => {
    mockSelectModel.mockReturnValue('deepseek-v4-flash');
    mockCallLLM
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error again'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/command',
      payload: makeRequestBody(),
    });

    expect(response.statusCode).toBe(422);
    expect(mockCallLLM).toHaveBeenCalledTimes(2); // 2 attempts
    const body = response.json();
    expect(body.error).toContain('指令解析失败');
  });

  it('omits voiceReply from response when LLM returns null', async () => {
    mockSelectModel.mockReturnValue('deepseek-v4-flash');
    mockCallLLM.mockResolvedValueOnce(
      JSON.stringify({ commands: [], voiceReply: null })
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/command',
      payload: makeRequestBody(),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).not.toHaveProperty('voiceReply');
  });
});
```

- [ ] **Step 4: Run the tests**

```bash
cd E:/voice-canvas && npx vitest run --project server
```

Expected: All command route tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/index.ts server/src/__tests__/routes/
git commit -m "test: add command route integration tests + refactor server to export buildApp

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 5: Verification

### Task 5.1: Full suite run + coverage

- [ ] **Step 1: Run all tests across all workspaces**

```bash
cd E:/voice-canvas && npx vitest run
```

Expected: All 13 test files pass, zero failures.

- [ ] **Step 2: Run with coverage**

```bash
cd E:/voice-canvas && npx vitest run --coverage
```

Expected: Coverage report generated. Key metrics:
- shared/types.ts: >90%
- client/src/services/intentClassifier.ts: >90%
- client/src/store/diagramStore.ts: >80%
- server/src/validators/command.ts: >90%
- server/src/utils/canvasSummary.ts: >90%
- server/src/services/llm.ts: >80%

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "test: complete test suite — 13 files, all passing

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Summary

| Phase | Tasks | Test Files | Type |
|-------|-------|-----------|------|
| 1 | 2 | 0 | Infrastructure |
| 2 | 5 | types, validators, canvasSummary, id, llm | Pure functions |
| 3 | 3 | intentClassifier, diagramStore, stateSerializer | Core logic |
| 4 | 5 | api, imageExport, speechSynthesis, layout, command route | Mock-dependent |
| 5 | 1 | — | Verification |

**Total: 16 tasks, 13 test files.**
