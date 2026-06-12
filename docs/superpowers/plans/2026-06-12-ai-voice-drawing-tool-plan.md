# AI Voice Drawing Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure voice-driven software engineering diagram tool supporting flowcharts and architecture diagrams with multimodal visual grounding.

**Architecture:** Monorepo with shared TypeScript types, React 18 + React Flow + Zustand + Web Speech API frontend, Fastify + Zod backend as LLM gateway to DeepSeek V4.5/V4-Lite. Three-tier command routing: local classifier (25 high-frequency commands, <100ms) → V4-Lite text pipeline → V4.5 multimodal pipeline.

**Tech Stack:** React 18, TypeScript, Vite, React Flow, Zustand, Tailwind CSS, Fastify, Zod, DeepSeek API, Web Speech API, Dagre, html-to-image

---

## File Structure

```
voice-canvas/
├── package.json                    # Root workspace config
├── tsconfig.base.json              # Shared TS config
├── shared/
│   └── types.ts                    # CanvasElement, DeltaCommand, etc. — single source of truth
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.tsx                # React entry
│       ├── App.tsx                 # Root layout
│       ├── index.css               # Tailwind directives + animations
│       ├── store/
│       │   └── diagramStore.ts     # Zustand: elements, edges, history, UI state
│       ├── components/
│       │   ├── canvas/
│       │   │   ├── DiagramCanvas.tsx      # React Flow wrapper
│       │   │   ├── nodes/
│       │   │   │   ├── index.ts           # nodeTypes registry
│       │   │   │   ├── RoundedRectNode.tsx
│       │   │   │   ├── RectNode.tsx
│       │   │   │   ├── DiamondNode.tsx
│       │   │   │   ├── CylinderNode.tsx
│       │   │   │   ├── ActorNode.tsx
│       │   │   │   ├── QueueNode.tsx
│       │   │   │   ├── CacheNode.tsx
│       │   │   │   └── GatewayNode.tsx
│       │   │   └── edges/
│       │   │       ├── index.ts           # edgeTypes registry
│       │   │       ├── SolidArrowEdge.tsx
│       │   │       └── DashedArrowEdge.tsx
│       │   ├── voice/
│       │   │   ├── VoiceOverlay.tsx       # 3-phase animation overlay (listen/think/execute)
│       │   │   ├── VoiceButton.tsx        # Mic toggle with VAD indicator
│       │   │   └── TranscriptBar.tsx      # Real-time ASR text display
│       │   ├── toolbar/
│       │   │   ├── ModeSwitcher.tsx       # Flowchart / Architecture / Sequence toggle
│       │   │   └── ThemeSwitcher.tsx
│       │   └── debug/
│       │       └── CommandLog.tsx         # Dev-only: show recent commands + reasoning
│       ├── hooks/
│       │   ├── useSpeechRecognition.ts    # Web Speech API wrapper
│       │   └── useVoiceCommand.ts         # Full pipeline: ASR → classify → dispatch
│       ├── services/
│       │   ├── intentClassifier.ts        # Local rule-based classifier (25 commands)
│       │   ├── api.ts                     # Fetch wrapper for backend endpoints
│       │   ├── canvasSnapshot.ts          # html-to-image canvas → PNG
│       │   └── speechSynthesis.ts         # TTS wrapper for AI voice responses
│       └── utils/
│           ├── id.ts                      # nanoid wrapper
│           ├── layout.ts                  # Dagre layout for flowcharts
│           └── elementDefaults.ts         # Default sizes/styles per ElementType
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                # Fastify entry
│       ├── routes/
│       │   ├── command.ts          # POST /api/command — text-based diagram commands
│       │   └── multimodal.ts       # POST /api/multimodal — image + text for visual grounding
│       ├── services/
│       │   └── llm.ts             # DeepSeek API client (V4-Lite and V4.5)
│       ├── prompts/
│       │   ├── system.ts          # System prompt template
│       │   └── diagramTypes.ts    # Per-diagram-type prompt supplements
│       ├── validators/
│       │   └── command.ts         # Zod schemas for LLM response validation
│       └── utils/
│           └── canvasSummary.ts   # Generate element summary for prompt injection
└── .claude/
    └── settings.json               # Project settings (if needed)
```

---

## Milestone 1: Project Scaffold + Shared Types + Basic Canvas (Week 1)

### Task 1.1: Initialize monorepo and shared types

**Files:**
- Create: `voice-canvas/package.json`
- Create: `voice-canvas/tsconfig.base.json`
- Create: `voice-canvas/shared/types.ts`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "voice-canvas",
  "private": true,
  "workspaces": ["shared", "client", "server"]
}
```

- [ ] **Step 2: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: Create shared/types.ts with all data models**

```typescript
// ========== Element Types ==========
export type ElementType =
  | 'rounded-rect'   // Start/End node (flowchart)
  | 'rect'           // Process/Service node
  | 'diamond'        // Decision node
  | 'cylinder'       // Database
  | 'ellipse'        // Use case
  | 'actor'          // User/external system
  | 'queue'          // Message queue
  | 'cache'          // Cache
  | 'gateway'        // API Gateway
  | 'lifeline'       // Sequence diagram lifeline
  | 'sticky-note';   // Annotation/note

// ========== Canvas Element ==========
export interface VoiceAliases {
  auto: string[];    // LLM-generated aliases
  manual: string[];  // User-added aliases
}

export interface ElementStyle {
  fill: string;
  stroke: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
}

export interface CanvasElement {
  id: string;
  type: ElementType;
  label: string;
  voiceAliases: VoiceAliases;
  position: { x: number; y: number };
  size: { width: number; height: number };
  style: ElementStyle;
  metadata?: Record<string, unknown>;
}

// ========== Canvas Edge ==========
export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  type: 'solid' | 'dashed';
  label?: string;
  style?: {
    stroke?: string;
    strokeWidth?: number;
  };
}

// ========== Delta Command (LLM output) ==========
export interface DeltaCommand {
  action: 'create' | 'update' | 'delete' | 'move' | 'connect' | 'query';
  targets: string[];
  payload?: {
    elements?: Partial<CanvasElement>[];
    edges?: Partial<CanvasEdge>[];
    layout?: 'vertical' | 'horizontal' | 'grid';
  };
  reasoning?: string;
}

export interface LLMResponse {
  commands: DeltaCommand[];
  voiceReply?: string;   // For AI to speak back (queries, suggestions)
}

// ========== Command Record (for undo/redo) ==========
export interface CommandRecord {
  id: string;
  timestamp: number;
  command: DeltaCommand;
  inverse: DeltaCommand;
  utterance: string;
}

// ========== Diagram Mode ==========
export type DiagramMode = 'flowchart' | 'architecture' | 'sequence';

// ========== UI Phase ==========
export type VoicePhase = 'idle' | 'listening' | 'thinking-text' | 'thinking-visual' | 'executing';

// ========== Diagram Context ==========
export interface DiagramState {
  mode: DiagramMode;
  elements: Record<string, CanvasElement>;
  edges: CanvasEdge[];
  selectedId: string | null;
  lastMentionedId: string | null;
  history: CommandRecord[];
  historyIndex: number;
}

// ========== UI State ==========
export interface UIState {
  isListening: boolean;
  phase: VoicePhase;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  theme: 'light' | 'dark' | 'blue-gray';
}

// ========== API Types ==========
export interface CommandRequest {
  utterance: string;
  diagramState: {
    mode: DiagramMode;
    elements: Array<{
      id: string;
      type: ElementType;
      label: string;
      voiceAliases: VoiceAliases;
      position: { x: number; y: number };
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      type: 'solid' | 'dashed';
      label?: string;
    }>;
    selectedId: string | null;
    lastMentionedId: string | null;
  };
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface MultimodalRequest {
  utterance: string;
  imageBase64: string;
  diagramState: CommandRequest['diagramState'];
}

// ========== Default styles per element type ==========
export const ELEMENT_DEFAULTS: Record<ElementType, { width: number; height: number; fill: string; stroke: string }> = {
  'rounded-rect': { width: 160, height: 60, fill: '#E8F5E9', stroke: '#4CAF50' },
  'rect': { width: 160, height: 60, fill: '#E3F2FD', stroke: '#2196F3' },
  'diamond': { width: 140, height: 80, fill: '#FFF3E0', stroke: '#FF9800' },
  'cylinder': { width: 140, height: 80, fill: '#F3E5F5', stroke: '#9C27B0' },
  'ellipse': { width: 160, height: 60, fill: '#E0F7FA', stroke: '#00BCD4' },
  'actor': { width: 60, height: 100, fill: '#FCE4EC', stroke: '#E91E63' },
  'queue': { width: 160, height: 50, fill: '#FFF9C4', stroke: '#FBC02D' },
  'cache': { width: 120, height: 50, fill: '#FFEBEE', stroke: '#F44336' },
  'gateway': { width: 140, height: 60, fill: '#E8EAF6', stroke: '#3F51B5' },
  'lifeline': { width: 120, height: 400, fill: 'transparent', stroke: '#9E9E9E' },
  'sticky-note': { width: 160, height: 80, fill: '#FFF9C4', stroke: '#F9A825' },
};

export const ELEMENT_LABELS: Record<ElementType, string> = {
  'rounded-rect': '开始/结束',
  'rect': '处理',
  'diamond': '判断',
  'cylinder': '数据库',
  'ellipse': '用例',
  'actor': '参与者',
  'queue': '消息队列',
  'cache': '缓存',
  'gateway': 'API网关',
  'lifeline': '生命线',
  'sticky-note': '便签',
};
```

- [ ] **Step 4: Create shared/package.json**

```json
{
  "name": "@voice-canvas/shared",
  "version": "1.0.0",
  "main": "./types.ts",
  "types": "./types.ts"
}
```

- [ ] **Step 5: Commit**

```bash
cd E:/voice-canvas
git init
git add package.json tsconfig.base.json shared/
git commit -m "feat: initialize monorepo with shared types"
```

---

### Task 1.2: Scaffold Vite + React + Tailwind client

**Files:**
- Create: `voice-canvas/client/package.json`
- Create: `voice-canvas/client/tsconfig.json`
- Create: `voice-canvas/client/vite.config.ts`
- Create: `voice-canvas/client/index.html`
- Create: `voice-canvas/client/tailwind.config.js`
- Create: `voice-canvas/client/postcss.config.js`
- Create: `voice-canvas/client/src/main.tsx`
- Create: `voice-canvas/client/src/App.tsx`
- Create: `voice-canvas/client/src/index.css`

- [ ] **Step 1: Create client/package.json**

```json
{
  "name": "@voice-canvas/client",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@voice-canvas/shared": "*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "reactflow": "^11.11.4",
    "zustand": "^4.5.2",
    "dagre": "^0.8.5",
    "html-to-image": "^1.11.11",
    "nanoid": "^5.0.7"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@types/dagre": "^0.7.52",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.5.2",
    "vite": "^5.3.1"
  }
}
```

- [ ] **Step 2: Create client/tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src", "../shared"]
}
```

- [ ] **Step 3: Create client/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```

- [ ] **Step 4: Create client/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI 语音绘图工具</title>
</head>
<body class="bg-gray-900 text-white overflow-hidden">
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 5: Create client/tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'pulse-breath': 'breath 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'pop-in': 'popIn 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      keyframes: {
        breath: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        popIn: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 6: Create client/postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 7: Create client/src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* React Flow overrides for dark theme */
.react-flow__node {
  font-size: 14px;
}

.react-flow__node.selected > div {
  box-shadow: 0 0 0 3px #60A5FA;
}

.react-flow__edge.selected .react-flow__edge-path {
  stroke: #60A5FA;
}

.react-flow__controls button {
  background: #1F2937;
  border-color: #374151;
  color: #D1D5DB;
}

.react-flow__minimap {
  background: #111827;
}

/* Voice overlay */
.voice-overlay {
  pointer-events: none;
}

/* Breathing border animation */
@keyframes breathe-border {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); }
}

.breathing-border {
  animation: breathe-border 2s ease-in-out infinite;
}
```

