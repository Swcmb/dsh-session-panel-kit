# dsh-default-sidebar-tab

独立补丁插件：**设置打开右边栏时默认展示的内容**。

默认情况下，DSH 原生右侧栏在一个会话首次展开、且里面还没有任何 tab 时，会播种「开始页」（guide）。本插件把这个默认页换成你配置指定的 tab——例如「会话详情」「文件树」「浏览器」等。只依赖原生 DSH（`ctx.sidebarRight`），不依赖任何其它插件，不修改任何第三方包或 DSH 产物。

## 它做什么 / 不做什么

- **做**：当屏幕上的会话切到该会话、且它的右侧栏还没有任何 tab 时，用原生 `ctx.sidebarRight.openTab(kind)` 播种你配置的 tab。每个会话只播种一次，之后完全交给用户。
- **不做**：
  - 不在该会话已有任何 tab 时插手——用户/原生已经放好的内容绝不覆盖；
  - 不直接读写 `dsh.sidebar-right.v1.<sessionId>` 布局存储；
  - 不隐藏、删除、改写任何 tab 或面板节点；
  - 不依赖 `dsh-claude-style`、`dsh-context`、`better-sidebar`、`session-panel` 或任何第三方插件；
  - 不注册新 tab、不提供 UI 按钮——它只是把原生导航控制器指向一个已注册的 kind。

配置的 kind 若未注册（对应插件未安装/未启用），`openTab` 会抛错，本插件自动回退到原生 `guide`（开始页），界面不会坏。

## 配置

在 **desktop profile 的 `cordis.patch.yml`**（`D:\ai-configs\runtime\dsh\profiles\desktop\cordis.patch.yml`）追加一段 id 匹配的 config：

```yaml
- id: dsh-default-sidebar-tab
  name: '@local/dsh-default-sidebar-tab'
  config:
    defaultTab: session-inspector-log   # 默认展示的 tab kind
    enabled: true                       # 设 false 可整体关闭本补丁
```

| 键 | 默认 | 说明 |
|---|---|---|
| `defaultTab` | `session-inspector-log` | 要默认展示的 tab kind（字符串）。见下表。 |
| `enabled` | `true` | `false` 时 client 半不作任何动作。 |

改完 **重启 DSH**（同源路由/配置在进程启动时注册，仅 Ctrl+R 不够）。

### 常用的 tab kind

| kind | 展示内容 | 来源 |
|---|---|---|
| `session-inspector-log` | 会话详情（环境 / 上下文 / 统计 / Token） | 原生 inspector bundle（**默认**） |
| `guide` | 开始页 | 原生 |
| `files` | 文件树 | 原生 |
| `browser` | 浏览器 | 原生 |
| `terminal` | 终端 | 原生 |
| `plan` | 计划 | 原生 |
| `changes-review` | 变更审查 | 原生 |
| `schedule` | 定时任务 | 原生 |
| `dsh-context` | 上下文面板 | dsh-context（需已安装） |

配置任意字符串都可；不在表中的 kind 若已由某插件注册同样能生效，未注册则回退 `guide`。

## 结构

```
lib/
  config.mjs   纯逻辑：配置解析、播种判定、kind 清单（可单测）
  index.mjs    host 半：从 cordis config 读配置，经 webserver/index-inject 注入页面
  client.js    client 半：订阅原生 sidebarRight，条件满足时 openTab(defaultTab)
cordis.patch.yml  bundle 注册（client-only + 全局配置注入）
tests/         18 项 node --test 单测
```

## 安装 / 开发

本目录是 `@ianwusb/dsh-ui-adapter` 的 git 子模块（`default-sidebar-tab/`），自身也是独立 git 仓库。

```bash
node --test tests/*.test.mjs      # 18 项单测
```

作为独立 DSH 插件注册到 profile 的方式与同仓的 `session-panel`、`cs-panel-hider` 一致：在 profile 的 `node_modules/@local/` 下建指向本目录的 junction，并在 profile `package.json` 的 `bundles` 与 `dependencies` 加入 `@local/dsh-default-sidebar-tab`，然后按上文配置 `cordis.patch.yml` 并重启 DSH。

## 授权

GPL-3.0-or-later（见 `LICENSE`）。本插件未复制任何第三方代码，只调用原生 DSH 公开的 `ctx.sidebarRight` 导航 API。
