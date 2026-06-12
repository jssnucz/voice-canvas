import type { ElementType, DeltaCommand } from '@shared/types';

export interface ClassifiedIntent {
  type: 'local' | 'remote-text' | 'remote-visual' | 'remote-generate' | 'remote-query';
  commands?: DeltaCommand[];
  utterance: string;
  reason: string;
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
const SELECT_PATTERNS = [/选中|选择|聚焦|看这个/];

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
    return { type: 'local', commands: [], utterance: text, reason: '撤销指令，本地执行' };
  }
  // Redo — always local
  if (REDO_PATTERNS.some((p) => p.test(text))) {
    return { type: 'local', commands: [], utterance: text, reason: '重做指令，本地执行' };
  }

  // View controls — always local
  if (ZOOM_IN.test(text)) return { type: 'local', commands: [], utterance: text, reason: '缩放指令，本地执行' };
  if (ZOOM_OUT.test(text)) return { type: 'local', commands: [], utterance: text, reason: '缩放指令，本地执行' };
  if (FIT_VIEW.test(text)) return { type: 'local', commands: [], utterance: text, reason: '视图适配，本地执行' };
  if (CLEAR.test(text)) return { type: 'local', commands: [], utterance: text, reason: '清空画布，本地执行' };

  // Delete — needs target
  if (DELETE_PATTERNS.some((p) => p.test(text)) && hasTarget) {
    return {
      type: 'local',
      commands: [{
        action: 'delete',
        targets: [hasSelectedTarget ? 'selected' : 'lastMentioned'],
      } as DeltaCommand],
      utterance: text,
      reason: '删除指令，本地执行',
    };
  }

  // Select
  if (SELECT_PATTERNS.some((p) => p.test(text))) {
    return { type: 'local', commands: [], utterance: text, reason: '选择指令' };
  }

  // Create — single element
  for (const pattern of CREATE_PATTERNS) {
    if (pattern.regex.test(text)) {
      return {
        type: 'local',
        commands: [{
          action: 'create',
          payload: {
            elements: [{ type: pattern.elementType }],
          },
        } as DeltaCommand],
        utterance: text,
        reason: `创建${pattern.elementType}，本地执行`,
      };
    }
  }

  // Style changes — need target
  if (hasTarget) {
    const target = hasSelectedTarget ? 'selected' : 'lastMentioned';
    const targetArr = [target];

    if (COLOR_RED.test(text)) {
      return { type: 'local', commands: [{ action: 'update', targets: targetArr, payload: { elements: [{ style: { fill: '#FFCDD2', stroke: '#F44336' } }] } } as DeltaCommand], utterance: text, reason: '样式修改，本地执行' };
    }
    if (COLOR_BLUE.test(text)) {
      return { type: 'local', commands: [{ action: 'update', targets: targetArr, payload: { elements: [{ style: { fill: '#BBDEFB', stroke: '#2196F3' } }] } } as DeltaCommand], utterance: text, reason: '样式修改，本地执行' };
    }
    if (COLOR_GREEN.test(text)) {
      return { type: 'local', commands: [{ action: 'update', targets: targetArr, payload: { elements: [{ style: { fill: '#C8E6C9', stroke: '#4CAF50' } }] } } as DeltaCommand], utterance: text, reason: '样式修改，本地执行' };
    }
    if (COLOR_YELLOW.test(text)) {
      return { type: 'local', commands: [{ action: 'update', targets: targetArr, payload: { elements: [{ style: { fill: '#FFF9C4', stroke: '#FBC02D' } }] } } as DeltaCommand], utterance: text, reason: '样式修改，本地执行' };
    }
    if (SIZE_BIGGER.test(text)) {
      return { type: 'local', commands: [{ action: 'update', targets: targetArr, payload: { elements: [{ size: { width: 200, height: 80 } }] } } as DeltaCommand], utterance: text, reason: '尺寸修改，本地执行' };
    }
    if (SIZE_SMALLER.test(text)) {
      return { type: 'local', commands: [{ action: 'update', targets: targetArr, payload: { elements: [{ size: { width: 120, height: 50 } }] } } as DeltaCommand], utterance: text, reason: '尺寸修改，本地执行' };
    }
  }

  // Fallback: send to remote text pipeline
  return { type: 'remote-text', utterance: text, reason: '未命中本地规则，走云端解析' };
}