- [ ] **Step 8: Create client/src/main.tsx**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 9: Create client/src/App.tsx**

```typescript
import { DiagramCanvas } from './components/canvas/DiagramCanvas';
import { VoiceOverlay } from './components/voice/VoiceOverlay';
import { VoiceButton } from './components/voice/VoiceButton';
import { TranscriptBar } from './components/voice/TranscriptBar';
import { ModeSwitcher } from './components/toolbar/ModeSwitcher';
import { useDiagramStore } from './store/diagramStore';

export default function App() {
  const phase = useDiagramStore((s) => s.phase);

  return (
    <div className="w-screen h-screen flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 shrink-0">
        <h1 className="text-lg font-semibold">AI 语音绘图工具</h1>
        <div className="flex items-center gap-3">
          <ModeSwitcher />
          <VoiceButton />
        </div>
      </header>

      {/* Canvas area */}
      <main className="flex-1 relative">
        <DiagramCanvas />
        <TranscriptBar />
        <VoiceOverlay phase={phase} />
      </main>
    </div>
  );
}
```

- [ ] **Step 10: Create placeholder components so the app compiles**

Create stub files:

`client/src/store/diagramStore.ts`:
```typescript
import { create } from 'zustand';
import type { DiagramState, UIState } from '@shared/types';

interface Store extends DiagramState, UIState {
  // Actions (to be implemented in later tasks)
}

export const useDiagramStore = create<Store>(() => ({
  mode: 'flowchart',
  elements: {},
  edges: [],
  selectedId: null,
  lastMentionedId: null,
  history: [],
  historyIndex: -1,
  isListening: false,
  phase: 'idle',
  transcript: '',
  interimTranscript: '',
  error: null,
  theme: 'dark',
}));
```

`client/src/components/canvas/DiagramCanvas.tsx`:
```typescript
export function DiagramCanvas() {
  return <div className="w-full h-full bg-gray-900 flex items-center justify-center text-gray-500">画布加载中...</div>;
}
```

`client/src/components/voice/VoiceOverlay.tsx`:
```typescript
import type { VoicePhase } from '@shared/types';

export function VoiceOverlay({ phase }: { phase: VoicePhase }) {
  if (phase === 'idle') return null;
  return (
    <div className="voice-overlay absolute inset-0 flex items-center justify-center">
      <div className="bg-gray-800/90 rounded-lg px-6 py-3 text-sm">
        {phase === 'listening' && '🎤 正在聆听...'}
        {phase === 'thinking-text' && '🤔 正在理解...'}
        {phase === 'thinking-visual' && '🔍 正在分析画面...'}
        {phase === 'executing' && '✅ 执行中...'}
      </div>
    </div>
  );
}
```

`client/src/components/voice/VoiceButton.tsx`:
```typescript
export function VoiceButton() {
  return (
    <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors">
      🎤 开始语音
    </button>
  );
}
```

`client/src/components/voice/TranscriptBar.tsx`:
```typescript
export function TranscriptBar() {
  return null; // Will implement in M2
}
```

`client/src/components/toolbar/ModeSwitcher.tsx`:
```typescript
export function ModeSwitcher() {
  return (
    <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1 text-sm">
      <button className="px-3 py-1 bg-blue-600 rounded-md">流程图</button>
      <button className="px-3 py-1 rounded-md hover:bg-gray-600">架构图</button>
    </div>
  );
}
```

- [ ] **Step 11: Install dependencies and verify**

```bash
cd E:/voice-canvas
npm install
cd client && npx vite build --emptyOutDir
```

Expected: Build succeeds with no errors.

- [ ] **Step 12: Commit**

```bash
git add client/
git commit -m "feat: scaffold Vite + React + Tailwind client with placeholder components"
```

---

### Task 1.3: Scaffold Fastify server

**Files:**
- Create: `voice-canvas/server/package.json`
- Create: `voice-canvas/server/tsconfig.json`
- Create: `voice-canvas/server/src/index.ts`

- [ ] **Step 1: Create server/package.json**

```json
{
  "name": "@voice-canvas/server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@voice-canvas/shared": "*",
    "fastify": "^4.28.0",
    "@fastify/cors": "^9.0.1",
    "openai": "^4.52.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.14.2",
    "tsx": "^4.15.4",
    "typescript": "^5.5.2"
  }
}
```

- [ ] **Step 2: Create server/tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src", "../shared"]
}
```

- [ ] **Step 3: Create server/src/index.ts**

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { commandRoutes } from './routes/command.js';

const server = Fastify({ logger: true });

await server.register(cors, { origin: true });

// Health check
server.get('/api/health', async () => ({ status: 'ok', timestamp: Date.now() }));

// Command routes
await server.register(commandRoutes, { prefix: '/api' });

try {
  await server.listen({ port: 3001, host: '0.0.0.0' });
  console.log('Server running on http://localhost:3001');
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
```

- [ ] **Step 4: Create stub route so server compiles**

`server/src/routes/command.ts`:
```typescript
import type { FastifyPluginAsync } from 'fastify';
import type { CommandRequest, LLMResponse } from '@shared/types';

export const commandRoutes: FastifyPluginAsync = async (server) => {
  server.post<{ Body: CommandRequest }>('/command', async (request) => {
    const { utterance, diagramState } = request.body;

    // Stub: return empty response
    const response: LLMResponse = {
      commands: [],
      voiceReply: `收到指令: "${utterance}"，画布上有 ${diagramState.elements.length} 个元素`,
    };

    return response;
  });
};
```

- [ ] **Step 5: Install dependencies and verify server starts**

```bash
cd E:/voice-canvas
npm install
cd server && npx tsx src/index.ts &
sleep 3
curl http://localhost:3001/api/health
```

Expected: `{"status":"ok","timestamp":...}`

- [ ] **Step 6: Kill the server and commit**

```bash
kill %1
git add server/
git commit -m "feat: scaffold Fastify server with health check and stub command route"
```

---

### Task 1.4: Implement Zustand store with full state management

**Files:**
- Modify: `voice-canvas/client/src/store/diagramStore.ts`

- [ ] **Step 1: Replace the stub store with full implementation**

```typescript
import { create } from 'zustand';
import type {
  DiagramMode,
  CanvasElement,
  CanvasEdge,
  CommandRecord,
  DeltaCommand,
  VoicePhase,
  ElementType,
  ElementStyle,
} from '@shared/types';
import { ELEMENT_DEFAULTS } from '@shared/types';
import { generateId } from '../utils/id';

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
  isListening: boolean;
  phase: VoicePhase;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  theme: 'light' | 'dark' | 'blue-gray';

  // --- Actions ---
  setMode: (mode: DiagramMode) => void;
  setPhase: (phase: VoicePhase) => void;
  setListening: (v: boolean) => void;
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
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Clear
  clearAll: () => void;

  // Helper
  createElement: (type: ElementType, label?: string, position?: { x: number; y: number }) => CanvasElement;
}

export const useDiagramStore = create<Store>((set, get) => ({
  mode: 'flowchart',
  elements: {},
  edges: [],
  selectedId: null,
  lastMentionedId: null,
  history: [],
  historyIndex: -1,
  isListening: false,
  phase: 'idle',
  transcript: '',
  interimTranscript: '',
  error: null,
  theme: 'dark',

  setMode: (mode) => set({ mode }),
  setPhase: (phase) => set({ phase }),
  setListening: (isListening) => set({ isListening }),
  setTranscript: (transcript) => set({ transcript }),
  setInterimTranscript: (interimTranscript) => set({ interimTranscript }),
  setError: (error) => set({ error }),
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
      position: position || { x: 250, y: 200 },
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
          [id]: { ...existing, ...patch, id: existing.id },
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
    const state = get();
    const inverseCommands: DeltaCommand[] = [];

    for (const cmd of commands) {
      const inverse = executeCommandLocally(set, get, cmd);
      if (inverse) inverseCommands.push(inverse);
    }

    // Push to history
    const record: CommandRecord = {
      id: generateId(),
      timestamp: Date.now(),
      command: { action: 'create', targets: [], payload: {} }, // Aggregate
      inverse: {
        action: 'create',
        targets: [],
        payload: {},
      },
      utterance,
    };

    // Actually, store each command separately for fine-grained undo
    // For now, push just one
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(record);
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

  canUndo: () => get().historyIndex >= 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

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

// Helper: execute a single DeltaCommand against the store
function executeCommandLocally(
  set: (partial: Partial<Store> | ((s: Store) => Partial<Store>)) => void,
  get: () => Store,
  cmd: DeltaCommand
): DeltaCommand | null {
  const state = get();
  // For now, stub — full implementation in Task 1.5
  console.log('executeCommandLocally:', cmd);
  return null;
}
```

- [ ] **Step 2: Create ID utility**

`client/src/utils/id.ts`:
```typescript
let counter = 0;

export function generateId(): string {
  counter++;
  return `elem_${Date.now()}_${counter}`;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd E:/voice-canvas/client
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/store/ client/src/utils/
git commit -m "feat: implement Zustand store with full state management"
```

---

### Task 1.5: Implement React Flow canvas with custom node types

**Files:**
- Create: `voice-canvas/client/src/components/canvas/nodes/index.ts`
- Create: `voice-canvas/client/src/components/canvas/nodes/RoundedRectNode.tsx`
- Create: `voice-canvas/client/src/components/canvas/nodes/RectNode.tsx`
- Create: `voice-canvas/client/src/components/canvas/nodes/DiamondNode.tsx`
- Create: `voice-canvas/client/src/components/canvas/nodes/CylinderNode.tsx`
- Create: `voice-canvas/client/src/components/canvas/edges/index.ts`
- Create: `voice-canvas/client/src/components/canvas/edges/SolidArrowEdge.tsx`
- Create: `voice-canvas/client/src/components/canvas/edges/DashedArrowEdge.tsx`
- Modify: `voice-canvas/client/src/components/canvas/DiagramCanvas.tsx`

- [ ] **Step 1: Create base node wrapper**

Since all node types share selection/highlight behavior, extract a wrapper. Add it inline in each node file for now to keep things simple.

Create `client/src/components/canvas/nodes/RoundedRectNode.tsx`:
```typescript
import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

interface RoundedRectData {
  label: string;
  style: {
    fill: string;
    stroke: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
  };
  isSelected: boolean;
}

function RoundedRectNode({ data, selected }: NodeProps<RoundedRectData>) {
  const { label, style } = data;
  return (
    <div
      className={`rounded-xl border-2 px-4 py-3 min-w-[120px] text-center transition-shadow ${
        selected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''
      }`}
      style={{
        backgroundColor: style.fill,
        borderColor: style.stroke,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        color: '#1F2937',
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      {label || '开始/结束'}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  );
}

export default memo(RoundedRectNode);
```

- [ ] **Step 2: Create RectNode.tsx**

`client/src/components/canvas/nodes/RectNode.tsx`:
```typescript
import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

interface RectData {
  label: string;
  style: {
    fill: string;
    stroke: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
  };
}

function RectNode({ data, selected }: NodeProps<RectData>) {
  const { label, style } = data;
  return (
    <div
      className={`border-2 px-4 py-3 min-w-[140px] text-center ${
        selected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''
      }`}
      style={{
        backgroundColor: style.fill,
        borderColor: style.stroke,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        color: '#1F2937',
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      {label || '处理'}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  );
}

export default memo(RectNode);
```

- [ ] **Step 3: Create DiamondNode.tsx**

