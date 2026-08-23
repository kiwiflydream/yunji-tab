<p align="center">
  <img src="./assets/brand-mark.png" width="96" alt="Yunji Tab logo">
</p>

# Yunji Tab

Yunji Tab 是一个 Chrome 新标签页扩展，把浏览器原生书签变成可搜索、可整理的导航主页。它直接读写 `chrome.bookmarks`，不用迁移数据，也不需要注册账号。

书签仍保留在浏览器里。Yunji Tab 只为浏览器书签缺少的字段补充本地元数据，例如描述、标签、图标、置顶状态和访问记录。

![Yunji Tab 产品总览](./docs/images/yunji-tab-overview.png)

## 功能

- 按原有文件夹层级浏览、搜索和管理浏览器书签
- 新增、编辑、拖动、批量移动和删除书签或目录
- 支持标签、置顶、常用、最近访问、未整理收件箱和保存的筛选器
- 提供命令面板、键盘导航、网页搜索和快速收藏当前页
- 检查重复、失效和重定向链接，删除后可撤销或从垃圾桶恢复
- 备份本地元数据和完整书签树，导入前预览冲突
- 在用户确认后使用 OpenAI 兼容服务生成书签分类方案
- 支持简体中文、繁体中文、英语、日语、韩语、西班牙语和法语

## 快速开始

### 环境要求

- Node.js 22 或更高版本
- pnpm 10.34.4
- Chrome 或其他 Chromium 浏览器

```bash
corepack enable
pnpm install --frozen-lockfile
```

### 开发模式

```bash
pnpm dev
```

首次运行后，在 `chrome://extensions` 开启「开发者模式」，点击「加载已解压的扩展程序」，选择 `build/chrome-mv3-dev/`。Plasmo 会监听源码变化并重新构建、重载扩展。

### 生产构建

```bash
pnpm build
```

构建完成后，加载 `build/chrome-mv3-prod/`。需要生成用于浏览器商店提交的 ZIP 时运行：

```bash
pnpm package
```

### 本地验证

```bash
pnpm typecheck
pnpm lint
pnpm test

# 首次运行端到端测试前安装 Chromium
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm test:e2e` 会构建并加载真实扩展，运行核心流程、AI 分类、favicon、内存和无障碍测试。

## 使用说明

### 书签管理与安全恢复

Yunji Tab 始终操作同一份浏览器原生书签：

| 页面操作       | 浏览器 API                    |
| -------------- | ----------------------------- |
| 添加书签或目录 | `chrome.bookmarks.create`     |
| 编辑名称或网址 | `chrome.bookmarks.update`     |
| 移动书签或目录 | `chrome.bookmarks.move`       |
| 删除书签       | `chrome.bookmarks.remove`     |
| 删除目录       | `chrome.bookmarks.removeTree` |

扩展监听书签的新增、修改、移动、删除和顺序变化，浏览器书签管理器或其他设备更新后，页面会自动刷新。

删除书签或目录时，Yunji Tab 会先保存本地快照。页面底部可以立即撤销，之后也能在「垃圾桶与历史」中恢复。删除快照保留 30 天。完整备份恢复到新的 `Yunji Tab Restore ...` 目录，不会覆盖或清空现有书签。

### 搜索与快捷键

顶部搜索框默认搜索本地书签和目录，也可以切换到网页搜索。支持以下筛选语法：

```text
tag:AI
site:github.com
folder:文档
```

内置搜索引擎包括 Google、Bing、百度、DuckDuckGo 和 GitHub，也可以添加包含 `%s` 占位符的自定义搜索地址。

| 快捷键                                    | 默认操作             |
| ----------------------------------------- | -------------------- |
| `/`                                       | 聚焦搜索框           |
| `Cmd/Ctrl + K`                            | 打开主页命令面板     |
| `N`                                       | 新增书签             |
| 方向键                                    | 在搜索结果中移动焦点 |
| `Enter`                                   | 打开当前书签或目录   |
| `Esc`                                     | 清空搜索             |
| `Alt + Shift + B` / `Command + Shift + B` | 快速收藏当前页       |

