# dsh-session-panel-kit

DSH（DeepSeek Harness）右侧会话详情栏的一体化插件包，由原先的两个独立仓库合并而来，两个子目录各自保留完整 Git 历史。

| 子目录 | 包名 | 作用 |
|---|---|---|
| [`session-panel/`](./session-panel) | `@local/dsh-session-panel` | 在原生右侧栏提供「会话详情」入口：环境 / 上下文 / 会话统计 / Token 用量 / 子智能体。仅依赖原生 DSH。 |
| [`cs-panel-hider/`](./cs-panel-hider) | `@local/dsh-cs-panel-hider` | 隐藏 `dsh-claude-style` 自带的会话详情面板与顶部图标。纯 CSS 补丁插件，仅依赖原生 DSH。 |

两个包互相独立，可分别安装；同时安装时，`session-panel` 提供替代面板，`cs-panel-hider` 隐藏旧面板，互不干扰。

## 历史

- `session-panel` 原仓库：`Swcmb/dsh-session-panel`（已归档删除，历史并入本仓库）
- `cs-panel-hider` 原仓库：`Swcmb/dsh-cs-panel-hider`（已归档删除，历史并入本仓库）

## 许可

- `session-panel`：GPL-3.0-or-later（文案与分项算法移植自 dsh-claude-style，MIT）
- `cs-panel-hider`：见其目录内 LICENSE