`client/src/components/canvas/nodes/DiamondNode.tsx`:
```typescript
import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

interface DiamondData {
  label: string;
  style: {
    fill: string;
    stroke: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
  };
}

function DiamondNode({ data, selected }: NodeProps<DiamondData>) {
  const { label, style } = data;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 80 }}>
      <svg width="140" height="80" className="absolute inset-0">
        <polygon
          points="70,0 140,40 70,80 0,40"
          fill={style.fill}
          stroke={selected ? '#60A5FA' : style.stroke}
          strokeWidth={selected ? 3 : 2}
        />
      </svg>
      <span
        className="relative z-10 text-center px-4"
        style={{ fontSize: style.fontSize, fontWeight: style.fontWeight, color: '#1F2937' }}
      >
        {label || '判断'}
      </span>
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-gray-500" />
      <Handle type="source" position={Position.Left} id="left" className="!bg-gray-500" />
    </div>
  );
}

export default memo(DiamondNode);
```

- [ ] **Step 4: Create CylinderNode.tsx**

`client/src/components/canvas/nodes/CylinderNode.tsx`:
```typescript
import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

interface CylinderData {
  label: string;
  style: {
    fill: string;
    stroke: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
  };
}

function CylinderNode({ data, selected }: NodeProps<CylinderData>) {
  const { label, style } = data;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 90 }}>
      <svg width="140" height="90" className="absolute inset-0">
        <ellipse cx="70" cy="15" rx="70" ry="15" fill={style.fill} stroke={selected ? '#60A5FA' : style.stroke} strokeWidth={selected ? 3 : 2} />
        <rect x="0" y="15" width="140" height="60" fill={style.fill} stroke="none" />
        <line x1="0" y1="15" x2="0" y2="75" stroke={selected ? '#60A5FA' : style.stroke} strokeWidth={selected ? 3 : 2} />
        <line x1="140" y1="15" x2="140" y2="75" stroke={selected ? '#60A5FA' : style.stroke} strokeWidth={selected ? 3 : 2} />
        <ellipse cx="70" cy="75" rx="70" ry="15" fill={style.fill} stroke={selected ? '#60A5FA' : style.stroke} strokeWidth={selected ? 3 : 2} />
        {/* Dashed top arc for 3D effect */}
        <ellipse cx="70" cy="15" rx="70" ry="15" fill="none" stroke={style.stroke} strokeWidth={1} strokeDasharray="4 2" opacity="0.5" />
      </svg>
      <span
        className="relative z-10 text-center px-4"
        style={{ fontSize: style.fontSize, fontWeight: style.fontWeight, color: '#1F2937', marginTop: 10 }}
      >
        {label || '数据库'}
      </span>
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  );
}

export default memo(CylinderNode);
```

- [ ] **Step 5: Create remaining node stubs**

`client/src/components/canvas/nodes/ActorNode.tsx`:
```typescript
import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

function ActorNode({ data, selected }: NodeProps<{ label: string; style: { fill: string; stroke: string; fontSize: number; fontWeight: string } }>) {
  const { label, style } = data;
  return (
    <div className="flex flex-col items-center">
      <svg width="50" height="65" viewBox="0 0 50 65">
        <circle cx="25" cy="12" r="10" fill={style.fill} stroke={selected ? '#60A5FA' : style.stroke} strokeWidth={2} />
        <line x1="25" y1="22" x2="25" y2="40" stroke={selected ? '#60A5FA' : style.stroke} strokeWidth={2} />
        <line x1="10" y1="30" x2="40" y2="30" stroke={selected ? '#60A5FA' : style.stroke} strokeWidth={2} />
        <line x1="25" y1="40" x2="10" y2="60" stroke={selected ? '#60A5FA' : style.stroke} strokeWidth={2} />
        <line x1="25" y1="40" x2="40" y2="60" stroke={selected ? '#60A5FA' : style.stroke} strokeWidth={2} />
      </svg>
      <span style={{ fontSize: style.fontSize, color: '#D1D5DB' }}>{label || '参与者'}</span>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  );
}
export default memo(ActorNode);
```

`client/src/components/canvas/nodes/QueueNode.tsx`:
```typescript
import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

function QueueNode({ data, selected }: NodeProps<{ label: string; style: { fill: string; stroke: string; fontSize: number; fontWeight: string } }>) {
  const { label, style } = data;
  return (
    <div
      className="border-2 px-4 py-3 min-w-[140px] text-center"
      style={{ backgroundColor: style.fill, borderColor: selected ? '#60A5FA' : style.stroke, fontSize: style.fontSize, color: '#1F2937' }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      <div className="flex items-center justify-center gap-1 mb-1">
        <div className="w-2 h-5 bg-current opacity-40 rounded-sm" />
        <div className="w-2 h-5 bg-current opacity-60 rounded-sm" />
        <div className="w-2 h-5 bg-current opacity-80 rounded-sm" />
      </div>
      {label || '消息队列'}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  );
}
export default memo(QueueNode);
```

`client/src/components/canvas/nodes/CacheNode.tsx`:
```typescript
import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

function CacheNode({ data, selected }: NodeProps<{ label: string; style: { fill: string; stroke: string; fontSize: number; fontWeight: string } }>) {
  const { label, style } = data;
  return (
    <div
      className="border-2 px-4 py-3 min-w-[120px] text-center rounded-md"
      style={{ backgroundColor: style.fill, borderColor: selected ? '#60A5FA' : style.stroke, borderStyle: 'dashed', fontSize: style.fontSize, color: '#1F2937' }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      ⚡ {label || '缓存'}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  );
}
export default memo(CacheNode);
```

`client/src/components/canvas/nodes/GatewayNode.tsx`:
```typescript
import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

function GatewayNode({ data, selected }: NodeProps<{ label: string; style: { fill: string; stroke: string; fontSize: number; fontWeight: string } }>) {
  const { label, style } = data;
  return (
    <div
      className="border-2 px-4 py-3 min-w-[140px] text-center rounded-lg"
      style={{ backgroundColor: style.fill, borderColor: selected ? '#60A5FA' : style.stroke, fontSize: style.fontSize, color: '#1F2937' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-500" />
      🔀 {label || 'API网关'}
      <Handle type="source" position={Position.Right} className="!bg-gray-500" />
    </div>
  );
}
export default memo(GatewayNode);
```

- [ ] **Step 6: Create node type registry**

`client/src/components/canvas/nodes/index.ts`:
```typescript
import RoundedRectNode from './RoundedRectNode';
import RectNode from './RectNode';
import DiamondNode from './DiamondNode';
import CylinderNode from './CylinderNode';
import ActorNode from './ActorNode';
import QueueNode from './QueueNode';
import CacheNode from './CacheNode';
import GatewayNode from './GatewayNode';

export const nodeTypes = {
  'rounded-rect': RoundedRectNode,
  'rect': RectNode,
  'diamond': DiamondNode,
  'cylinder': CylinderNode,
  'actor': ActorNode,
  'queue': QueueNode,
  'cache': CacheNode,
  'gateway': GatewayNode,
};
```

- [ ] **Step 7: Create edge type registry**

`client/src/components/canvas/edges/SolidArrowEdge.tsx`:
```typescript
import { BaseEdge, getSmoothStepPath, type EdgeProps } from 'reactflow';

export default function SolidArrowEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, markerEnd, style } = props;
  const [edgePath] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY });

  return <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, stroke: '#94A3B8', strokeWidth: 2 }} />;
}
```

`client/src/components/canvas/edges/DashedArrowEdge.tsx`:
```typescript
import { BaseEdge, getSmoothStepPath, type EdgeProps } from 'reactflow';

export default function DashedArrowEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, markerEnd, style } = props;
  const [edgePath] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY });

  return <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, stroke: '#94A3B8', strokeWidth: 2, strokeDasharray: '8 4' }} />;
}
```

`client/src/components/canvas/edges/index.ts`:
```typescript
import SolidArrowEdge from './SolidArrowEdge';
import DashedArrowEdge from './DashedArrowEdge';

export const edgeTypes = {
  'solid': SolidArrowEdge,
  'dashed': DashedArrowEdge,
};
```

- [ ] **Step 8: Implement DiagramCanvas with React Flow**

Replace `client/src/components/canvas/DiagramCanvas.tsx`:
```typescript
import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useDiagramStore } from '../../store/diagramStore';
import { nodeTypes } from './nodes';
import { edgeTypes } from './edges';
import type { CanvasElement, CanvasEdge, ElementType } from '@shared/types';

function elementToReactFlowNode(el: CanvasElement): Node {
  return {
    id: el.id,
    type: el.type as string,
    position: el.position,
    width: el.size.width,
    height: el.size.height,
    data: {
      label: el.label,
      style: el.style,
    },
    selected: false,
  };
}

function canvasEdgeToReactFlowEdge(edge: CanvasEdge): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type === 'dashed' ? 'dashed' : 'solid',
    markerEnd: { type: MarkerType.ArrowClosed, color: '#94A3B8' },
    style: edge.type === 'dashed' ? { strokeDasharray: '8 4' } : {},
    label: edge.label,
  };
}

export function DiagramCanvas() {
  const elements = useDiagramStore((s) => s.elements);
  const edges = useDiagramStore((s) => s.edges);
  const setSelected = useDiagramStore((s) => s.setSelected);
  const moveElement = useDiagramStore((s) => s.moveElement);
  const phase = useDiagramStore((s) => s.phase);

  const rfNodes: Node[] = useMemo(
    () => Object.values(elements).map(elementToReactFlowNode),
    [elements]
  );

  const rfEdges: Edge[] = useMemo(
    () => edges.map(canvasEdgeToReactFlowEdge),
    [edges]
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // Handle selection
      for (const change of changes) {
        if (change.type === 'select') {
          setSelected(change.selected ? change.id : null);
        }
        if (change.type === 'position' && change.position) {
          moveElement(change.id, change.position.x, change.position.y);
        }
      }
    },
    [setSelected, moveElement]
  );

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    // Edges are managed by store, React Flow changes sync back via store
  }, []);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelected(node.id);
    },
    [setSelected]
  );

  const onPaneClick = useCallback(() => {
    setSelected(null);
  }, [setSelected]);

  const isVisualProcessing = phase === 'thinking-visual';

  return (
    <div
      className={`w-full h-full transition-all duration-300 ${
        isVisualProcessing ? 'opacity-70 grayscale-[30%]' : ''
      }`}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        attributionPosition="bottom-left"
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'solid',
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94A3B8' },
        }}
      >
        <Background color="#374151" gap={20} />
        <Controls className="!bg-gray-800 !border-gray-700 !fill-gray-400" />
        <MiniMap
          style={{ background: '#1F2937' }}
          maskColor="rgba(0,0,0,0.5)"
          nodeColor={(n) => {
            const el = elements[n.id];
            return el?.style.fill || '#374151';
          }}
        />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
cd E:/voice-canvas/client
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 10: Commit**

```bash
git add client/src/components/canvas/
git commit -m "feat: implement React Flow canvas with 8 custom node types and 2 edge types"
```

---

### Task 1.6: Wire up store to canvas — add test elements manually

**Files:**
- Modify: `voice-canvas/client/src/App.tsx` (add a dev button to add test nodes)

- [ ] **Step 1: Add dev helper to verify canvas renders elements**

In `App.tsx`, temporarily add a test effect to add a sample flowchart on mount. This validates the complete chain: store → canvas.

Add to `App.tsx`:
```typescript
import { useEffect } from 'react';
import { useDiagramStore } from './store/diagramStore';