主页快捷键可以在「设置 → 快捷键」中修改。浏览器级快捷键需要在 `chrome://extensions/shortcuts` 或 `edge://extensions/shortcuts` 中分配。全局命令面板默认关闭，不会预占按键。

### AI 分类与元数据同步

AI 智能分类连接用户配置的 OpenAI 兼容服务。扩展分批生成移动预览，只有用户确认后才会修改书签目录。发送的数据包括书签标题、去除查询参数的网址、描述、标签和目录路径。API Token 不参与同步或备份。

浏览器原生书签没有描述、标签、置顶状态和自定义图标字段，这些内容保存在 `chrome.storage.local`。启用元数据同步后，扩展会分片同步这些字段，并处理浏览器同步配额与新旧快照冲突。

## 隐私与权限

Yunji Tab 不需要账号，也不收集分析数据。设置、访问记录、标签页会话、垃圾桶和缓存保存在当前浏览器中。书签补充元数据默认通过浏览器自带的同步存储跨设备同步；可以在设置中选择同步字段并启用口令加密。

展示书签卡片时，扩展会按需把书签域名发送到 Google Favicon 服务获取图标，不会发送书签的路径、查询参数或页面内容。远程图标获取失败时会回退到浏览器提供的 favicon API。用户主动抓取网页描述、检查链接或运行 AI 分类时，扩展才会申请访问对应网站。

| 权限                               | 用途                                                     |
| ---------------------------------- | -------------------------------------------------------- |
| `storage`                          | 保存设置、本地元数据和可选的跨设备同步数据               |
| `bookmarks`                        | 读取和管理浏览器原生书签                                 |
| `favicon`                          | 通过浏览器 API 获取站点图标                              |
| `activeTab`                        | 用户触发快捷收藏或全局命令时读取当前页面                 |
| `scripting`                        | 按需向普通网页注入隔离的全局命令面板                     |
| `contextMenus`                     | 提供「收藏到 Yunji Tab」右键菜单                         |
| `tabs`                             | 保存、恢复标签页会话，并复用主页标签页                   |
| `https://www.google.com/*`         | 请求 Google Favicon 服务                                 |
| `https://*.gstatic.com/*`          | 加载 Google 返回的图标资源                               |
| 可选的 `http://*/*`、`https://*/*` | 用户触发网页描述、链接检查或 AI 分类时访问指定网站或服务 |

可以在「设置 → 数据」中分别清除访问记录、favicon 缓存、标签页会话、垃圾桶、本地元数据和网站授权。

## 浏览器支持

项目以 Chrome Manifest V3 为主要目标。Edge、Brave 和 Opera 等 Chromium 浏览器通常可以加载同一构建产物，但目前没有单独的兼容性保证。Firefox 和 Safari 尚未提供构建与验证流程。

## 核心结构

```text
src/
├── newtab.tsx                 # 新标签页入口
├── popup.tsx                  # 工具栏弹窗
├── background.ts              # 后台事件、快捷键与消息处理
├── tabs/
│   └── global-command-palette.tsx
├── components/                # 书签、目录、搜索和对话框组件
│   ├── bookmark-grid/         # 书签网格拆分组件与 hooks
│   ├── settings/              # 设置页各标签
│   └── ui/                    # 通用 UI 组件
└── lib/                       # 书签、搜索、备份、同步和状态逻辑

e2e/                           # Playwright 端到端测试
locales/                       # 浏览器扩展元数据翻译
assets/                        # 品牌图标和装饰素材
```

## 技术栈

- [Plasmo](https://docs.plasmo.com/)：浏览器扩展框架
- [React 19](https://react.dev/) 与 [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)、[shadcn/ui](https://ui.shadcn.com/) 与 Radix UI
- [Zustand](https://zustand.docs.pmnd.rs/) 与 [@plasmohq/storage](https://docs.plasmo.com/framework/storage)
- dnd-kit：拖放交互
- Vitest、Playwright 与 axe-core：单元测试、端到端测试和无障碍检查

## 参与贡献

提交改动前，请至少运行：

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

普通问题和功能建议可以通过仓库 Issues 提交。报告安全或隐私问题时，请不要在公开 Issue 中附带 Token、真实书签、完整浏览记录或其他敏感数据。

## License

[MIT](./LICENSE) © 2026 KIWI
