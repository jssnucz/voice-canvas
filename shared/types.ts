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
  auto: string[];
  manual: string[];
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
export type DeltaCommand = {
  reasoning?: string;
} & (
  | {
      action: 'create';
      targets?: never;
      payload: {
        elements?: Partial<CanvasElement>[];
        edges?: Partial<CanvasEdge>[];
        layout?: 'vertical' | 'horizontal' | 'grid';
      };
    }
  | {
      action: 'update' | 'delete' | 'move';
      targets: string[];
      payload?: {
        elements?: Partial<CanvasElement>[];
        edges?: Partial<CanvasEdge>[];
        layout?: 'vertical' | 'horizontal' | 'grid';
      };
    }
  | {
      action: 'connect';
      targets: [string, string];
      payload?: {
        edges?: Partial<CanvasEdge>[];
      };
    }
  | {
      action: 'query';
      targets: string[];
      payload?: never;
    }
);

// ========== DeltaCommand factory functions ==========
// Eliminates the need for `as DeltaCommand` type assertions in client code.

export function makeCreateCommand(opts: {
  elements?: Partial<CanvasElement>[];
  edges?: Partial<CanvasEdge>[];
  layout?: 'vertical' | 'horizontal' | 'grid';
  reasoning?: string;
}): DeltaCommand {
  return { action: 'create', payload: { elements: opts.elements, edges: opts.edges, layout: opts.layout }, reasoning: opts.reasoning };
}

export function makeUpdateCommand(targets: string[], elements: Partial<CanvasElement>[], reasoning?: string): DeltaCommand {
  return { action: 'update', targets, payload: { elements }, reasoning };
}

export function makeDeleteCommand(targets: string[], reasoning?: string): DeltaCommand {
  return { action: 'delete', targets, payload: { elements: [] }, reasoning };
}

export function makeMoveCommand(targets: string[], positions: { x: number; y: number }[], reasoning?: string): DeltaCommand {
  return { action: 'move', targets, payload: { elements: positions.map(p => ({ position: p })) }, reasoning };
}

export function makeConnectCommand(source: string, target: string, edge?: Partial<CanvasEdge>, reasoning?: string): DeltaCommand {
  return { action: 'connect', targets: [source, target], payload: { edges: edge ? [edge] : [{ type: 'solid' }] }, reasoning };
}

export function makeQueryCommand(targets: string[], reasoning?: string): DeltaCommand {
  return { action: 'query', targets, reasoning };
}

export interface LLMResponse {
  commands: DeltaCommand[];
  voiceReply?: string;
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

// ========== Diagram State ==========
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
      size: { width: number; height: number };
      style: ElementStyle;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      type: 'solid' | 'dashed';
      label?: string;
      style?: { stroke?: string; strokeWidth?: number };
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

// ========== Diagram Storage API Types ==========
export interface DiagramListItem {
  id: string;
  name: string;
  mode: DiagramMode;
  updated_at: string;
}

export interface DiagramDetail {
  id: string;
  name: string;
  mode: DiagramMode;
  state: {
    mode: DiagramMode;
    elements: Array<{
      id: string;
      type: ElementType;
      label: string;
      voiceAliases: VoiceAliases;
      position: { x: number; y: number };
      size: { width: number; height: number };
      style: ElementStyle;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      type: 'solid' | 'dashed';
      label?: string;
      style?: { stroke?: string; strokeWidth?: number };
    }>;
    selectedId: string | null;
    lastMentionedId: string | null;
  };
  created_at: string;
  updated_at: string;
}

export interface CreateDiagramBody {
  name?: string;
  mode?: DiagramMode;
  state: DiagramDetail['state'];
}

export interface UpdateDiagramBody {
  name?: string;
  state?: DiagramDetail['state'];
}

// ========== Default styles per element type ==========
export const ELEMENT_DEFAULTS: Record<ElementType, { width: number; height: number; fill: string; stroke: string }> = {
  'rounded-rect': { width: 160, height: 60, fill: '#f0fdf4', stroke: '#1a1a1a' },
  'rect': { width: 160, height: 60, fill: '#eff6ff', stroke: '#1a1a1a' },
  'diamond': { width: 140, height: 80, fill: '#fff7ed', stroke: '#1a1a1a' },
  'cylinder': { width: 140, height: 80, fill: '#faf5ff', stroke: '#1a1a1a' },
  'ellipse': { width: 160, height: 60, fill: '#ecfeff', stroke: '#1a1a1a' },
  'actor': { width: 60, height: 100, fill: '#fef2f2', stroke: '#1a1a1a' },
  'queue': { width: 160, height: 50, fill: '#fefce8', stroke: '#1a1a1a' },
  'cache': { width: 120, height: 50, fill: '#fff1f2', stroke: '#1a1a1a' },
  'gateway': { width: 140, height: 60, fill: '#eef2ff', stroke: '#1a1a1a' },
  'lifeline': { width: 120, height: 400, fill: 'transparent', stroke: '#1a1a1a' },
  'sticky-note': { width: 160, height: 80, fill: '#fefce8', stroke: '#1a1a1a' },
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
