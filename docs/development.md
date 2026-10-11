# 开发指南

[返回 README](../README.md)

云吉 Tab 基于 Plasmo 开发，以 Chrome Manifest V3 为主要构建和测试目标。

## 环境与安装

- Node.js 22 或更高版本
- pnpm 10.34.4
- Chrome 或 Chromium 浏览器

```bash
corepack enable
pnpm install --frozen-lockfile
```

## 本地开发

```bash
pnpm dev
```

首次运行后，在 `chrome://extensions` 开启「开发者模式」，点击「加载已解压的扩展程序」，选择 `build/chrome-mv3-dev/`。Plasmo 会监听源码变化并重新构建、重载扩展。

建议使用独立的浏览器测试配置和示例书签。扩展直接管理原生书签，测试新增、移动或删除时，实际浏览器数据也会发生变化。

## 构建与打包

```bash
pnpm build
pnpm package
```

`pnpm build` 生成 `build/chrome-mv3-prod/`，可以加载该目录验证生产构建；`pnpm package` 生成 ZIP 安装包。GitHub Releases 的扩展附件使用 `yunji-tab-<版本号>-chrome.zip` 命名，自动生成的源码归档不能直接作为扩展安装。

Chrome 是主要验证目标。其他 Chromium 浏览器尚未提供独立兼容性保证，Firefox 和 Safari 暂未提供正式发布与验证流程。

## 验证改动

```bash
pnpm typecheck
pnpm lint
pnpm test

# 首次运行端到端测试前安装 Chromium
pnpm exec playwright install chromium
pnpm test:e2e
```

端到端测试会构建并加载真实扩展，覆盖书签管理、书签组、键盘导航、主题、AI 分类、网站图标、内存和无障碍检查。功能改动应运行对应测试，提交前完成上述检查。

## 持续集成

生产构建通过根目录 `.parcelrc` 使用 Parcel 默认 bundler 抽取公共依赖，保留 Plasmo 的其他打包插件。配置路径依赖当前 pnpm 默认的 `node_modules/.pnpm/node_modules` 布局；升级 Plasmo、Parcel 或修改 node-linker 后，应重新验证各扩展入口与共享资源。文件路径形式的 `extends` 会触发 Plasmo 的配置提示，但仍继承其完整配置。

`.github/workflows/ci.yml` 在推送到 `main` 和所有拉取请求上运行：Node.js 22、pnpm 10.34.4，先执行 `pnpm install --frozen-lockfile`，再跑 `pnpm typecheck`、`pnpm lint`、`pnpm test` 和 `pnpm build`。构建产物 `build/chrome-mv3-prod/` 会作为 artifact 上传。

构建通过后，CI 再安装 Playwright Chromium，下载已通过检查的构建产物并运行关键端到端用例：键盘导航、内存、启动顺序、设置重置和并发存储。其余端到端用例仍在本地按需运行。

书签组页面的异步加载使用网格加载态，避免显示弹窗遮罩。组成员列表无论向上还是向下展开，都应避开卡片操作按钮；悬浮展开等待 100ms，卡片内的鼠标移动只更新定位，不重新计时，移出后保留 200ms 的关闭缓冲。

书签组成员菜单的按钮应铺满边框内侧，文字留白放在按钮内部；容器不留不可点击的内边距，按下时不缩小按钮，以免边缘点击失效。

## 代码目录

```text
src/
├── newtab.tsx                 # 新标签页入口
├── popup.tsx                  # 工具栏弹窗
├── background.ts              # 后台事件、快捷键与消息处理
├── tabs/
│   └── global-command-palette.tsx
├── components/                # 书签、目录、搜索和对话框组件
│   ├── bookmark-grid/         # 书签网格组件与 hooks
│   ├── settings/              # 设置页各标签
│   └── ui/                    # 通用 UI 组件
└── lib/                       # 书签、搜索、备份、同步和状态逻辑

e2e/                           # Playwright 端到端测试
locales/                       # 浏览器扩展元数据翻译
assets/                        # 品牌图标和装饰素材
docs/                          # 使用配图、开发和隐私说明
```

## 技术栈

- Plasmo：扩展构建与开发工具
- React 19、TypeScript：界面和类型检查
- Tailwind CSS、shadcn/ui、Radix UI：样式与交互组件
- Zustand、@plasmohq/storage：状态与浏览器存储
- dnd-kit：拖放交互
- Vitest、Playwright、axe-core：单元测试、端到端测试和无障碍检查

## 与浏览器书签的关系

扩展直接操作浏览器的原生书签树，并监听新增、修改、移动、删除和顺序变化。在浏览器书签管理器或其他设备修改书签后，主页会随事件更新。

| 操作           | 浏览器 API                    |
| -------------- | ----------------------------- |
| 添加书签或目录 | `chrome.bookmarks.create`     |
| 编辑名称或网址 | `chrome.bookmarks.update`     |
| 移动书签或目录 | `chrome.bookmarks.move`       |
| 删除书签       | `chrome.bookmarks.remove`     |
| 删除目录       | `chrome.bookmarks.removeTree` |

描述、标签、图标、备用 URL 等补充字段由扩展保存，具体存储和同步边界见[隐私与权限说明](./privacy.md)。

## 更新文档和配图

修改用户可见的功能后，同步更新 README 中的使用说明。配图放在 `docs/images/`，使用测试环境和公开网站，避免暴露真实用户的书签、账号或凭据。

当前配图来自实际扩展界面，覆盖主页、搜索、书签组、书签编辑、批量管理、蓝墨版画主题和备份设置。蓝墨版画素材说明见[主题素材文档](../assets/themes/README.md)。
