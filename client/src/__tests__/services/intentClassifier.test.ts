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
    const result = classifyIntent('系统A连到了哪些系统', false, false);
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

  it('detects rounded-rect from "画一个结束"', () => {
    const result = classifyIntent('画一个结束', false, false);
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
    expect(result.commands?.[0].payload?.elements?.[0].label).toBeUndefined();
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

  it('returns update command for "命名为首页" with lastMentioned', () => {
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