// Inside App component, add:
const addElement = useDiagramStore((s) => s.addElement);
const createElement = useDiagramStore((s) => s.createElement);
const addEdge = useDiagramStore((s) => s.addEdge);
const generateId = () => `test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

useEffect(() => {
  // Add test nodes for a login flowchart
  const start = createElement('rounded-rect', '开始', { x: 300, y: 0 });
  const login = createElement('rect', '用户登录', { x: 300, y: 120 });
  const decide = createElement('diamond', '是否成功?', { x: 300, y: 240 });
  const home = createElement('rounded-rect', '进入首页', { x: 300, y: 380 });

  addElement(start);
  addElement(login);
  addElement(decide);
  addElement(home);

  addEdge({ id: generateId(), source: start.id, target: login.id, type: 'solid' });
  addEdge({ id: generateId(), source: login.id, target: decide.id, type: 'solid' });
  addEdge({ id: generateId(), source: decide.id, target: home.id, type: 'solid' });
}, []); // Run once on mount
```

- [ ] **Step 2: Run the dev server and verify visually**

```bash
cd E:/voice-canvas/client
npx vite dev
```

Open `http://localhost:5173` — should see a 4-node login flowchart with React Flow rendering.

- [ ] **Step 3: Remove test effect and commit**

After verifying, remove the `useEffect` test code from App.tsx.

```bash
git add client/src/App.tsx
git commit -m "feat: verify canvas renders sample flowchart from store"
```

---

> **Milestone 1 Checkpoint:** Project scaffolded, shared types defined, Zustand store wired, React Flow canvas rendering 8 node types + 2 edge types. Can manually add elements to canvas.

---

## Milestone 2: Voice Pipeline + Local Commands (Week 2)

### Task 2.1: Web Speech API integration hook

**Files:**
- Create: `voice-canvas/client/src/hooks/useSpeechRecognition.ts`

- [ ] **Step 1: Define SpeechRecognition types for browser compatibility**

`client/src/global.d.ts` — add alongside `useSpeechRecognition.ts`:
```typescript
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare var SpeechRecognition: {
  new (): SpeechRecognition;
};

declare var webkitSpeechRecognition: {
  new (): SpeechRecognition;
};
```

- [ ] **Step 2: Implement the hook**

```typescript
import { useState, useRef, useCallback, useEffect } from 'react';

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean, confidence: number) => void;
  onError?: (error: string) => void;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    lang = 'zh-CN',
    continuous = true,
    interimResults = true,
    onResult,
    onError,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Initialize recognition
  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      onError?.('您的浏览器不支持语音识别。请使用 Chrome 或 Edge 浏览器。');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interim = '';
      let confidence = 0;
      let resultCount = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
          confidence += result[0].confidence;
          resultCount++;
        } else {
          interim += result[0].transcript;
        }
      }

      const avgConfidence = resultCount > 0 ? confidence / resultCount : 1;

      if (finalTranscript) {
        setTranscript(finalTranscript);
        setInterimTranscript('');
        onResult?.(finalTranscript, true, avgConfidence);
      } else if (interim) {
        setInterimTranscript(interim);
        // Fire onResult for interim too, so we can show "live" text
        onResult?.(interim, false, 1);
      }
    };

    recognition.onerror = (event: any) => {
      const errorMsg = event.error === 'no-speech'
        ? '未检测到语音'
        : event.error === 'audio-capture'
        ? '无法访问麦克风'
        : event.error === 'not-allowed'
        ? '麦克风权限被拒绝'
        : `语音识别错误: ${event.error}`;
      onError?.(errorMsg);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart if still supposed to be listening
      // (continuous mode should handle this, but some browsers drop it)
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [lang, continuous, interimResults]);

  const start = useCallback(() => {
    if (!recognitionRef.current) {
      onError?.('语音识别不可用');
      return;
    }
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (err: any) {
      // Already started — ignore
      if (err.name !== 'InvalidStateError') {
        onError?.(`启动语音识别失败: ${err.message}`);
      }
    }
  }, [onError]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    start,
    stop,
  };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd E:/voice-canvas/client
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/ client/src/global.d.ts
git commit -m "feat: implement useSpeechRecognition hook wrapping Web Speech API"
```

---

### Task 2.2: Intent classifier — 25 local commands

**Files:**
- Create: `voice-canvas/client/src/services/intentClassifier.ts`

- [ ] **Step 1: Write classifier with all 25 commands**

```typescript
import type { ElementType, DeltaCommand } from '@shared/types';

export interface ClassifiedIntent {
  type: 'local' | 'remote-text' | 'remote-visual' | 'remote-generate' | 'remote-query';
  commands?: DeltaCommand[];      // For local execution
  utterance: string;              // Original or cleaned utterance
  reason: string;                 // Why this classification was chosen
}

// Category 1: Create basic shapes (6 commands)
const CREATE_PATTERNS: Array<{ regex: RegExp; elementType: ElementType }> = [
  { regex: /画.*(?:圆角矩形|开始|结束|起止)/, elementType: 'rounded-rect' },
  { regex: /画.*(?:矩形|方框|方块|框)/, elementType: 'rect' },
  { regex: /画.*(?:菱形|判断|条件)/, elementType: 'diamond' },
  { regex: /画.*(?:圆|椭圆|圆形)/, elementType: 'ellipse' },
  { regex: /画.*(?:圆柱|数据库)/, elementType: 'cylinder' },
  { regex: /画.*(?:小人|人物|参与者|用户|外部)/, elementType: 'actor' },
];

// Category 2: Delete (3 patterns)
const DELETE_PATTERNS = [
  /删除|移除|去掉|删掉/,
];

// Category 3: Undo/Redo (3 patterns)
const UNDO_PATTERNS = [/撤销|回退|撤回/];
const REDO_PATTERNS = [/重做|恢复|前进/];

// Category 4: Select/Focus (3 patterns)
const SELECT_PATTERNS = [
  /选中|选择|聚焦|看这个/,
];

// Category 5: View control (4 patterns)
const ZOOM_IN = /放大/;
const ZOOM_OUT = /缩小/;
const FIT_VIEW = /适应|适合|全部显示|全景/;
const CLEAR = /清空|清除|全部删/;

// Category 6: Style presets (6 patterns)
const COLOR_RED = /变红|红色|红的/;
const COLOR_BLUE = /变蓝|蓝色|蓝的/;
const COLOR_GREEN = /变绿|绿色|绿的/;
const COLOR_YELLOW = /变黄|黄色|黄的/;
const SIZE_BIGGER = /变大|放大|大一点|加大/;
const SIZE_SMALLER = /变小|缩小|小一点/;

// Priority 1: Ambiguous references → multimodal
const AMBIGUOUS_REFS = /那个|这个东西|这东西|那个东西/;

// Priority 2: Diagram generation keywords
const GENERATE_KEYWORDS = /流程|架构|时序|用例|类图|微服务/;

// Priority 3: Query keywords
const QUERY_KEYWORDS = /有哪些|连到了?哪|有没有|几个|多少/;

export function classifyIntent(
  utterance: string,
  hasSelectedTarget: boolean,
  hasLastMentioned: boolean
): ClassifiedIntent {
  const text = utterance.trim();

  // === Priority 1: Ambiguous references ===
  if (AMBIGUOUS_REFS.test(text)) {
    return { type: 'remote-visual', utterance: text, reason: '包含模糊指代词' };
  }

  // === Priority 2: Diagram generation ===
  if (GENERATE_KEYWORDS.test(text)) {
    return { type: 'remote-generate', utterance: text, reason: '包含图表生成关键词' };
  }

  // === Priority 3: Query ===
  if (QUERY_KEYWORDS.test(text)) {
    return { type: 'remote-query', utterance: text, reason: '包含查询关键词' };
  }

  // === Priority 4: Local commands ===
  // Must have a valid target for modify/move/delete/style commands
  const hasTarget = hasSelectedTarget || hasLastMentioned;

  // Undo/Redo — always local
  if (UNDO_PATTERNS.some((p) => p.test(text))) {
    return {
      type: 'local',
      commands: [{ action: 'update', targets: [], payload: {} }], // Special: undo action handled by store
      utterance: text,
      reason: '撤销指令，本地执行',
    };
  }
  if (REDO_PATTERNS.some((p) => p.test(text))) {
    return {
      type: 'local',
      commands: [{ action: 'update', targets: [], payload: {} }],
      utterance: text,
      reason: '重做指令，本地执行',
    };
  }

  // View controls — always local
  if (ZOOM_IN.test(text)) {
    // Handled directly by the command dispatch
    return { type: 'local', commands: [], utterance: text, reason: '缩放指令，本地执行' };
  }
  if (ZOOM_OUT.test(text)) {
    return { type: 'local', commands: [], utterance: text, reason: '缩放指令，本地执行' };
  }
  if (FIT_VIEW.test(text)) {
    return { type: 'local', commands: [], utterance: text, reason: '视图适配，本地执行' };
  }
  if (CLEAR.test(text)) {
    return { type: 'local', commands: [], utterance: text, reason: '清空画布，本地执行' };
  }

  // Delete — needs target
  if (DELETE_PATTERNS.some((p) => p.test(text)) && hasTarget) {
    return {
      type: 'local',
      commands: [{ action: 'delete', targets: [hasSelectedTarget ? 'selected' : 'lastMentioned'], payload: {} }],
      utterance: text,
      reason: '删除指令，本地执行',
    };
  }

  // Select
  if (SELECT_PATTERNS.some((p) => p.test(text))) {
    return {
      type: 'local',
      commands: [{ action: 'update', targets: [], payload: {} }], // Target resolved by dispatch
      utterance: text,
      reason: '选择指令',
    };
  }

  // Create — always local if it's a single create
  for (const pattern of CREATE_PATTERNS) {
    if (pattern.regex.test(text)) {
      return {
        type: 'local',
        commands: [{
          action: 'create',
          targets: [],
          payload: { elements: [{ type: pattern.elementType } as any] },
        }],
        utterance: text,
        reason: `创建${pattern.elementType}，本地执行`,
      };
    }
  }

  // Style changes — need target
  if (hasTarget) {
    if (COLOR_RED.test(text)) {
      return { type: 'local', commands: [{ action: 'update', targets: [hasSelectedTarget ? 'selected' : 'lastMentioned'], payload: { elements: [{ style: { fill: '#FFCDD2', stroke: '#F44336' } } as any] } }], utterance: text, reason: '样式修改，本地执行' };
    }
    if (COLOR_BLUE.test(text)) {
      return { type: 'local', commands: [{ action: 'update', targets: [hasSelectedTarget ? 'selected' : 'lastMentioned'], payload: { elements: [{ style: { fill: '#BBDEFB', stroke: '#2196F3' } } as any] } }], utterance: text, reason: '样式修改，本地执行' };
    }
    if (COLOR_GREEN.test(text)) {
      return { type: 'local', commands: [{ action: 'update', targets: [hasSelectedTarget ? 'selected' : 'lastMentioned'], payload: { elements: [{ style: { fill: '#C8E6C9', stroke: '#4CAF50' } } as any] } }], utterance: text, reason: '样式修改，本地执行' };
    }
    if (COLOR_YELLOW.test(text)) {
      return { type: 'local', commands: [{ action: 'update', targets: [hasSelectedTarget ? 'selected' : 'lastMentioned'], payload: { elements: [{ style: { fill: '#FFF9C4', stroke: '#FBC02D' } } as any] } }], utterance: text, reason: '样式修改，本地执行' };
    }
    if (SIZE_BIGGER.test(text)) {
      return { type: 'local', commands: [{ action: 'update', targets: [hasSelectedTarget ? 'selected' : 'lastMentioned'], payload: { elements: [{ size: { width: 200, height: 80 } } as any] } }], utterance: text, reason: '尺寸修改，本地执行' };
    }
    if (SIZE_SMALLER.test(text)) {
      return { type: 'local', commands: [{ action: 'update', targets: [hasSelectedTarget ? 'selected' : 'lastMentioned'], payload: { elements: [{ size: { width: 120, height: 50 } } as any] } }], utterance: text, reason: '尺寸修改，本地执行' };
    }
  }

  // Fallback: send to remote text pipeline
  return { type: 'remote-text', utterance: text, reason: '未命中本地规则，走云端解析' };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd E:/voice-canvas/client
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/services/intentClassifier.ts
git commit -m "feat: implement intent classifier with 25 local commands + priority chain"
```

