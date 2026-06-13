import type { ElementType, DeltaCommand } from '@shared/types';
import { makeCreateCommand, makeUpdateCommand, makeDeleteCommand } from '@shared/types';

export interface ClassifiedIntent {
  type: 'local' | 'remote-text' | 'remote-visual' | 'remote-generate' | 'remote-query';
  commands?: DeltaCommand[];
  utterance: string;
  reason: string;
  /** Discriminator for action routing — use this instead of reason string matching. */
  localAction?: 'undo' | 'redo' | 'clear' | 'select' | 'zoom-in' | 'zoom-out' | 'fit-view' | 'create' | 'command';
}

// Category 1: Create basic shapes (7 commands, includes sticky-note)
const CREATE_PATTERNS: Array<{ regex: RegExp; elementType: ElementType }> = [
  { regex: /画.*?(?:圆角矩形|开始|结束|起止)/, elementType: 'rounded-rect' },
  { regex: /画.*?(?:矩形|方框|方块|框)/, elementType: 'rect' },
  { regex: /画.*?(?:菱形|判断|条件)/, elementType: 'diamond' },
  { regex: /画.*?(?:圆|椭圆|圆形)/, elementType: 'ellipse' },
  { regex: /画.*?(?:圆柱|数据库)/, elementType: 'cylinder' },
  { regex: /画.*?(?:小人|人物|参与者|用户|外部)/, elementType: 'actor' },
  { regex: /画.*?(?:便签|备注|注释)(?!(：|:))/u, elementType: 'sticky-note' },
];

// Category 1b: Sticky note with content — extracts label after colon
const STICKY_CONTENT_RE = /(?:在这|这里|加个?|添加|创建|写个?|新建|画个?).*?(?:备注|便签|注释)[：:]\s*(.+)/u;
const STICKY_CONTENT_SHORT_RE = /(?:备注|便签|注释)[：:]\s*(.+)/u;

// Category 2: Delete (3 patterns)
const DELETE_PATTERNS = [
  /删除|移除|去掉|删掉/,
];

// Category 3: Undo/Redo (3 patterns)
const UNDO_PATTERNS = [/撤销|回退|撤回/];
const REDO_PATTERNS = [/重做|恢复|前进/];

// Category 4: Select/Focus (3 patterns)
const SELECT_PATTERNS = [/选中|选择|聚焦|看这个/];

// Category 5: View control (4 patterns)
const ZOOM_IN = /放大/;
const ZOOM_OUT = /缩小/;
const FIT_VIEW = /适应|适合|全部显示|全景/;
const CLEAR = /清空|清除|全部删/;

