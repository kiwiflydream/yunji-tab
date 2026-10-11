# 开发指南

简体中文 · [English](./development.en.md) · [返回 README](../README.md)

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

端到端测试会构建并加载真实扩展，覆盖书签管理、书签组、键盘导航、主题、设置重置、WebDAV 备份与恢复、AI 分类、网站图标、内存和无障碍检查。功能改动应运行对应测试，提交前完成上述检查。

## 国际化

界面支持 `zh-CN`、`zh-TW`、`en`、`ja`、`ko`、`es` 和 `fr`。运行时文案集中在 `src/lib/i18n.ts` 与 `src/lib/i18n-*.ts`，组件通过 `useI18n()` 获取 `t` 和当前 `language`，消息键由 `MessageKey` 约束。`locales/` 单独保存扩展名称、描述及浏览器快捷键等元数据，不替代运行时词典。

新增用户可见文案时，同时补齐七种语言，包括错误、状态、占位提示、确认操作和 `aria-label`。各语言保留相同的插值参数名，日期与数字按当前界面语言格式化；用户自己填写的书签标题和目录名保持原样。WebDAV 的设置、同步记录、加密与恢复提示位于 `src/lib/i18n-webdav.ts`。

可以先运行相关检查，再按「验证改动」完成提交前检查：

```bash
pnpm exec vitest run src/lib/i18n.test.ts src/lib/i18n-hardcoded.test.ts
pnpm typecheck
```

国际化测试校验插值参数一致性；AST 检查防止中文界面文案直接写入组件和业务代码。这些检查不能代替译文审阅和界面验证，修改较长文案后还需检查窄屏下的换行、按钮与弹窗布局。

## 持续集成

生产构建通过根目录 `.parcelrc` 使用 Parcel 默认 bundler 抽取公共依赖，保留 Plasmo 的其他打包插件。配置路径依赖当前 pnpm 默认的 `node_modules/.pnpm/node_modules` 布局；升级 Plasmo、Parcel 或修改 node-linker 后，应重新验证各扩展入口与共享资源。文件路径形式的 `extends` 会触发 Plasmo 的配置提示，但仍继承其完整配置。

`.github/workflows/ci.yml` 在推送到 `main` 和所有拉取请求上运行：Node.js 22、pnpm 10.34.4，先执行 `pnpm install --frozen-lockfile`，再跑 `pnpm typecheck`、`pnpm lint`、`pnpm test` 和 `pnpm build`。构建产物 `build/chrome-mv3-prod/` 会作为 artifact 上传。

构建通过后，CI 再安装 Playwright Chromium，下载已通过检查的构建产物并运行关键端到端用例：键盘导航、内存、启动顺序、设置重置、并发存储、原生标题更新、书签组分页和 WebDAV 备份。其余端到端用例仍在本地按需运行。

WebDAV 连接配置与自动检查状态使用独立的 local 存储，不放入同步设置或快照。启动成功后异步检查自动备份，不阻塞首屏，也不在初始化失败时上传。所有页面通过同一个 Web Lock 协调保存、清除、目录查询、读取和上传；获取锁后再读取配置与检查间隔。指纹忽略两层 `exportedAt` 并稳定对象键顺序，保留原生树和数组顺序。每次备份只 PUT 一个带 UTC 毫秒时间戳与 UUID 的 JSON，使用 `If-None-Match: *` 避免覆盖；成功后才更新检查点，失败保留上次成功时间与指纹并限制自动重试。手动备份绕过间隔及内容去重。目标或凭据变化时清除检查点。

可选 `encryptionPassphrase` 随 WebDAV 配置仅在 local 保存，默认空字符串，不复用浏览器同步口令。填写后复用 `metadata-crypto.ts` 的 PBKDF2-SHA-256（150,000 次）和 AES-256-GCM，使用新的随机盐及 IV 加密完整快照。文件外层为 `kind: yunji-tab-encrypted-full-snapshot`、`schemaVersion: 1` 和 `payload` 加密信封，文件名仍沿用原规则。指纹始终计算明文快照，避免随机密文影响去重；启用、更改或清空口令会清除检查点，触发下一次自动上传。读取同时支持普通与加密文件，验证信封版本、盐/IV 长度及 KDF 迭代范围（100,000 至 1,000,000）后才解密，再验证完整快照。缺少或错误口令会提示临时输入创建时的口令，不改写已保存配置，也不绕过预览确认。

记录通过 PROPFIND Depth 1 查询，解析 DAV 命名空间的 207 XML，只读取成功 propstat 中的属性，过滤目录、其他来源、目录外路径、无效文件名和重复 href。时间戳文件以文件名中的 UTC 时间排序，旧版固定文件及 UUID 文件使用 getlastmodified；无时间项排最后。界面分批显示记录，可手动刷新。列表只在内存中展示，不持久保存、不上传独立索引，也不自动删除远端文件；加载配置时清理旧的本地记录。恢复在锁内核对所选文件的目录与账号，使用可用的强 ETag 发起 If-Match 条件请求，校验完整快照格式后复用导入预览与确认。清除连接仅删除本机配置及检查状态。WebDAV 浏览器测试使用已授权地址的模拟协议响应，覆盖真实扩展流程与目录解析；不连接真实云盘账号。

完整快照恢复由 `restoreFullBackup` 统一处理：原生树导入新文件夹，同网址补充数据和使用记录取快照值，书签组以 `replace` 策略恢复，应用设置也由快照替换。恢复后的数据继续参与正常的浏览器与扩展同步。WebDAV 加密只包装上传内容，不改变 `exportBackup` 和 `exportFullBackup` 的本地明文导出格式。

书签和分类使用不可变对象快照：更新某一项时保留其他项的对象引用，完整原生刷新也复用未变化的对象。搜索索引按书签对象及分类路径复用；分类重命名或移动会使受影响路径失效。普通视图的排序结果不依赖打开次数，搜索评分也不随打开次数更新重算。原生标题事件优先局部更新，未知节点、URL 变化及结构变动仍通过完整刷新核对；刷新期间收到标题事件时丢弃旧树快照并重新读取。

书签组默认每批渲染 50 个，普通组视图和置顶混排共用该规则；导航计数和搜索匹配数仍包含完整列表。搜索或视图模式变化时重置批次，组的拖拽位置仍采用完整排序列表中的索引。组的加载更多按钮使用独立可访问名称，避免与普通书签分页混淆。

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

修改用户可见的功能后，同步更新 README 中的使用说明和 `description.md` 中的七种语言产品介绍，保持 README、开发指南、隐私说明和电光蓝主题文档的中英文版本一致。涉及数据、网络请求或权限时更新隐私说明，新增配置、存储或测试约束时更新开发指南。主题专用规范见[电光蓝主题说明](./theme-electric-blue.md)和[主题素材文档](../assets/themes/README.md)。配图放在 `docs/images/`，使用测试环境和公开网站，避免暴露真实用户的书签、账号或凭据。

当前配图来自实际扩展界面，覆盖主页、搜索、书签组、书签编辑、批量管理、蓝墨版画主题和备份设置。蓝墨版画素材说明见[主题素材文档](../assets/themes/README.md)。