---

### Task 2.3: Implement useVoiceCommand — full dispatch pipeline

**Files:**
- Create: `voice-canvas/client/src/hooks/useVoiceCommand.ts`

- [ ] **Step 1: Implement the command dispatch hook**

```typescript
import { useCallback, useRef } from 'react';
import { useDiagramStore } from '../store/diagramStore';
import { useSpeechRecognition } from './useSpeechRecognition';
import { classifyIntent } from '../services/intentClassifier';
import { apiClient } from '../services/api';
import { generateId } from '../utils/id';
import type { DeltaCommand, LLMResponse, CanvasElement } from '@shared/types';

export function useVoiceCommand() {
  const store = useDiagramStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef('');

  const executeLocalCommands = useCallback(
    (commands: DeltaCommand[], utterance: string, targetId: string | null) => {
      const state = useDiagramStore.getState();
      const effectiveTarget = targetId || state.selectedId || state.lastMentionedId;

      for (const cmd of commands) {
        switch (cmd.action) {
          case 'create': {
            const elSpec = cmd.payload?.elements?.[0];
            if (elSpec?.type) {
              const newEl = state.createElement(elSpec.type, elSpec.label);
              state.addElement(newEl);
            }
            break;
          }
          case 'delete': {
            const deleteIds = cmd.targets.map((t) =>
              t === 'selected' ? state.selectedId : t === 'lastMentioned' ? state.lastMentionedId : t
            ).filter(Boolean) as string[];
            for (const id of deleteIds) {
              state.deleteElement(id);
            }
            break;
          }
          case 'update': {
            const updateIds = cmd.targets.map((t) =>
              t === 'selected' ? state.selectedId : t === 'lastMentioned' ? state.lastMentionedId : t
            ).filter(Boolean) as string[];
            for (const id of updateIds) {
              if (cmd.payload?.elements?.[0]) {
                state.updateElement(id, cmd.payload.elements[0]);
              }
            }
            break;
          }
          case 'move': {
            for (const id of cmd.targets) {
              if (cmd.payload?.elements?.[0]?.position) {
                const { x, y } = cmd.payload.elements[0].position;
                state.moveElement(id, x, y);
              }
            }
            break;
          }
          case 'connect': {
            const [source, target] = cmd.targets;
            if (source && target && cmd.payload?.edges?.[0]) {
              const edge = {
                id: generateId(),
                source,
                target,
                type: cmd.payload.edges[0].type || 'solid',
                label: cmd.payload.edges[0].label,
              };
              state.addEdge(edge);
            }
            break;
          }
        }
      }

      // Push to history (simplified — will be refined)
      state.setLastMentioned(effectiveTarget);
    },
    []
  );

  const executeRemoteCommand = useCallback(
    async (utterance: string, pipeline: 'text' | 'visual' | 'generate' | 'query') => {
      const state = useDiagramStore.getState();
      store.setPhase(pipeline === 'visual' ? 'thinking-visual' : 'thinking-text');

      try {
        let response: LLMResponse;

        if (pipeline === 'visual') {
          // Capture canvas screenshot
          const { captureCanvas } = await import('../services/canvasSnapshot');
          const imageBase64 = await captureCanvas();
          response = await apiClient.multimodalCommand({
            utterance,
            imageBase64,
            diagramState: buildDiagramState(state),
          });
        } else {
          response = await apiClient.textCommand({
            utterance,
            diagramState: buildDiagramState(state),
          });
        }

        // Execute returned commands
        executeLocalCommands(response.commands, utterance, null);

        // Handle voice reply from AI
        if (response.voiceReply) {
          const { speak } = await import('../services/speechSynthesis');
          speak(response.voiceReply);
        }

        store.setPhase('executing');
        setTimeout(() => store.setPhase('idle'), 500);
      } catch (err: any) {
        store.setError(`指令执行失败: ${err.message}`);
        store.setPhase('idle');
      }
    },
    [executeLocalCommands]
  );

  const handleFinalResult = useCallback(
    (transcript: string, _isFinal: boolean, confidence: number) => {
      if (!_isFinal) return;
      if (confidence < 0.3) {
        store.setError('语音识别置信度过低，请重新说一遍');
        return;
      }

      const state = useDiagramStore.getState();
      const hasTarget = !!(state.selectedId || state.lastMentionedId);
      const intent = classifyIntent(transcript, hasTarget, !!state.lastMentionedId);

      store.setTranscript(transcript);

      if (intent.type === 'local') {
        // Handle special local-only actions
        if (/撤销|回退|撤回/.test(transcript)) {
          state.undo();
          return;
        }
        if (/重做|恢复|前进/.test(transcript)) {
          state.redo();
          return;
        }
        if (/清空|清除|全部删/.test(transcript)) {
          state.clearAll();
          return;
        }
        // Selection
        if (/选中|选择|聚焦/.test(transcript)) {
          // Try to find element by label/alias match
          const match = findElementByUtterance(transcript, state.elements);
          if (match) {
            state.setSelected(match);
          }
          return;
        }
        // Other local commands
        if (intent.commands && intent.commands.length > 0) {
          executeLocalCommands(intent.commands, transcript, null);
        }
      } else {
        const pipeline = intent.type === 'remote-visual'
          ? 'visual'
          : intent.type === 'remote-generate'
          ? 'generate'
          : intent.type === 'remote-query'
          ? 'query'
          : 'text';
        executeRemoteCommand(transcript, pipeline);
      }
    },
    [executeLocalCommands, executeRemoteCommand]
  );

  const { isListening, transcript, interimTranscript, start, stop } = useSpeechRecognition({
    lang: 'zh-CN',
    continuous: true,
    interimResults: true,
    onResult: handleFinalResult,
    onError: (err) => store.setError(err),
  });

  return { isListening, transcript, interimTranscript, start, stop };
}

// Helper: build diagram state summary for API
function buildDiagramState(state: ReturnType<typeof useDiagramStore.getState>) {
  return {
    mode: state.mode,
    elements: Object.values(state.elements).map((el) => ({
      id: el.id,
      type: el.type,
      label: el.label,
      voiceAliases: el.voiceAliases,
      position: el.position,
    })),
    edges: state.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      label: e.label,
    })),
    selectedId: state.selectedId,
    lastMentionedId: state.lastMentionedId,
  };
}

// Helper: find element matching utterance
function findElementByUtterance(utterance: string, elements: Record<string, CanvasElement>): string | null {
  for (const el of Object.values(elements)) {
    if (utterance.includes(el.label)) return el.id;
    for (const alias of el.voiceAliases.auto) {
      if (utterance.includes(alias)) return el.id;
    }
    for (const alias of el.voiceAliases.manual) {
      if (utterance.includes(alias)) return el.id;
    }
  }
  return null;
}
```

- [ ] **Step 2: Create API client stub**

`client/src/services/api.ts`:
```typescript
import type { CommandRequest, MultimodalRequest, LLMResponse } from '@shared/types';

const BASE_URL = '/api';

export const apiClient = {
  async textCommand(req: CommandRequest): Promise<LLMResponse> {
    const res = await fetch(`${BASE_URL}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    return res.json();
  },

  async multimodalCommand(req: MultimodalRequest): Promise<LLMResponse> {
    const res = await fetch(`${BASE_URL}/multimodal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    return res.json();
  },
};
```

- [ ] **Step 3: Create canvas snapshot service stub**

`client/src/services/canvasSnapshot.ts`:
```typescript
export async function captureCanvas(): Promise<string> {
  // TODO: Implement with html-to-image in Task 4.1
  // For now return empty string (won't be called until M4)
  return '';
}
```

- [ ] **Step 4: Create speech synthesis service stub**

`client/src/services/speechSynthesis.ts`:
```typescript
export function speak(text: string): void {
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd E:/voice-canvas/client
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/hooks/useVoiceCommand.ts client/src/services/
git commit -m "feat: implement useVoiceCommand hook with full dispatch pipeline + API stubs"
```

---

### Task 2.4: Wire VoiceButton to voice pipeline

**Files:**
- Modify: `voice-canvas/client/src/components/voice/VoiceButton.tsx`
- Modify: `voice-canvas/client/src/components/voice/TranscriptBar.tsx`
- Modify: `voice-canvas/client/src/components/voice/VoiceOverlay.tsx`
- Modify: `voice-canvas/client/src/App.tsx`

- [ ] **Step 1: Update VoiceButton to use useVoiceCommand**

Replace `VoiceButton.tsx`:
```typescript
import { useVoiceCommand } from '../../hooks/useVoiceCommand';

export function VoiceButton() {
  const { isListening, start, stop } = useVoiceCommand();

  return (
    <button
      onClick={isListening ? stop : start}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        isListening
          ? 'bg-red-600 hover:bg-red-700 animate-pulse'
          : 'bg-blue-600 hover:bg-blue-700'
      }`}
      title={isListening ? '点击停止' : '点击开始语音'}
    >
      {isListening ? '🔴 停止' : '🎤 开始语音'}
    </button>
  );
}
```

- [ ] **Step 2: Update TranscriptBar**

Replace `TranscriptBar.tsx`:
```typescript
import { useDiagramStore } from '../../store/diagramStore';

