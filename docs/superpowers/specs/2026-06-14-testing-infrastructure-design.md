# 测试基础设施 —— 项目设计书

---

## 一、目标与范围

为 voice-canvas 全栈项目建立完整的测试体系。当前项目**零测试**，需从零搭建基础设施并覆盖所有核心模块。

### 覆盖范围

- **shared/** — DeltaCommand 工厂函数、ELEMENT_DEFAULTS 常量
- **client/**
  - store: Zustand diagramStore（CRUD、undo/redo、applyCommands、inverse 计算）
  - services: intentClassifier（25+ 规则）、stateSerializer、apiClient（fetch mock）、imageExport（canvasSnapshot + exportImage 合并测试）、speechSynthesis
  - utils: generateId、Dagre layout
- **server/**
  - validators: Zod LLMResponseSchema 校验
  - utils: canvasSummary 摘要生成
  - services: selectModel 纯函数 + callLLM mock 验证

### 不覆盖（投入产出比低、留待后续）

- React hooks（useSpeechRecognition、useVoiceCommand）— 需 React Testing Library，二期
- 自定义节点/边组件 — 纯视觉组件，视觉回归测试投入产出比低

---

## 二、测试框架选型

**Vitest** — 统一 client/server/shared 三个 workspace。

| 维度 | 理由 |
|------|------|
| Vite 生态 | client 已用 Vite，共享 transform 管线 |
| ESM 原生 | 三个包均为 `"type": "module"` |
| Monorepo | workspace 模式天然支持多包 |
| Watch mode | 比 Jest 快 10x+ |
| API | Jest 兼容，迁移成本为零 |
| 插件 | vite-tsconfig-paths 解析 `@shared/*` 别名 |

---

## 三、基础设施

### 3.1 依赖

```json
// root package.json (devDependencies)
"vitest": "^3.2.0"
"@vitest/coverage-v8": "^3.2.0"

// client + server workspace (devDependencies)
"vite-tsconfig-paths": "^5.1.0"  // 解析 @shared/* 别名；shared 自身不需要
```

### 3.2 Workspace 配置

**`vitest.workspace.ts`**（仓库根目录）:
```ts
export default [
  'shared/vitest.config.ts',
  'client/vitest.config.ts',
  'server/vitest.config.ts',
]
```

**`shared/vitest.config.ts`**（无需 `vite-tsconfig-paths`，shared 自身不 import `@shared/*`）:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'shared',
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
});
```

**`client/vitest.config.ts`**:
```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: 'client',
    environment: 'jsdom',       // canvasSnapshot / exportImage / speechSynthesis 需要
    include: ['src/__tests__/**/*.test.ts'],
  },
});
```

**`server/vitest.config.ts`**:
```ts
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

### 3.3 npm scripts

```json
// root package.json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest run --coverage"
}
```

---

## 四、测试文件清单与重点

### 4.1 shared/__tests__/types.test.ts — 工厂函数 + 常量

| 被测项 | 测试点 |
|--------|--------|
| `makeCreateCommand` | 返回完整 DeltaCommand（action='create', payload.elements, payload.edges, layout, reasoning） |
| `makeUpdateCommand` | targets 正确透传，elements 携带 patch |
| `makeDeleteCommand` | targets 正确，payload.elements 为空数组 |
| `makeMoveCommand` | 多个 target 的 position 数组对应 |
| `makeConnectCommand` | source/target 正确，edge 默认 solid，支持自定义 |
| `makeQueryCommand` | targets 透传，无 payload |
| `ELEMENT_DEFAULTS` | 11 种类型各有 width/height/fill/stroke |
| `ELEMENT_LABELS` | 11 种类型各有中文标签 |

**类型**: 纯函数，无需 mock。

---

### 4.2 client/src/__tests__/store/diagramStore.test.ts — 状态机核心

