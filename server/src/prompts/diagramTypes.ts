import type { DiagramMode } from '@shared/types';

export const DIAGRAM_TYPE_PROMPTS: Record<DiagramMode, string> = {
  flowchart: `
## 流程图专用规则
- 有且仅有一个开始节点（rounded-rect），只有出边
- 至少一个结束节点（rounded-rect），只有入边
- 判断节点（diamond）必须有恰好两条出边
- 垂直布局（从上到下），间距 120px
`,

  architecture: `
## 架构图专用规则
- 服务用 "rect"，数据库用 "cylinder"，队列用 "queue"
- 缓存用 "cache"，网关用 "gateway"，外部系统用 "actor"
- 同步调用用 "solid"，异步消息用 "dashed"
- 节点间距 150-200px
- 检测到微服务/分布式/电商架构关键词时，主动补充典型缺失组件并在 voiceReply 中询问
`,

  sequence: `
## 时序图专用规则
- 参与者用 "rect" 节点，水平等距排列
- 生命线用 "lifeline" 从参与者下方延伸
- 消息用 "solid"（调用）或 "dashed"（返回）
- 时间轴自上而下，参与者从左到右间距 200px
`,
};