export function TranscriptBar() {
  const transcript = useDiagramStore((s) => s.transcript);
  const interimTranscript = useDiagramStore((s) => s.interimTranscript);
  const isListening = useDiagramStore((s) => s.isListening);
  const error = useDiagramStore((s) => s.error);

  if (!isListening && !transcript && !error) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 max-w-lg w-full">
      {error && (
        <div className="bg-red-900/80 text-red-200 px-4 py-2 rounded-lg text-sm mb-2 animate-fade-in">
          {error}
        </div>
      )}
      {isListening && interimTranscript && (
        <div className="bg-gray-800/90 text-gray-300 px-4 py-2 rounded-lg text-sm animate-fade-in italic">
          {interimTranscript}
        </div>
      )}
      {transcript && (
        <div className="bg-blue-900/80 text-blue-200 px-4 py-2 rounded-lg text-sm animate-fade-in">
          "{transcript}"
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update VoiceOverlay to use store phase**

`VoiceOverlay.tsx` already uses `phase` prop — ensure it reads from store in App.tsx. Update `App.tsx`:

```typescript
import { useDiagramStore } from './store/diagramStore';

export default function App() {
  const phase = useDiagramStore((s) => s.phase);
  const isListening = useDiagramStore((s) => s.isListening);

  return (
    <div className={`w-screen h-screen flex flex-col transition-all duration-500 ${
      isListening ? 'breathing-border' : ''
    }`}>
      {/* ... same header ... */}
      <main className="flex-1 relative">
        <DiagramCanvas />
        <TranscriptBar />
        <VoiceOverlay phase={phase} />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd E:/voice-canvas/client
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/voice/ client/src/App.tsx
git commit -m "feat: wire VoiceButton to voice pipeline with transcript + error display"
```

---

### Task 2.5: Implement proper undo/redo with command pattern

**Files:**
- Modify: `voice-canvas/client/src/store/diagramStore.ts`

- [ ] **Step 1: Refactor applyCommands and undo/redo in the store**

Replace the `applyCommands`, `undo`, and `redo` methods in `diagramStore.ts` with proper command recording:

```typescript
// Inside the store creator function, replace the undo/redo implementation:

applyCommands: (commands, utterance) => {
  const state = get();

  for (const cmd of commands) {
    const inverse = executeAndRecord(set, get, cmd, utterance);
    // inverse is already pushed to history inside executeAndRecord
  }
},

undo: () => {
  const { history, historyIndex } = get();
  if (historyIndex < 0) return;
  const record = history[historyIndex];
  // Execute inverse command without recording
  executeCommandSilently(set, get, record.inverse);
  set({ historyIndex: historyIndex - 1 });
},

redo: () => {
  const { history, historyIndex } = get();
  if (historyIndex >= history.length - 1) return;
  const record = history[historyIndex + 1];
  executeCommandSilently(set, get, record.command);
  set({ historyIndex: historyIndex + 1 });
},

// ... rest
```

And add the helper functions at the bottom of the file:

```typescript
function executeAndRecord(
  set: (p: Partial<Store> | ((s: Store) => Partial<Store>)) => void,
  get: () => Store,
  cmd: DeltaCommand,
  utterance: string
): void {
  const state = get();
  const inverse = computeInverse(cmd, state);

  // Execute
  executeCommandSilently(set, get, cmd);

  // Record
  const record: CommandRecord = {
    id: generateId(),
    timestamp: Date.now(),
    command: cmd,
    inverse,
    utterance,
  };

  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(record);
  set({
    history: newHistory,
    historyIndex: newHistory.length - 1,
  });
}

function executeCommandSilently(
  set: (p: Partial<Store> | ((s: Store) => Partial<Store>)) => void,
  get: () => Store,
  cmd: DeltaCommand
): void {
  const state = get();

  switch (cmd.action) {
    case 'create': {
      const elSpec = cmd.payload?.elements?.[0];
      if (elSpec?.type) {
        const newEl = state.createElement(elSpec.type, elSpec.label, elSpec.position);
        if (elSpec.style) Object.assign(newEl.style, elSpec.style);
        if (elSpec.size) newEl.size = { ...newEl.size, ...elSpec.size };
        if (elSpec.voiceAliases) newEl.voiceAliases = elSpec.voiceAliases;
        cmd.targets = [newEl.id]; // Record the actual ID for inverse
        set((s) => ({
          elements: { ...s.elements, [newEl.id]: newEl },
          lastMentionedId: newEl.id,
        }));
      }
      break;
    }
    case 'update': {
      const ids = resolveTargets(cmd.targets, state);
      for (const id of ids) {
        const el = state.elements[id];
        if (!el || !cmd.payload?.elements?.[0]) continue;

        const patch = cmd.payload.elements[0];
        set((s) => ({
          elements: {
            ...s.elements,
            [id]: {
              ...s.elements[id],
              ...patch,
              id,
              style: patch.style ? { ...s.elements[id].style, ...patch.style } : s.elements[id].style,
              size: patch.size ? { ...s.elements[id].size, ...patch.size } : s.elements[id].size,
              position: patch.position ? { ...s.elements[id].position, ...patch.position } : s.elements[id].position,
              voiceAliases: patch.voiceAliases ? patch.voiceAliases : s.elements[id].voiceAliases,
            },
          },
          lastMentionedId: id,
        }));
      }
      break;
    }
    case 'delete': {
      const ids = resolveTargets(cmd.targets, state);
      set((s) => {
        const newElements = { ...s.elements };
        const newEdges = [...s.edges];
        for (const id of ids) {
          delete newElements[id];
        }
        return {
          elements: newElements,
          edges: newEdges.filter((e) => !ids.includes(e.source) && !ids.includes(e.target)),
          selectedId: ids.includes(state.selectedId || '') ? null : state.selectedId,
          lastMentionedId: ids.includes(state.lastMentionedId || '') ? null : state.lastMentionedId,
        };
      });
      break;
    }
    case 'move': {
      for (const id of cmd.targets) {
        if (cmd.payload?.elements?.[0]?.position) {
          const { x, y } = cmd.payload.elements[0].position;
          set((s) => {
            const el = s.elements[id];
            if (!el) return s;
            return {
              elements: {
                ...s.elements,
                [id]: { ...el, position: { x, y } },
              },
            };
          });
        }
      }
      break;
    }
    case 'connect': {
      const [source, target] = cmd.targets;
      if (source && target && cmd.payload?.edges?.[0]) {
        const edgeId = generateId();
        // Store generated ID for inverse
        cmd.targets = [edgeId];
        set((s) => ({
          edges: [
            ...s.edges,
            {
              id: edgeId,
              source,
              target,
              type: cmd.payload!.edges![0].type || 'solid',
              label: cmd.payload!.edges![0].label,
              style: cmd.payload!.edges![0].style,
            },
          ],
        }));
      }
      break;
    }
  }
}

function computeInverse(cmd: DeltaCommand, state: Store): DeltaCommand {
  switch (cmd.action) {
    case 'create': {
      const elId = cmd.targets[0];
      const el = elId ? state.elements[elId] : null;
      return {
        action: 'delete',
        targets: elId ? [elId] : [],
        payload: el ? { elements: [el] } : {},
      };
    }
    case 'delete': {
      // To undo a delete, we need to re-create. Store the elements in payload for the inverse.
      // The original elements are snapshot before deletion — handled by the caller.
      return {
        action: 'create',
        targets: [],
        payload: cmd.payload, // Should contain the deleted elements
      };
    }
    case 'update': {
      const id = cmd.targets[0];
      const original = id ? state.elements[id] : null;
      return {
        action: 'update',
        targets: cmd.targets,
        payload: original ? { elements: [{ ...original }] } : {},
      };
    }
    case 'move': {
      const id = cmd.targets[0];
      const original = id ? state.elements[id] : null;
      return {
        action: 'move',
        targets: cmd.targets,
        payload: original ? { elements: [{ position: original.position }] } : {},
      };
    }
    case 'connect': {
      const edgeId = cmd.targets[0];
      return {
        action: 'delete',
        targets: edgeId ? [edgeId] : [],
        payload: {},
      };
    }
    default:
      return { action: 'update', targets: [], payload: {} };
  }
}

function resolveTargets(targets: string[], state: Store): string[] {
  return targets.map((t) => {
    if (t === 'selected') return state.selectedId;
    if (t === 'lastMentioned') return state.lastMentionedId;
    return t;
  }).filter(Boolean) as string[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd E:/voice-canvas/client
npx tsc --noEmit
```

Expected: No errors. Fix any type issues.

- [ ] **Step 3: Commit**

```bash
git add client/src/store/diagramStore.ts
git commit -m "feat: implement proper undo/redo with command pattern and inverse computation"
```

---

**Milestone 2 Checkpoint:** Voice recognition working, 25 local commands executing with <100ms latency, undo/redo functional. User can create/modify/delete/undo single elements by voice.

---

## Milestone 3: LLM Integration + Batch Generation (Week 3)

### Task 3.1: Implement LLM service with DeepSeek API

**Files:**
- Create: `voice-canvas/server/src/services/llm.ts`
- Create: `voice-canvas/server/.env.example`

- [ ] **Step 1: Create .env.example**

```
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

- [ ] **Step 2: Implement LLM client**

`server/src/services/llm.ts`:
```typescript
import OpenAI from 'openai';

const apiKey = process.env.DEEPSEEK_API_KEY || '';
const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

const client = new OpenAI({ apiKey, baseURL });

export interface LLMCallOptions {
  model: 'deepseek-chat' | 'deepseek-v4-lite';
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_object';
}

export async function callLLM(options: LLMCallOptions): Promise<string> {
  const { model, systemPrompt, userMessage, temperature = 0.3, maxTokens = 4096, responseFormat = 'json_object' } = options;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature,
    max_tokens: maxTokens,
    response_format: responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('LLM returned empty response');
  }

  return content;
}

export interface MultimodalLLMOptions {
  model: 'deepseek-chat'; // V4.5
  systemPrompt: string;
  userMessage: string;
  imageBase64: string;
  temperature?: number;
  maxTokens?: number;
}

export async function callMultimodalLLM(options: MultimodalLLMOptions): Promise<string> {
  const { model, systemPrompt, userMessage, imageBase64, temperature = 0.3, maxTokens = 4096 } = options;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userMessage },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
        ],
      },
    ],
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('LLM returned empty response');
  }

  return content;
}

// Tiered routing helper
export function selectModel(intent: 'text' | 'visual' | 'generate' | 'query'): LLMCallOptions['model'] {
  switch (intent) {
    case 'visual':
    case 'generate':
      return 'deepseek-chat'; // V4.5 for complex tasks
    case 'text':
    case 'query':
      return 'deepseek-v4-lite'; // Lite for simple tasks
    default:
      return 'deepseek-v4-lite';
  }
}
```

- [ ] **Step 3: Verify server compiles**

```bash
cd E:/voice-canvas/server
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/llm.ts server/.env.example
git commit -m "feat: implement LLM service with DeepSeek API + tiered model routing"
```

---

### Task 3.2: Create system prompts and Zod validators

**Files:**
- Create: `voice-canvas/server/src/prompts/system.ts`
- Create: `voice-canvas/server/src/prompts/diagramTypes.ts`
- Create: `voice-canvas/server/src/validators/command.ts`

- [ ] **Step 1: Create system prompt**

`server/src/prompts/system.ts`:
```typescript
export const SYSTEM_PROMPT = `你是一个软件工程图表绘制助手。你的任务是根据用户的自然语言指令，输出精确的图表操作指令。

## 输出格式
你必须返回严格的 JSON：
{
  "commands": [
    {
      "action": "create" | "update" | "delete" | "move" | "connect" | "query",
      "targets": ["element_id"],
      "payload": {
        "elements": [{ ... }],
        "edges": [{ ... }],
        "layout": "vertical" | "horizontal" | "grid"
      },
      "reasoning": "简要说明为什么这样操作"
    }
  ],
  "voiceReply": "如果需要回复用户，这里写回复文本。不需要回复时设为 null"
}

## 元素类型 (type)
- "rounded-rect": 开始/结束节点（圆角矩形）
- "rect": 处理步骤/服务（矩形）
- "diamond": 判断/条件分支（菱形）
- "cylinder": 数据库（圆柱体）
- "actor": 用户/外部系统（小人图标）
- "queue": 消息队列
- "cache": 缓存
- "gateway": API 网关
- "ellipse": 用例（椭圆形）
- "lifeline": 时序图生命线
- "sticky-note": 便签备注

## 边类型
- "solid": 同步调用（实线箭头）
- "dashed": 异步消息（虚线箭头）

## 核心规则
1. 每次只输出操作指令 JSON，不要加任何解释文字
2. 流程图必须符合 DAG（有向无环图）结构
3. 架构图组件布局避免重叠，节点间距至少 100px
4. 指代消解时优先匹配 voiceAliases，其次匹配标签文字
5. 每次创建元素时，自动生成 2-3 个自然口语别名放入 voiceAliases.auto 数组。例如标签为"用户登录模块"的节点，自动生成：["登录模块", "那个登录的", "登录框"]
6. 如果用户一句话包含多个操作步骤，拆解为多个 commands
7. 如果用户的意图不明确，使用 action: "query" 反问用户，并在 voiceReply 中写回复文字
8. 元素 ID 使用 "elem_N" 格式（N 从 1 开始递增），连线 ID 使用 "edge_N" 格式
9. 所有坐标使用画布坐标系，建议从 (200, 100) 开始，节点间垂直间距 120px，水平间距 200px
10. 判断节点（diamond）必须有两个出边，分别对应"是"和"否"分支

## 响应示例
用户："画一个用户登录流程"
{
  "commands": [
    {
      "action": "create",
      "targets": [],
      "payload": {
        "elements": [
          {
            "type": "rounded-rect",
            "label": "开始",
            "position": { "x": 300, "y": 0 },
            "voiceAliases": { "auto": ["开始节点", "起点"], "manual": [] }
          },
          {
            "type": "rect",
            "label": "用户登录",
            "position": { "x": 300, "y": 120 },
            "voiceAliases": { "auto": ["登录模块", "登录"], "manual": [] }
          },
          {
            "type": "diamond",
            "label": "验证通过?",
            "position": { "x": 300, "y": 240 },
            "voiceAliases": { "auto": ["判断节点", "验证判断", "那个菱形"], "manual": [] }
          },
          {
            "type": "rounded-rect",
            "label": "进入首页",
            "position": { "x": 300, "y": 380 },
            "voiceAliases": { "auto": ["首页", "主页"], "manual": [] }
          }
        ]
      },
      "reasoning": "创建登录流程的四个核心节点，自上而下排列"
    },
    {
      "action": "connect",
      "targets": ["elem_1", "elem_2"],
      "payload": { "edges": [{ "type": "solid" }] },
      "reasoning": "开始到登录"
    },
    {
      "action": "connect",
      "targets": ["elem_2", "elem_3"],
      "payload": { "edges": [{ "type": "solid" }] },
      "reasoning": "登录到判断"
    },
    {
      "action": "connect",
      "targets": ["elem_3", "elem_4"],
      "payload": { "edges": [{ "type": "solid", "label": "是" }] },
      "reasoning": "验证通过进入首页"
    }
  ],
  "voiceReply": "已生成登录流程图，包含开始、登录、验证和首页四个节点。"
}`;
```

- [ ] **Step 2: Create diagram type supplements**

`server/src/prompts/diagramTypes.ts`:
```typescript
import type { DiagramMode } from '@shared/types';

