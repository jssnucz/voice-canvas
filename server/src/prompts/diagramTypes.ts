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
- 服务/组件用 "rect"，数据库/存储用 "cylinder"，队列/事件总线用 "queue"
- 缓存/本地存储用 "cache"，网关/代理/协议网关用 "gateway"，外部系统/客户端用 "actor"
- 同步调用/请求-响应（RPC、HTTP、函数调用）用 "solid"
- 异步消息/事件推送/流式传输（消息队列、SSE、WebSocket）用 "dashed"
- 节点间距 150-200px，大图可缩小到 120px
- 检测到微服务/分布式/电商/协议/框架/中间件/平台等架构关键词时，必须激活领域知识，主动补充典型组件
- 连线 label 标注协议名或调用方式（如 "JSON-RPC"、"HTTP/2"、"gRPC"、"AMQP"）
`,

  sequence: `
## 时序图专用规则
- 参与者用 "rect" 节点，水平等距排列
- 生命线用 "lifeline" 从参与者下方延伸
- 消息用 "solid"（调用）或 "dashed"（返回）
- 时间轴自上而下，参与者从左到右间距 200px
`,
};
