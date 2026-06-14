# AI 语音绘图工具

> 纯语音驱动的软件工程图表绘制工具。无需鼠标键盘，用自然语言描述即可创建流程图、架构图、时序图。

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-4.28-000000)](https://fastify.dev/)
[![DeepSeek](https://img.shields.io/badge/LLM-DeepSeek_V4-6C47FF)](https://deepseek.com)

## 核心能力

| 能力 | 说明 |
|------|------|
| 🎤 **纯语音控制** | Web Speech API 实时识别，无需触碰鼠标键盘 |
| 🔄 **流程图** | 自然语言描述 → DAG 自动布局流程图（开始/处理/判断/结束） |
| 🏗️ **架构图** | 微服务/分布式架构图，区分同步调用（实线）和异步消息（虚线） |
| 📊 **时序图** | 参与者 + 生命线 + 消息序列，适合描述接口调用链 |
| 👁️ **多模态指代消解** | 截图 + DeepSeek V4-Pro 视觉模型精准定位"那个红色的菱形" |
| ⚡ **端侧极速响应** | 25 个高频指令本地执行 <100ms，修改/撤销无需等待 |
| 🤖 **AI 主动协作** | 架构图场景 AI 建议补全缺失组件 |
| 📦 **一键导出** | 语音 "导出成图片" → PNG 下载 |
| 💾 **画布存储** | 语音或手动保存/加载画布，PostgreSQL 连接池（max:50），刷新不丢失 |

## 技术架构

```
用户语音 → Web Speech API
    ↓
端侧意图分类器 (25 指令, <100ms)
    ↓
简单指令 → 本地执行        复杂/视觉指令 → 云端大模型
                                ↓
                         DeepSeek V4-Flash (文本)
                         DeepSeek V4-Pro  (视觉+推理)
                                ↓
                         Json → Zod 校验 → DeltaCommand
                                ↓
                         React Flow 画布渲染
```

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript + Vite |
| 画布 | React Flow + SVG 自定义节点 |
| 状态 | Zustand |
| 语音 | Web Speech API (端侧流式识别) |
| 样式 | Tailwind CSS |
| 后端 | Fastify + TypeScript |
| 校验 | Zod |
| 布局 | Dagre (流程图) / D3-force (架构图) |
| 大模型 | DeepSeek V4-Pro / V4-Flash |
| 截图 | html-to-image |
| 存储 | PostgreSQL + pg (连接池) |

## 快速开始

### 环境要求

- Node.js 18+
- Chrome / Edge 浏览器（Web Speech API 支持）
- DeepSeek API Key

### 安装

```bash
git clone https://github.com/jssnucz/voice-canvas.git
cd voice-canvas
npm install
```

### 配置

**推荐方式：系统环境变量（更安全！）**

```bash
# Windows PowerShell（管理员）
[System.Environment]::SetEnvironmentVariable('DEEPSEEK_API_KEY', 'sk-your-key', 'User')

# macOS / Linux
echo 'export DEEPSEEK_API_KEY=sk-your-key' >> ~/.bashrc && source ~/.bashrc
```

**为什么推荐这种方式？**

| 优点 | 说明 |
|------|------|
| 🔒 **不会泄露到仓库！** | `.env` 文件随时可能被误提交，系统环境变量永远不会进入 git，从根源杜绝 secret scanning 告警！ |
| 🔑 **所有项目共用！** | 多个 voice-canvas 实例或微服务共享同一个 key，改一处全局生效，不用每个项目改一遍！ |
| 🚫 **不会被覆盖！** | `git pull`、`npm install`、重装依赖都不会影响环境变量，而 `.env` 文件随时可能被重置！ |
| 🛡️ **进程级别隔离！** | 只有启动的 Node.js 进程能读到，文件系统扫描工具、编辑器索引都碰不到！ |
| ✅ **CI/CD 原生支持！** | GitHub Actions、Docker、Vercel 等平台都原生注入环境变量，无需额外配置！ |

**备用方式：`.env` 文件（不推荐，仅在开发时使用）**

```bash
cp server/.env.example server/.env
# 编辑 server/.env，填入 DEEPSEEK_API_KEY 和 DATABASE_URL
```

> ⚠️ `.env` 已被 `.gitignore` 排除，不会再提交。但如果你不小心 `git add -f` 或 IDE 自动暂存，key 仍可能泄露！强烈建议用系统环境变量！

### 启动

```bash
# 终端 1: 启动后端
cd server && npm run dev

# 终端 2: 启动前端
cd client && npm run dev
```

打开 http://localhost:5173，点击 "🎤 开始语音" 开始。

## 语音指令

### 基础绘图（本地执行，<100ms）

| 类别 | 示例 |
|------|------|
| 创建 | "画一个矩形"、"加一个判断节点"、"画一个数据库" |
| 修改 | "把它变红"、"文字改成用户登录"、"变大一点" |
| 移动 | "往左移一点"、"对齐这两个节点" |
| 连线 | "把 A 连到 B" |
| 删除 | "删掉它"、"撤销"、"重做"、"清空画布" |
| 选择 | "选中订单服务"、"聚焦到支付模块" |
| 视图 | "放大"、"缩小"、"适应画面" |

### 复杂指令（云端 LLM，<2s）

| 类别 | 示例 |
|------|------|
| 批量生成 | "画一个用户登录的流程，包含开始、判断是否登录、登录页、首页" |
| 样式批量 | "把所有判断节点标成黄色" |
| 布局调整 | "让这些节点垂直排列" |
| 查询 | "当前画布上有哪些服务？"、"这个节点连到了哪些？" |
| 模式切换 | "切换到架构图模式" |
| 导出 | "导出成图片" |
| 存储 | "保存画布"、"加载画布"、"我的图表" |

### AI 协作

| 场景 | 示例 |
|------|------|
| 架构生成 | "画一个电商下单的微服务架构" → AI 主动建议补全 |
| 时序推导 | "A 调用 B 的登录接口，B 返回 token，A 用 token 调用 C" |

## 项目结构

```
voice-canvas/
├── shared/                     # 前后端共享类型
│   └── types.ts                # CanvasElement, DeltaCommand 等
├── client/                     # 前端 (React + Vite)
│   └── src/
│       ├── components/
│       │   ├── canvas/         # React Flow 画布 + 11 种自定义节点
│       │   ├── voice/          # VoiceButton, TranscriptBar, VoiceOverlay
│       │   └── toolbar/        # ModeSwitcher
│       ├── hooks/              # useSpeechRecognition, useVoiceCommand
│       ├── services/           # intentClassifier, api, canvasSnapshot, exportImage
│       ├── store/              # Zustand diagramStore (含 undo/redo)
│       └── utils/              # id, layout (Dagre)
├── server/                     # 后端 (Fastify)
│   └── src/
│       ├── routes/             # /api/command, /api/multimodal, /api/diagrams
│       ├── services/           # DeepSeek LLM 客户端 (V4-Pro/V4-Flash)
│       ├── prompts/            # System Prompt + 图表类型 Prompt
│       ├── validators/         # Zod 校验 LLM 返回
│       ├── db/                 # PostgreSQL 连接池 + 自动建表
│       └── utils/              # 画布摘要生成
└── docs/                       # 设计文档 + 实现计划
```

## 设计文档

- [项目设计书](docs/superpowers/specs/2026-06-12-ai-voice-drawing-tool-design.md) — 产品定位、功能规划、技术架构、重难点分析
- [语音指令能力矩阵](docs/voice-command-capabilities.md) — 计划 vs 实现对照表，含未完成项原因说明
- [实现计划](docs/superpowers/plans/2026-06-12-ai-voice-drawing-tool-plan.md)

## License

MIT
