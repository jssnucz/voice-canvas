# 画布存储功能 —— 设计书

## 概述

为 voice-canvas 添加 PostgreSQL 持久化存储，支持画布的保存/加载/列表/删除。使用 pg.Pool 连接池，启动时预开辟连接，请求借还自动管理。

## 架构

```
Fastify 启动 → createPool() → server.decorate('db', pool)
                                ↓
                         migrate(pool) 建表
                                ↓
请求 → pool.query() 自动借还 → 返回结果
                                ↓
Fastify onClose → pool.end()
```

## 连接池参数

| 参数 | 值 | 说明 |
|------|-----|------|
| max | 50 | 上限，支持 ≥50 并发 |
| min | 10 | 启动时预开辟 10 根管道 |
| idleTimeoutMillis | 30000 | 空闲 30s 回收 |
| connectionTimeoutMillis | 3000 | 获取连接超时 |

## 数据模型

单表 `diagrams`，state 为 JSONB：

```sql
CREATE TABLE IF NOT EXISTS diagrams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL DEFAULT '未命名图表',
  mode        VARCHAR(20) NOT NULL DEFAULT 'flowchart',
  state       JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

## save 时剥离 history

DiagramState 的 `history` 和 `historyIndex` 不持久化——撤销历史是会话期的。

## API 端点

| 方法 | 路径 | 请求体 | 响应 |
|------|------|--------|------|
| GET | /api/diagrams | — | DiagramListItem[] |
| GET | /api/diagrams/:id | — | DiagramDetail |
| POST | /api/diagrams | { name, mode, state } | DiagramDetail (201) |
| PUT | /api/diagrams/:id | { name?, state? } | DiagramDetail |
| DELETE | /api/diagrams/:id | — | 204 |

## 测试隔离

`buildApp(pool?)` 可选参数，测试注入 mock pool。

## 文件变更

- `shared/types.ts` — +DiagramListItem, DiagramDetail, CreateDiagramBody, UpdateDiagramBody
- `server/src/db/pool.ts` — createPool() 工厂函数
- `server/src/db/migrate.ts` — CREATE TABLE IF NOT EXISTS
- `server/src/routes/diagrams.ts` — 5 个 CRUD 端点 + Zod 校验
- `server/src/index.ts` — buildApp(pool?) + onClose hook
- `server/.env.example` — +DATABASE_URL

---

*版本：v1.0*
*日期：2026-06-14*
