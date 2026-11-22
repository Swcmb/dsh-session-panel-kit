# DSH 会话详情栏（session-panel）最小实现

截图里 DSH 对话界面**右侧那一栏**（环境 / 上下文 / 会话统计 / Token 用量 / 子智能体）由 `dsh-claude-style` 插件的 `sessionPanel` 功能实现。本目录提取的是**实现该功能所需的最小代码**：面板自身 + 插件自己造且面板要用到的支撑模块。

## 边界：谁的代码

| 来源 | 是否在内 | 说明 |
| --- | --- | --- |
| 面板自身（client/host/contracts 中的 session-panel 文件） | ✅ 在 | 渲染、数据折叠、类型、样式、文案 |
| 插件自造的支撑模块（core / shared / engine / 部分 host 与 contracts） | ✅ 在 | 面板 import 并实际调用 |
| DSH 宿主自带服务：`sessionQuery` / `jobs` / `agents` / `webServer` | ❌ 不在 | 由 DSH Electron 本体经 `ctx.get(...)` 提供，不随插件分发。类型见 `engine/node/dsh.ts` 的 `DshContext` |
| 第三方库：`react` / `react-dom/client` / `@deepseek-ai/dsh-client-ui-primitives` / `@deepseek-ai/dsh-util-workspace-path` | ❌ 不在 | 外部依赖，需从 DSH 环境获取 |
| 插件其它 feature（account / composer / chat-fold / model / settings 等） | ❌ 不在 | 与面板无关。仅 `core/feature.ts` 的类型链会碰到，已切断 |
| node 内置模块 | ❌ 不在 | — |

## 来源与版本

- 上游仓库：<https://github.com/Nwflower/dsh-claude-style>
- 源码取自 `master` 分支。本地 DSH 安装的是 **v0.21.6**，但该 tag 与 npm 包里 `packages/` 源码已被剔除（只剩压缩后的 `lib/client.js`），故用 master 源码。截图文案与 master 的 `session-panel.copy.json` 逐字对应。
- 授权：MIT（见 `LICENSE`，Copyright (c) 2026 Nwflower）。
- 上游完整仓库：`D:\github-kb\dsh-claude-style`（已登记进该库的 `CLAUDE.md`）。
- 提取日期：2026-11-22

## 目录结构

镜像上游 `packages/` 之下的相对路径，import 路径可直接对上：

```
client/src/
  features/session-panel/   面板本体：渲染、轮询、样式、文案（27 文件）
  core/                     feature 契约、i18n、prefs、调度、stylesheet
  shared/                   billing / format / session-projections / stats-format 等
  constants.ts
host/src/
  session-panel*.ts         面板数据折叠（核心 session-panel.ts）
  session-cost.ts           Token 用量的计价（插件自造，非宿主服务）
  checkout.ts               环境一节的目录/checkout 信息
  usage-fold.ts / session-compact.ts / prices*.ts / ...   host 侧直接依赖
contracts/src/
  session-panel.ts          面板全部数据类型（前后端共享契约）
  dom / prices / routes / prefs / ...
engine/src/                  bus / frame / host / chat-dom 等浏览器侧工具
engine/node/                 dsh.ts（DshContext 类型）、session-events 等读日志工具
```

## 截图区块 → 代码位置

| 截图区块 | 渲染函数 / 文件 | 数据来源 |
| --- | --- | --- |
| 环境（本机 / 目录 / 标准模式） | `client/src/features/session-panel/session-panel-body.ts` → `EnvironmentSection`（约 170 行） | `host/src/checkout.ts` → `panelEnvironment()` |
| 上下文（已用 0% / 0/1M + 分项条） | `session-panel-body.ts` → `ContextSection`（约 240 行）；分项算法 `context-rows.ts` → `contextRows()` | `host/src/session-panel-context.ts`；类型 `contracts/src/session-panel.ts` 的 `PanelContextKind` |
| 上下文分项标签（系统提示 / 工具、技能和MCP / 对话正文 / 推理过程 / 执行过程 / 工具结果 / 上下文注入） | `session-panel.copy.json` 的 `systemTokens`/`capabilityTokens`/`conversationTokens`/`reasoningTokens`/`toolCallTokens`/`toolResultTokens`/`injectionTokens` | `host/src/session-panel-context.ts` 的 fold 分类；`tools`+`mcp`+`skills` 在 `context-rows.ts` 合并为“能力”一行，顺序见 `DISPLAY_ORDER` |
| 会话统计（0 tok/s） | `session-panel-body.ts` → `StatsSection`（约 430 行）；实时读数 `session-panel-figures.ts` | `host/src/session-panel.ts` → `statsOf()`；`client/.../panel-poller.ts` |
|  Token 用量（1,572 tok） | `session-panel-body.ts` → `TokensSection`（约 457 行）；计价 `stats-cost.ts` | `host/src/session-cost.ts`（插件自造，读日志按自己的价格表计价） |
| 子智能体（1 项已结束） | `client/.../session-panel-work.ts`（`WorkSections`） | `host/src/session-panel.ts` → `backgroundOf()`；`session-panel-log.ts` / `session-panel-round.ts` |

## 数据流

```
DSH 宿主（Electron）
  ctx.get('sessionQuery' / 'jobs' / 'agents')  ── 原始会话事件、任务、子智能体状态
        │
        ▼  host/src/session-panel.ts 等折叠
  GET /dsh-claude-style/session-panel  ← 插件自己注册的路由（host/src/routes.ts 中）
        │  SessionPanelValue（类型见 contracts/src/session-panel.ts）
        ▼
  client/src/features/session-panel/session-panel-data.ts（轮询）
        │
        ▼
  session-panel-body.ts 的 *Section 渲染右侧栏
```

关键点：`sessionQuery` / `jobs` / `agents` 只由宿主提供，插件负责把它们的原始数据折叠成面板值并渲染；`cost` 和面板路由都是插件自己造的。

## 有意切断的依赖（非缺陷）

`client/src/core/scheduler.ts` 是插件的全局 feature 调度器，import 了 account / composer / chat-fold / model / settings 等十余个无关 feature。面板仅通过 `core/feature.ts` 的 `FeatureUi`/`FeatureManifest` **类型**间接引用它，运行时不调用其调度逻辑。因此本目录保留了类型定义所依赖的模块，但**未包含** `scheduler.ts` 及其拖入的 feature。

对本目录做静态 import 检查时，会看到 `core/feature.ts` 有若干指向未复制 feature 的 import——这是为保持最小而有意截断的类型边界。若要做可编译的完整工程，请回到上游仓库 `D:\github-kb\dsh-claude-style`。