| 被测项 | 测试点 |
|--------|--------|
| 初始状态 | mode='flowchart', elements={}, edges=[], selectedId=null, historyIndex=-1 |
| `createElement` | 返回完整 CanvasElement，含 id/type/label/position/size/style/voiceAliases |
| `addElement` | elements 新增条目，lastMentionedId 更新 |
| `updateElement` | label/style/size/position 合并更新；不存在的 id 无变更 |
| `deleteElement` | 元素移除、关联 edges 清除、selectedId/lastMentionedId 联动清空 |
| `moveElement` | position 更新；不存在的 id 无变更 |
| `addEdge / deleteEdge` | edges 数组增删 |
| `applyCommands (create)` | 元素创建、ID 记录、history 记录含 inverse（delete） |
| `applyCommands (delete)` | 元素删除、inverse（create with snapshot） |
| `applyCommands (update)` | 属性更新、inverse（旧值 snapshot） |
| `applyCommands (move)` | 位置更新、inverse（旧坐标） |
| `applyCommands (connect)` | 边创建、inverse（delete edge） |
| `undo / redo` | 单步撤销/重做、连续多步、边界（historyIndex=-1 / max） |
| `resolveTargets` | 'selected'→selectedId, 'lastMentioned'→lastMentionedId, 字面量→原值，null 过滤 |
| `clearAll` | 所有状态归零 |

**类型**: Zustand store 实例化测试，在每个 test 前 `useDiagramStore.setState(initialState)` 重置。

---

### 4.3 client/src/__tests__/services/intentClassifier.test.ts — 意图分类器

| 被测项 | 测试点 |
|--------|--------|
| `classifyIntent` — 模糊指代 | "那个"、"这个东西" → type='remote-visual' |
| `classifyIntent` — 图表生成 | "流程"、"架构"、"时序"、"微服务" → type='remote-generate' |
| `classifyIntent` — 查询 | "有哪些"、"连到了哪" → type='remote-query' |
| `classifyIntent` — 撤销/重做 | "撤销" → localAction='undo'；"重做" → localAction='redo' |
| `classifyIntent` — 视图控制 | "放大"/"缩小" → localAction zoom-in/zoom-out；"清空" → clear；有 target 时 zoom 不触发 |
| `classifyIntent` — 删除 | "删掉它" + hasTarget → localAction='command'；无 target 时升级为 remote-text |
| `classifyIntent` — 选择 | "选中订单服务" → localAction='select' |
| `classifyIntent` — 创建 7 种图形 | "画一个矩形"→rect, "画一个菱形"→diamond, "画一个数据库"→cylinder, "画一个小人"→actor, "画一个圆"→ellipse, "画一个开始"→rounded-rect |
| `classifyIntent` — 便签含内容 | "备注：需要确认接口" → sticky-note with label 提取；"在这里加个备注：xxx" |
| `classifyIntent` — 标签更新 | "文字改成用户登录" + hasTarget → localAction='command' |
| `classifyIntent` — 样式修改 | "变红"/"变蓝"/"变绿"/"变黄" → 对应色值；"变大"/"变小" → scale |
| `classifyIntent` — 降级 | 未命中任何规则 → type='remote-text' |
| `classifyIntent` — 优先级 | "那个判断节点" → visual 优先于 create；"这个节点连到了哪些" → visual 优先于 query |
| `splitUtterance` | 中文标点分割："画矩形，变红" → 2 条；连接词分割："画矩形然后变红" → 2 条；无分隔符 → 1 条；前导连接词剥离："再画一个" → 去掉"再" |

**类型**: 纯函数，无需 mock。这是测试数量最多的文件（~40+ cases）。

---

### 4.4 client/src/__tests__/services/stateSerializer.test.ts — 状态序列化

| 被测项 | 测试点 |
|--------|--------|
| `buildDiagramState` | 从 Zustand state 提取 mode/elements/edges/selectedId/lastMentionedId；elements 数组化；只包含 API 需要的字段 |

**类型**: 纯函数，传入构造的 state 对象。

---

### 4.5 client/src/__tests__/services/api.test.ts — API 客户端

| 被测项 | 测试点 |
|--------|--------|
| `apiClient.textCommand` | POST 到 /api/command，body 正确序列化；200 → 返回 JSON；非 200 → throw Error |
| `apiClient.multimodalCommand` | POST 到 /api/multimodal，携带 imageBase64；200/非 200 同上 |

**类型**: Mock `global.fetch`，验证 URL、method、headers、body。

---

### 4.6 client/src/__tests__/services/imageExport.test.ts — 截图 + 导出