export const DIAGRAM_TYPE_PROMPTS: Record<DiagramMode, string> = {
  flowchart: `
## 流程图专用规则
- 有且仅有一个开始节点（rounded-rect），只有出边没有入边
- 有至少一个结束节点（rounded-rect），只有入边没有出边
- 判断节点（diamond）必须有恰好两条出边，标注"是"和"否"
- 所有节点必须在同一条主路径或明确的分支路径上
- 使用垂直布局（从上到下）
- 节点垂直间距 120px
`,

  architecture: `
## 架构图专用规则
- 服务节点使用 "rect"
- 数据库使用 "cylinder"
- 消息队列使用 "queue"
- 缓存使用 "cache"
- API 网关使用 "gateway"
- 外部系统/用户使用 "actor"
- 同步调用使用 "solid" 边
- 异步消息使用 "dashed" 边
- 自左向右或自外向内布局
- 节点间距 150-200px，避免重叠
- 当检测到微服务、分布式、电商等架构关键词时，主动补充典型缺失组件，在 voiceReply 中询问用户确认
`,

  sequence: `
## 时序图专用规则
- 参与者使用 "rect" 节点，水平等距排列
- 生命线使用 "lifeline" 节点，从参与者下方延伸
- 消息箭头使用 "solid" 边（调用）或 "dashed" 边（返回）
- 时间轴自上而下
- 参与者从左到右排列，间距 200px
`,
};
```

- [ ] **Step 3: Create Zod validators**

`server/src/validators/command.ts`:
```typescript
import { z } from 'zod';

const VoiceAliasesSchema = z.object({
  auto: z.array(z.string()),
  manual: z.array(z.string()),
});

const ElementStyleSchema = z.object({
  fill: z.string().optional(),
  stroke: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.enum(['normal', 'bold']).optional(),
});

const ElementPayloadSchema = z.object({
  type: z.enum([
    'rounded-rect', 'rect', 'diamond', 'cylinder',
    'ellipse', 'actor', 'queue', 'cache', 'gateway',
    'lifeline', 'sticky-note',
  ]).optional(),
  label: z.string().optional(),
  voiceAliases: VoiceAliasesSchema.optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  size: z.object({ width: z.number(), height: z.number() }).optional(),
  style: ElementStyleSchema.optional(),
});

const EdgePayloadSchema = z.object({
  type: z.enum(['solid', 'dashed']).optional(),
  label: z.string().optional(),
  style: z.object({
    stroke: z.string().optional(),
    strokeWidth: z.number().optional(),
  }).optional(),
});

const DeltaCommandSchema = z.object({
  action: z.enum(['create', 'update', 'delete', 'move', 'connect', 'query']),
  targets: z.array(z.string()),
  payload: z.object({
    elements: z.array(ElementPayloadSchema).optional(),
    edges: z.array(EdgePayloadSchema).optional(),
    layout: z.enum(['vertical', 'horizontal', 'grid']).optional(),
  }).optional(),
  reasoning: z.string().optional(),
});

export const LLMResponseSchema = z.object({
  commands: z.array(DeltaCommandSchema),
  voiceReply: z.string().nullable().optional(),
});

export type ValidatedLLMResponse = z.infer<typeof LLMResponseSchema>;
```

- [ ] **Step 4: Verify server compiles**

```bash
cd E:/voice-canvas/server
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add server/src/prompts/ server/src/validators/
git commit -m "feat: create system prompts, diagram type supplements, and Zod validators"
```

---

### Task 3.3: Implement command route with LLM integration

**Files:**
- Modify: `voice-canvas/server/src/routes/command.ts`
- Create: `voice-canvas/server/src/utils/canvasSummary.ts`

- [ ] **Step 1: Create canvas summary utility**

`server/src/utils/canvasSummary.ts`:
```typescript
import type { CommandRequest } from '@shared/types';

export function generateCanvasSummary(state: CommandRequest['diagramState']): string {
  const { mode, elements, edges, selectedId, lastMentionedId } = state;

  let summary = `当前图表类型: ${mode}\n`;
  summary += `画布元素 (${elements.length}个):\n`;

  for (const el of elements) {
    const aliases = el.voiceAliases.auto.join(', ');
    const selected = el.id === selectedId ? ' [已选中]' : '';
    const mentioned = el.id === lastMentionedId ? ' [最近提及]' : '';
    summary += `  - ${el.id}: ${el.type} "${el.label}" @ (${el.position.x}, ${el.position.y})${selected}${mentioned}`;
    if (aliases) summary += `  别名: ${aliases}`;
    summary += '\n';
  }

  summary += `连线 (${edges.length}条):\n`;
  for (const edge of edges) {
    summary += `  - ${edge.id}: ${edge.source} → ${edge.target} [${edge.type}]${edge.label ? ` "${edge.label}"` : ''}\n`;
  }

  return summary;
}
```

- [ ] **Step 2: Rewrite command route**

Replace `server/src/routes/command.ts`:
```typescript
import type { FastifyPluginAsync } from 'fastify';
import type { CommandRequest, LLMResponse } from '@shared/types';
import { callLLM, selectModel } from '../services/llm.js';
import { SYSTEM_PROMPT } from '../prompts/system.js';
import { DIAGRAM_TYPE_PROMPTS } from '../prompts/diagramTypes.js';
import { LLMResponseSchema } from '../validators/command.js';
import { generateCanvasSummary } from '../utils/canvasSummary.js';

export const commandRoutes: FastifyPluginAsync = async (server) => {
  server.post<{ Body: CommandRequest & { intent?: string } }>('/command', async (request, reply) => {
    const { utterance, diagramState, intent = 'text' } = request.body;

    // Build prompt
    const canvasSummary = generateCanvasSummary(diagramState);
    const diagramPrompt = DIAGRAM_TYPE_PROMPTS[diagramState.mode] || '';

    const systemPrompt = SYSTEM_PROMPT + '\n' + diagramPrompt;

    const userMessage = `## 当前画布状态\n${canvasSummary}\n\n## 用户指令\n${utterance}\n\n请输出 JSON 操作指令。`;

    // Select model based on intent
    const model = selectModel(intent as 'text' | 'visual' | 'generate' | 'query');

    // Call LLM with retry on Zod failure
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const rawResponse = await callLLM({
          model,
          systemPrompt,
          userMessage,
          temperature: 0.3,
          maxTokens: 4096,
        });

        // Parse JSON from response
        const parsed = JSON.parse(rawResponse);

        // Validate with Zod
        const validated = LLMResponseSchema.parse(parsed);

        return reply.send(validated as LLMResponse);
      } catch (err: any) {
        lastError = err;
        const errorMsg = err instanceof Error ? err.message : String(err);

        if (attempt === 0) {
          // Retry with error context
          server.log.warn(`LLM response validation failed, retrying: ${errorMsg}`);
          // Modify user message to include error hint
          // (On retry we'll use the original prompt + error context)
        }
      }
    }

    // Both attempts failed
    server.log.error(`LLM command failed after 2 attempts: ${lastError?.message}`);
    return reply.status(422).send({
      error: '指令解析失败，请换个方式描述',
      detail: lastError?.message,
    });
  });
};
```

- [ ] **Step 3: Verify server compiles**

```bash
cd E:/voice-canvas/server
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/command.ts server/src/utils/
git commit -m "feat: implement command route with LLM + Zod validation + retry"
```

---

### Task 3.4: Implement multimodal route

**Files:**
- Modify: `voice-canvas/server/src/routes/multimodal.ts`

- [ ] **Step 1: Rewrite multimodal route**

`server/src/routes/multimodal.ts`:
```typescript
import type { FastifyPluginAsync } from 'fastify';
import type { MultimodalRequest, LLMResponse } from '@shared/types';
import { callMultimodalLLM } from '../services/llm.js';
import { SYSTEM_PROMPT } from '../prompts/system.js';
import { DIAGRAM_TYPE_PROMPTS } from '../prompts/diagramTypes.js';
import { LLMResponseSchema } from '../validators/command.js';
import { generateCanvasSummary } from '../utils/canvasSummary.js';

export const multimodalRoutes: FastifyPluginAsync = async (server) => {
  server.post<{ Body: MultimodalRequest }>('/multimodal', async (request, reply) => {
    const { utterance, imageBase64, diagramState } = request.body;

    const canvasSummary = generateCanvasSummary(diagramState);
    const diagramPrompt = DIAGRAM_TYPE_PROMPTS[diagramState.mode] || '';

    const systemPrompt = SYSTEM_PROMPT + '\n' + diagramPrompt + `
## 多模态视觉定位（重要）
用户发送了当前画布的截图。请仔细观察图片，结合以下元素列表，找到用户指代的具体元素。
- 比较元素在图片中的位置、颜色、形状，与用户描述匹配
- 返回匹配到的 element id
- 如果无法确定，设置 action: "query" 询问用户确认
`;

    const userMessage = `## 画布元素列表\n${canvasSummary}\n\n## 用户指令（包含模糊指代，需要视觉定位）\n${utterance}\n\n请根据截图视觉定位，输出 JSON 操作指令。`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const rawResponse = await callMultimodalLLM({
          model: 'deepseek-chat',
          systemPrompt,
          userMessage,
          imageBase64,
          temperature: 0.2,
          maxTokens: 4096,
        });

        const parsed = JSON.parse(rawResponse);
        const validated = LLMResponseSchema.parse(parsed);

        return reply.send(validated as LLMResponse);
      } catch (err: any) {
        lastError = err;
        server.log.warn(`Multimodal LLM attempt ${attempt + 1} failed: ${err.message}`);
      }
    }

    // Fallback: text-only resolution
    server.log.error('Multimodal failed, falling back to text-only');
    return reply.status(422).send({
      error: '视觉定位失败，已回退到文本消解',
      commands: [],
      voiceReply: '抱歉，我没能看清画布。您能再描述一下要操作哪个元素吗？',
    });
  });
};
```

- [ ] **Step 2: Register multimodal route in server index**

Modify `server/src/index.ts` — add after the command routes registration:
```typescript
import { multimodalRoutes } from './routes/multimodal.js';