// Category 6: Style presets (8 patterns)
const COLOR_RED = /变红|红色|红的/;
const COLOR_BLUE = /变蓝|蓝色|蓝的/;
const COLOR_GREEN = /变绿|绿色|绿的/;
const COLOR_YELLOW = /变黄|黄色|黄的/;
const SIZE_BIGGER = /变大|大一点|加大/;
const SIZE_SMALLER = /变小|小一点/;
// Label / text update
const LABEL_UPDATE_RE = /(?:写上|改成|命名为|标签.*?(?:改为|改成|是)|文字.*?(?:改成|改为|是))(.+)/u;

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

  // Priority 1: Ambiguous references
  if (AMBIGUOUS_REFS.test(text)) {
    return { type: 'remote-visual', utterance: text, reason: '包含模糊指代词' };
  }

  // Priority 2: Diagram generation
  if (GENERATE_KEYWORDS.test(text)) {
    return { type: 'remote-generate', utterance: text, reason: '包含图表生成关键词' };
  }

  // Priority 3: Query
  if (QUERY_KEYWORDS.test(text)) {
    return { type: 'remote-query', utterance: text, reason: '包含查询关键词' };
  }

  // Priority 4: Local commands
  const hasTarget = hasSelectedTarget || hasLastMentioned;

  // Undo — always local
  if (UNDO_PATTERNS.some((p) => p.test(text))) {
    return { type: 'local', commands: [], utterance: text, reason: '撤销指令，本地执行', localAction: 'undo' };
  }
  // Redo — always local
  if (REDO_PATTERNS.some((p) => p.test(text))) {
    return { type: 'local', commands: [], utterance: text, reason: '重做指令，本地执行', localAction: 'redo' };
  }

  // View controls — always local (but when a target exists, zoom may be overridden by size-change below)
  if (!hasTarget) {
    if (ZOOM_IN.test(text)) return { type: 'local', commands: [], utterance: text, reason: '缩放指令，本地执行', localAction: 'zoom-in' };
    if (ZOOM_OUT.test(text)) return { type: 'local', commands: [], utterance: text, reason: '缩放指令，本地执行', localAction: 'zoom-out' };
    if (FIT_VIEW.test(text)) return { type: 'local', commands: [], utterance: text, reason: '视图适配，本地执行', localAction: 'fit-view' };
  }
  if (CLEAR.test(text)) return { type: 'local', commands: [], utterance: text, reason: '清空画布，本地执行', localAction: 'clear' };

  // Delete — needs target
  if (DELETE_PATTERNS.some((p) => p.test(text)) && hasTarget) {
    return {
      type: 'local',
      commands: [makeDeleteCommand([hasSelectedTarget ? 'selected' : 'lastMentioned'])],
      utterance: text,
      reason: '删除指令，本地执行',
      localAction: 'command',
    };
  }

  // Select
  if (SELECT_PATTERNS.some((p) => p.test(text))) {
    return { type: 'local', commands: [], utterance: text, reason: '选择指令', localAction: 'select' };
  }

  // Sticky note with content — extract label from utterance
  const stickyContentMatch = text.match(STICKY_CONTENT_RE) ?? text.match(STICKY_CONTENT_SHORT_RE);
  if (stickyContentMatch) {
    const noteContent = stickyContentMatch[1].trim();
    return {
      type: 'local',
      commands: [makeCreateCommand({ elements: [{ type: 'sticky-note', label: noteContent }] })],
      utterance: text,
      reason: '创建便签（含内容），本地执行',
      localAction: 'create',
    };
  }

  // Create — single element
  for (const pattern of CREATE_PATTERNS) {
    if (pattern.regex.test(text)) {
      return {
        type: 'local',
        commands: [makeCreateCommand({ elements: [{ type: pattern.elementType }] })],
        utterance: text,
        reason: `创建${pattern.elementType}，本地执行`,
        localAction: 'create',
      };
    }
  }

  // Label / text update — needs target
  if (hasTarget) {
    const labelMatch = text.match(LABEL_UPDATE_RE);
    if (labelMatch) {
      const newLabel = labelMatch[1].trim();
      const target = hasSelectedTarget ? 'selected' : 'lastMentioned';
      return {
        type: 'local',
        commands: [makeUpdateCommand([target], [{ label: newLabel }])],
        utterance: text,
        reason: `标签更新为"${newLabel}"，本地执行`,
        localAction: 'command',
      };
    }
  }

  // Style changes — need target
  if (hasTarget) {
    const target = hasSelectedTarget ? 'selected' : 'lastMentioned';
    const targetArr = [target];

    if (COLOR_RED.test(text)) {
      return {
        type: 'local',
        commands: [makeUpdateCommand(targetArr, [{ style: { fill: '#FFCDD2', stroke: '#F44336', fontSize: 14, fontWeight: 'normal' } }])],
        utterance: text,
        reason: '样式修改，本地执行',
        localAction: 'command',
      };
    }
    if (COLOR_BLUE.test(text)) {
      return {
        type: 'local',
        commands: [makeUpdateCommand(targetArr, [{ style: { fill: '#BBDEFB', stroke: '#2196F3', fontSize: 14, fontWeight: 'normal' } }])],
        utterance: text,
        reason: '样式修改，本地执行',
        localAction: 'command',
      };
    }
    if (COLOR_GREEN.test(text)) {
      return {
        type: 'local',
        commands: [makeUpdateCommand(targetArr, [{ style: { fill: '#C8E6C9', stroke: '#4CAF50', fontSize: 14, fontWeight: 'normal' } }])],
        utterance: text,
        reason: '样式修改，本地执行',
        localAction: 'command',
      };
    }
    if (COLOR_YELLOW.test(text)) {
      return {
        type: 'local',
        commands: [makeUpdateCommand(targetArr, [{ style: { fill: '#FFF9C4', stroke: '#FBC02D', fontSize: 14, fontWeight: 'normal' } }])],
        utterance: text,
        reason: '样式修改，本地执行',
        localAction: 'command',
      };
    }
    if (SIZE_BIGGER.test(text)) {
      return {
        type: 'local',
        commands: [makeUpdateCommand(targetArr, [{
          size: { width: 1.3, height: 1.3 },
          metadata: { sizeMode: 'scale' } as Record<string, unknown>,
        }])],
        utterance: text,
        reason: '尺寸修改，本地执行',
        localAction: 'command',
      };
    }
    if (SIZE_SMALLER.test(text)) {
      return {
        type: 'local',
        commands: [makeUpdateCommand(targetArr, [{
          size: { width: 0.75, height: 0.75 },
          metadata: { sizeMode: 'scale' } as Record<string, unknown>,
        }])],
        utterance: text,
        reason: '尺寸修改，本地执行',
        localAction: 'command',
      };
    }
  }

  // Fallback: send to remote text pipeline
  return { type: 'remote-text', utterance: text, reason: '未命中本地规则，走云端解析' };
}

// ---- Multi-command splitting ----

/**
 * Splits a compound utterance into sub-commands.
 * Uses Chinese punctuation (， 、 ；) and connectors (然后 接着 并且 同时 再).
 * Returns the original utterance as a single-element array if no split is needed.
 */
export function splitUtterance(utterance: string): string[] {
  // Step 0: Strip leading connectors (e.g. "再说一遍" → "说一遍", "再画一个矩形" → "画一个矩形")
  const CONNECTORS = ['然后', '接着', '并且', '同时', '再'];
  const stripped = utterance.replace(new RegExp(`^(${CONNECTORS.join('|')})\\s*`), '');

  // Step 1: Split on Chinese punctuation
  const byPunctuation = stripped
    .split(/[，、；]/)
    .map(s => s.trim())
    .filter(Boolean);

  if (byPunctuation.length > 1) return byPunctuation;

  // Step 2: Try splitting on connectors
  const pattern = new RegExp(`(${CONNECTORS.join('|')})`);
  const byConnector = stripped
    .split(pattern)
    .map(s => s.trim())
    .filter(Boolean);

  if (byConnector.length <= 1) return [utterance];

  // Drop standalone connector tokens, keep content parts
  const result: string[] = [];
  for (const part of byConnector) {
    if (!CONNECTORS.includes(part)) {
      result.push(part);
    }
  }
  return result.length > 1 ? result : [utterance];
}