| 被测项 | 测试点 |
|--------|--------|
| `captureCanvas` | `.react-flow__viewport` 不存在 → throw；正常 → 调用 toPng → 返回去掉 `data:...;base64,` 前缀的纯 base64 |
| `captureCanvas` | toPng rejects → throw 包含"截图失败" |
| `exportToPNG` | 正常流程 → toPng 被调用（pixelRatio=2, quality=0.95）→ link.download 设置正确文件名 → link.click 被调用 |
| `exportToPNG` | 元素不存在 → throw"画布未就绪" |

**Mock 策略**:
- `html-to-image` → `vi.mock('html-to-image', () => ({ toPng: vi.fn() }))`
- `document.querySelector` → `vi.spyOn(document, 'querySelector')`
- `document.createElement` + `link.click` → spy

---

### 4.7 client/src/__tests__/services/speechSynthesis.test.ts — TTS

| 被测项 | 测试点 |
|--------|--------|
| `speak` | 创建 SpeechSynthesisUtterance，lang='zh-CN'，rate=1.0；调用 speechSynthesis.cancel + speak |
| `speak` | speechSynthesis 不可用时不抛错 |

**Mock 策略**:
- `window.speechSynthesis` → `vi.spyOn` mock cancel/speak 方法
- `SpeechSynthesisUtterance` 构造函数 → jsdom 无此全局对象，必须 mock：`globalThis.SpeechSynthesisUtterance = vi.fn()`，然后验证构造参数（text, lang, rate）

---

### 4.8 client/src/__tests__/utils/id.test.ts — ID 生成

| 被测项 | 测试点 |
|--------|--------|
| `generateId` | 格式 `elem_<timestamp>_<counter>`；连续调用 counter 递增；时间戳合理 |

---

### 4.9 client/src/__tests__/utils/layout.test.ts — Dagre 布局

| 被测项 | 测试点 |
|--------|--------|
| `layoutFlowchart` | 空输入 → 空 Map；单节点 → 返回有效坐标；链式 3 节点 → y 坐标递增且不重叠（TB 布局）；每个节点坐标无 NaN/Infinity |

---

### 4.10 server/src/__tests__/validators/command.test.ts — Zod 校验

| 被测项 | 测试点 |
|--------|--------|
| `LLMResponseSchema.parse` | 合法最小 payload → 通过 |
| `LLMResponseSchema.parse` | 合法完整 payload（create + connect + voiceReply）→ 通过 |
| `LLMResponseSchema.parse` | 缺少 commands → 抛 ZodError |
| `LLMResponseSchema.parse` | action 不在枚举 → 抛 ZodError |
| `LLMResponseSchema.parse` | element type 不在枚举 → 抛 ZodError |
| `LLMResponseSchema.parse` | edge type 不是 solid/dashed → 抛 ZodError |
| `LLMResponseSchema.parse` | voiceReply 为 null → 通过（optional/nullable） |

**类型**: 纯函数，无需 mock。

---

### 4.11 server/src/__tests__/utils/canvasSummary.test.ts — 画布摘要

| 被测项 | 测试点 |
|--------|--------|
| `generateCanvasSummary` | 包含 mode；包含元素计数；包含元素详情（id/type/label/position）；selectedId/lastMentionedId 标记 [已选中]/[最近提及]；包含 edges；空画布不崩溃 |

---

### 4.12 server/src/__tests__/services/llm.test.ts — 模型选择 + LLM 调用

| 被测项 | 测试点 |
|--------|--------|
| `selectModel('visual')` | → MODEL_CHAT |
| `selectModel('generate')` | → MODEL_CHAT |
| `selectModel('text')` | → MODEL_LITE |
| `selectModel('query')` | → MODEL_LITE |
| `callLLM` | 参数透传到 OpenAI client（model/systemPrompt/userMessage/temperature/maxTokens）；返回 content 文本；空 content → throw |
| `callLLM` | response_format='json_object' → 设置 { type: 'json_object' }；非 json 时不设置 |
| `callMultimodalLLM` | 参数透传（model/systemPrompt/userMessage/imageBase64）；返回 content；空 content → throw |
| `callMultimodalLLM` | messages[1].content 为多模态数组 [{type:'text'},{type:'image_url', image_url:{url:...}}]；response_format 强制 json_object |