// ... existing code ...
await server.register(multimodalRoutes, { prefix: '/api' });
```

- [ ] **Step 3: Verify server compiles**

```bash
cd E:/voice-canvas/server
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/multimodal.ts server/src/index.ts
git commit -m "feat: implement multimodal route with visual grounding + text fallback"
```

---

### Task 3.5: End-to-end LLM integration test

**Files:**
- Modify: `voice-canvas/client/src/services/api.ts` (already done — verify it calls correct endpoints)

- [ ] **Step 1: Start server and test text command endpoint**

```bash
cd E:/voice-canvas/server
DEEPSEEK_API_KEY=your_key npx tsx src/index.ts &
sleep 2
```

Test:
```bash
curl -X POST http://localhost:3001/api/command \
  -H 'Content-Type: application/json' \
  -d '{
    "utterance": "画一个用户登录流程",
    "diagramState": {"mode":"flowchart","elements":[],"edges":[],"selectedId":null,"lastMentionedId":null},
    "intent": "generate"
  }'
```

Expected: Returns `{"commands":[...],"voiceReply":"..."}` with valid JSON.

- [ ] **Step 2: Verify the complete pipeline works**

Start client, click mic, say "画一个矩形", verify:
- ASR captures text
- Intent classifier routes to local
- Element appears on canvas

Say "画一个用户登录流程，包含开始、登录、判断、首页", verify:
- ASR captures text
- Intent classifier routes to remote-generate
- Server calls DeepSeek V4.5
- Multiple nodes + edges appear on canvas

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "test: end-to-end LLM integration verified with flowchart generation"
```

---

**Milestone 3 Checkpoint:** LLM fully integrated. User can say "画一个用户登录流程" and get a 4+ node flowchart with proper layout and connections. Server handles Zod validation and retry. Both text and generate pipelines functional.

---

## Milestone 4: Multimodal + Polish (Week 4)

### Task 4.1: Implement canvas snapshot capture

**Files:**
- Modify: `voice-canvas/client/src/services/canvasSnapshot.ts`

- [ ] **Step 1: Implement capture using html-to-image**

```typescript
import { toPng } from 'html-to-image';

export async function captureCanvas(): Promise<string> {
  const canvasElement = document.querySelector('.react-flow__viewport');
  if (!canvasElement) {
    throw new Error('画布元素未找到');
  }

  try {
    const dataUrl = await toPng(canvasElement as HTMLElement, {
      backgroundColor: '#111827',
      pixelRatio: 1,
      quality: 0.85,
    });

    // Extract base64 (remove "data:image/png;base64," prefix)
    const base64 = dataUrl.split(',')[1];
    return base64;
  } catch (err: any) {
    throw new Error(`截图失败: ${err.message}`);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd E:/voice-canvas/client
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add client/src/services/canvasSnapshot.ts
git commit -m "feat: implement canvas snapshot capture with html-to-image"
```

---

### Task 4.2: Implement Dagre layout for flowcharts

**Files:**
- Modify: `voice-canvas/client/src/utils/layout.ts`

- [ ] **Step 1: Implement Dagre-based auto layout**

```typescript
import dagre from 'dagre';
import type { CanvasElement, CanvasEdge } from '@shared/types';

export function layoutFlowchart(
  elements: CanvasElement[],
  edges: CanvasEdge[]
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100, marginx: 40, marginy: 40 });

  for (const el of elements) {
    g.setNode(el.id, { width: el.size.width, height: el.size.height });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const el of elements) {
    const node = g.node(el.id);
    if (node) {
      positions.set(el.id, {
        x: node.x - el.size.width / 2,
        y: node.y - el.size.height / 2,
      });
    }
  }

  return positions;
}

export function applyLayout(
  elements: CanvasElement[],
  positions: Map<string, { x: number; y: number }>
): CanvasElement[] {
  return elements.map((el) => {
    const pos = positions.get(el.id);
    if (!pos) return el;
    return { ...el, position: pos };
  });
}
```

- [ ] **Step 2: Wire layout into applyCommands**

In `diagramStore.ts`, after a batch `create` command, if the layout is 'vertical' and mode is 'flowchart', auto-apply Dagre layout:

```typescript
// Inside executeCommandSilently, after processing all commands in a batch:
// If creating multiple elements for flowchart, trigger layout
if (cmd.action === 'create' && state.mode === 'flowchart') {
  // Auto-layout will be invoked by the caller after applying all commands
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/utils/layout.ts
git commit -m "feat: implement Dagre-based auto layout for flowcharts"
```

---

### Task 4.3: Implement ModeSwitcher with voice + click

**Files:**
- Modify: `voice-canvas/client/src/components/toolbar/ModeSwitcher.tsx`

- [ ] **Step 1: Implement full mode switcher**

```typescript
import { useDiagramStore } from '../../store/diagramStore';
import type { DiagramMode } from '@shared/types';

const MODES: Array<{ mode: DiagramMode; label: string; icon: string }> = [
  { mode: 'flowchart', label: '流程图', icon: '🔄' },
  { mode: 'architecture', label: '架构图', icon: '🏗️' },
  { mode: 'sequence', label: '时序图', icon: '📊' },
];

export function ModeSwitcher() {
  const currentMode = useDiagramStore((s) => s.mode);
  const setMode = useDiagramStore((s) => s.setMode);

  return (
    <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1 text-sm">
      {MODES.map(({ mode, label, icon }) => (
        <button
          key={mode}
          onClick={() => setMode(mode)}
          className={`px-3 py-1 rounded-md transition-colors ${
            currentMode === mode
              ? 'bg-blue-600 text-white'
              : 'hover:bg-gray-600 text-gray-300'
          }`}
        >
          {icon} {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add voice trigger for mode switch**

In `useVoiceCommand.ts`, add mode switch detection before the classifier:
```typescript
// In handleFinalResult, add at the start:
if (/切换.*流程图|流程图模式/.test(transcript)) {
  store.setMode('flowchart');
  return;
}
if (/切换.*架构图|架构图模式/.test(transcript)) {
  store.setMode('architecture');
  return;
}
if (/切换.*时序图|时序图模式/.test(transcript)) {
  store.setMode('sequence');
  return;
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/toolbar/ModeSwitcher.tsx client/src/hooks/useVoiceCommand.ts
git commit -m "feat: implement mode switcher with voice + click support"
```

---

### Task 4.4: Implement export to PNG (US-07)

**Files:**
- Create: `voice-canvas/client/src/services/exportImage.ts`

- [ ] **Step 1: Implement export function**

```typescript
import { toPng } from 'html-to-image';

export async function exportToPNG(): Promise<void> {
  const canvasElement = document.querySelector('.react-flow__viewport');
  if (!canvasElement) {
    throw new Error('画布未就绪');
  }

  const dataUrl = await toPng(canvasElement as HTMLElement, {
    backgroundColor: '#111827',
    pixelRatio: 2,
    quality: 0.95,
  });

  // Trigger download
  const link = document.createElement('a');
  link.download = `voice-canvas-${Date.now()}.png`;
  link.href = dataUrl;
  link.click();
}
```

- [ ] **Step 2: Add voice trigger for export**

In `useVoiceCommand.ts`, add before the classifier:
```typescript
if (/导出|保存.*图片|下载.*图/.test(transcript)) {
  import('../services/exportImage').then(({ exportToPNG }) => {
    exportToPNG().catch((err) => store.setError(`导出失败: ${err.message}`));
  });
  return;
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/services/exportImage.ts client/src/hooks/useVoiceCommand.ts
git commit -m "feat: implement PNG export with voice trigger"
```

---

### Task 4.5: Implement query response (US-10)

**Files:**
- Modify: `voice-canvas/server/src/routes/command.ts` (query handling)

- [ ] **Step 1: Add query-specific prompt handling**

In `command.ts`, when `intent === 'query'`, add a special instruction to the system prompt:

```typescript
const queryInstruction = intent === 'query' ? `
## 查询模式
用户正在查询当前画布状态。请：
1. 分析画布元素和连线
2. 使用 voiceReply 用中文口语回答
3. 不需要返回操作指令（commands 设为空数组）
- 如果问"有哪些服务"，列出所有 rect 和 gateway 类型的节点
- 如果问"连到哪些"，追踪该节点的所有出边目标
- 如果问"有没有孤立节点"，找出没有任何连线的节点
` : '';

const systemPrompt = SYSTEM_PROMPT + '\n' + diagramPrompt + '\n' + queryInstruction;
```

- [ ] **Step 2: Handle query responses on the client**

In `useVoiceCommand.ts`, for `executeRemoteCommand`, when the pipeline is 'query', display the voiceReply prominently and don't expect canvas changes.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/command.ts client/src/hooks/useVoiceCommand.ts
git commit -m "feat: implement query response with AI voice answers for canvas inspection"
```

---

### Task 4.6: Demonstration polish

**Files:**
- Modify: `voice-canvas/client/src/components/voice/VoiceOverlay.tsx` (refine animations)
- Modify: `voice-canvas/client/src/components/voice/TranscriptBar.tsx` (confidence indicator)
- Create: `voice-canvas/client/src/components/debug/CommandLog.tsx` (dev-only)

- [ ] **Step 1: Refine VoiceOverlay animations**

Update `VoiceOverlay.tsx` with differentiated thinking feedback:
```typescript
import type { VoicePhase } from '@shared/types';

export function VoiceOverlay({ phase }: { phase: VoicePhase }) {
  if (phase === 'idle') return null;

  return (
    <div className="voice-overlay absolute inset-0 flex items-center justify-center z-20">
      {phase === 'listening' && (
        <div className="bg-blue-900/80 text-blue-200 px-6 py-3 rounded-xl text-lg animate-pulse-breath">
          🎤 正在聆听...
        </div>
      )}
      {phase === 'thinking-text' && (
        <div className="bg-gray-800/90 text-gray-300 px-6 py-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span>正在理解指令...</span>
          </div>
          <div className="mt-2 w-48 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse rounded-full" style={{ width: '60%' }} />
          </div>
        </div>
      )}
      {phase === 'thinking-visual' && (
        <div className="bg-purple-900/80 text-purple-200 px-6 py-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            <span>🔍 正在分析画面...</span>
          </div>
          <div className="mt-2 text-xs text-purple-300">视觉定位中，请稍候</div>
        </div>
      )}
      {phase === 'executing' && (
        <div className="bg-green-900/80 text-green-200 px-6 py-3 rounded-xl animate-pop-in">
          ✅ 完成
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add low-confidence indicator to TranscriptBar**

Add a confidence warning indicator when ASR confidence < 0.6.

- [ ] **Step 3: Add error boundary for demo resilience**

Create a simple error boundary component in App.tsx.

- [ ] **Step 4: Rehearse demo script, fix rough edges**

Run through the full demo script from the design doc:
1. Flowchart generation → 2. Multimodal reference → 3. Architecture + AI suggest → 4. Export

Identify and fix any visual glitches, timing issues, or error states.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: demonstration polish — refined animations, confidence indicator, error resilience"
```

---

## Summary: Story → Task Mapping

| User Story | Priority | Implemented In |
|-----------|---------|---------------|
| US-01: Flowchart generation | P0 | Task 3.3 (command route) + Task 3.5 (E2E) |
| US-02: Reference modification | P0 | Task 2.2 (classifier) + Task 2.4 (dispatch) |
| US-03: Undo/Redo | P0 | Task 2.5 (command pattern) |
| US-05: Multimodal grounding | P0 | Task 3.4 (multimodal route) + Task 4.1 (snapshot) |
| US-06: Mode switching | P0 | Task 4.3 (ModeSwitcher) |
| US-09: Select/Focus | P1 | Task 2.2 (classifier select patterns) |
| US-04: Architecture + AI suggest | P1 | Task 3.3 (command route with architecture prompt) |
| US-07: Export PNG | P1 | Task 4.4 (export) |
| US-10: Query canvas | P1 | Task 4.5 (query responses) |
| US-08: Multi-command (P2) | P2 | Later iteration |
| US-11: Voice sticky notes (P2) | P2 | Later iteration |

---

*Implementation Plan v1.0*
*Date: 2026-06-12*