**Mock 策略**: `vi.mock('openai')`，对 `client.chat.completions.create` 做 mock。

### 4.13 server/src/__tests__/routes/command.test.ts — API 路由集成测试

Mock `callLLM` 和 `selectModel`，用 Fastify 的 `inject()` 方法测 handler 逻辑，不需要真实 LLM API。

| 被测项 | 测试点 |
|--------|--------|
| POST /api/command | 200 — 返回 commands + voiceReply；canvasSummary 注入 userMessage；selectModel 用 intent 参数 |
| POST /api/command | intent='query' → systemPrompt 含"查询模式" + commands 为空 |
| POST /api/command | intent='visual'/'generate' → selectModel 返回 MODEL_CHAT |
| POST /api/command | 错误路径 — callLLM 返回非法 JSON → 不重试（SyntaxError 直接 break）；Zod 校验失败 → 不重试（ZodError 直接 break）；网络错误 → 重试 1 次后再失败 → 422 |
| POST /api/command | voiceReply 为 null 时响应不含 voiceReply 字段 |
| POST /api/command | diagramState.mode='architecture' → systemPrompt 含 DIAGRAM_TYPE_PROMPTS['architecture'] |

**Mock 策略**: `vi.mock` llm 模块（mock selectModel 返回值和 callLLM 行为），通过 `buildApp()` 创建 Fastify 实例并用 `app.inject()` 发请求。

---

## 五、目录结构

```
voice-canvas/
├── vitest.workspace.ts
├── package.json                        # + test scripts
├── shared/
│   ├── vitest.config.ts
│   └── __tests__/
│       └── types.test.ts
├── client/
│   ├── vitest.config.ts
│   └── src/
│       └── __tests__/
│           ├── store/
│           │   └── diagramStore.test.ts
│           ├── services/
│           │   ├── intentClassifier.test.ts
│           │   ├── stateSerializer.test.ts
│           │   ├── api.test.ts
│           │   ├── imageExport.test.ts
│           │   └── speechSynthesis.test.ts
│           └── utils/
│               ├── id.test.ts
│               └── layout.test.ts
├── server/
│   ├── vitest.config.ts
│   └── src/
│       └── __tests__/
│           ├── validators/
│           │   └── command.test.ts
│           ├── utils/
│           │   └── canvasSummary.test.ts
│           ├── routes/
│           │   └── command.test.ts
│           └── services/
│               └── llm.test.ts
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-06-14-testing-infrastructure-design.md  (本文档)
```

---

## 六、执行顺序

```
Phase 1: 基础设施
  ├── 安装 vitest + vite-tsconfig-paths
  ├── 创建 vitest.workspace.ts
  ├── 创建 shared/client/server 各自的 vitest.config.ts
  └── 验证: npx vitest run 能启动（0 tests）

Phase 2: 纯函数测试（无依赖，快速积累）
  ├── shared/types.test.ts
  ├── server/validators/command.test.ts
  ├── server/utils/canvasSummary.test.ts
  ├── client/utils/id.test.ts
  └── server/services/llm.test.ts (selectModel 部分)

Phase 3: 核心逻辑测试
  ├── client/services/intentClassifier.test.ts  (case 最多)
  ├── client/store/diagramStore.test.ts         (最复杂)
  └── client/services/stateSerializer.test.ts

Phase 4: Mock 依赖测试
  ├── client/services/api.test.ts               (mock fetch)
  ├── client/services/imageExport.test.ts       (mock html-to-image + DOM)
  ├── client/services/speechSynthesis.test.ts   (mock SpeechSynthesisUtterance + speechSynthesis)
  ├── client/utils/layout.test.ts               (依赖 dagre)
  └── server/routes/command.test.ts             (mock callLLM → Fastify inject)

Phase 5: 验证
  └── npx vitest run --coverage
```

---

*设计文档版本：v1.1*
*日期：2026-06-14*
*修订：review 反馈 — 补 callMultimodalLLM 用例、补 API 路由集成测试、修 layout 间距断言、修 speechSynthesis mock 策略、pin vitest 版本*
