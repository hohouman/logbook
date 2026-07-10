# Logbook · 灵魂旅途日志

> 一段「我为什么会成为现在的我」的记录。这里不放技能栈、不堆项目经历——只把真正影响过我的人与作品郑重地留下：读过的书、看过的电影、玩过的游戏、听过的音乐。

这不是一份「简历式」的个人主页：没有炫目的技术栈罗列，也没有高大上的职业履历。Logbook 的出发点很朴素——把那些塑造过自己的书、电影、游戏与音乐，认真地记下来、摆出来。技术只是手段：你只需维护一份 `src/config/*.json` 里的「链接清单」，系统自动抓取元数据、下载并压缩封面，生成静态站点展示这些数字足迹。

## 核心特性

- 🎯 **数据驱动**：内容完全由 `src/config/*.json` 里的 URL 列表驱动，抓取脚本生成 `src/content/_generated/*.json`。
- 🎨 **智能主题**：从首页壁纸自动采样主色调，动态调整全站配色（见 `src/lib/theme.ts`）。
- 🧩 **配置与展示分离**：集合「展示配置」（标题、卡片字段等）集中在 `src/lib/collections.ts`，与底层数据解耦。
- 📱 **响应式 + 渐进增强**：基础内容无需 JS；主题色与标签页交互通过客户端 JS 增强。
- ⚡ **静态生成**：构建期产出纯 HTML/CSS/JS，无运行时服务端依赖。
- 🔄 **一键同步**：GitHub Actions 手动触发抓取并提交数据，触发 Cloudflare Pages 重新部署。

## 技术架构

| 层 | 选型 |
| --- | --- |
| 框架 | Astro 4.x（SSG） |
| 数据抓取 | Node.js + Puppeteer（豆瓣网页抓取 + 反爬挑战解算）+ Steam / MusicBrainz 开放 API |
| 图片处理 | Sharp（下载封面 → WebP，质量 80） |
| 自动化 | GitHub Actions（`manual-fetcher.yml`，手动 `workflow_dispatch`） |
| 部署 | Cloudflare Pages（监听 `main` 分支） |

## 项目结构

```
hohouman/
├── .github/workflows/
│   └── manual-fetcher.yml        # 手动触发：抓取 → 提交数据 → 推送（触发部署）
├── scripts/                       # 数据抓取管线（Node.js，非 Astro 构建的一环）
│   ├── fetch-metadata.js          # 入口：读配置 → 逐个抓取 → 写 _generated/*.json
│   └── lib/
│       ├── paths.js               # 目录常量 + 自动发现 config 文件（排除 profile.json）
│       ├── url.js                 # URL → {platform, id, type} 解析规则（MATCHERS）
│       ├── refresh.js             # 判断某条目是否“数据不完整、需重新抓取”
│       ├── image.js               # 下载封面并转 WebP（含豆瓣防盗链 Referer）
│       ├── util.js                # delay / 指数退避 backoff
│       ├── constants.js           # 浏览器 UA（豆瓣/图片下载）+ API UA（MusicBrainz 应用标识）
│       └── providers/
│           ├── steam.js           # Steam 商店 API
│           ├── douban.js          # 豆瓣网页抓取（Puppeteer + 反爬挑战解算）
│           └── musicbrainz.js     # MusicBrainz + Cover Art Archive
├── src/
│   ├── config/                    # 💡 日常维护区
│   │   ├── profile.json           # 个人信息：头像、简介、社交、壁纸
│   │   ├── games.json             # Steam 游戏链接（URL 数组）
│   │   ├── movies.json            # 豆瓣电影链接
│   │   ├── books.json             # 豆瓣图书链接
│   │   └── albums.json            # 豆瓣音乐 / MusicBrainz 专辑链接
│   ├── content/
│   │   ├── posts/other.md         # “其他”页面的 Markdown 正文
│   │   └── _generated/            # ⛔ 自动生成，勿手改
│   │       ├── games.json  movies.json  books.json  albums.json
│   ├── pages/
│   │   ├── index.astro            # 首页（全屏英雄区 + 内容切换标签页）
│   │   ├── [collection].astro     # 集合独立页（按集合 key 动态生成）
│   │   └── other.astro            # “其他”页
│   ├── layouts/Layout.astro       # 全局布局（主题色提取 + 导航 + 玻璃框架）
│   ├── styles/global.css          # 全局样式（设计令牌 + .glass-panel 工具类）
│   ├── components/
│   │   ├── EntryCard.astro        # 条目卡片（游戏/电影/书/专辑共用）
│   │   └── Footer.astro
│   ├── lib/
│   │   ├── collections.ts         # 领域数据模型 + 集合展示配置 + 渲染辅助
│   │   └── theme.ts               # 主题色采样（canvas 平均色）+ 滚动淡出
│   └── utils/
│       ├── format.ts              # asText / hasValue（字段→展示字符串）
│       └── profile.ts             # normalizeProfileLinks / getSocialLinks
├── public/generated/              # ⛔ 生成的 WebP 封面（勿手改）
├── astro.config.mjs
├── package.json
└── README.md                      # GitHub 个人主页展示文档（与本文件不同）
```

> 本文件（`README-Logbook.md`）描述项目**真实**结构与维护要点；根目录 `README.md` 仅用于 GitHub 个人主页。

## 快速开始

### 前置条件

- Node.js 18.14.1+（推荐 20+；GitHub Actions 用 24）
- npm
- Git

### 安装与配置

```bash
git clone <你的仓库地址>
cd <仓库名>
npm install
```

1. **编辑个人信息**：`src/config/profile.json`（`name` / `bio` / `avatar` / `wallpaper` / `social.*` / `links[]`）。`wallpaper` 决定全站主题色。
2. **添加内容链接**：在对应配置文件里追加 URL（每行一个，见下表）。

| 集合 | 配置文件 | 支持的链接来源 |
| --- | --- | --- |
| 游戏 games | `src/config/games.json` | `store.steampowered.com/app/<id>` |
| 电影 movies | `src/config/movies.json` | `movie.douban.com/subject/<id>` |
| 图书 books | `src/config/books.json` | `book.douban.com/subject/<id>` |
| 专辑 albums | `src/config/albums.json` | `music.douban.com/subject/<id>`、`musicbrainz.org/release/<id>` |

> 新增平台（如 Epic）需先在 `scripts/lib/url.js` 的 `MATCHERS` 增加解析规则，并在 `scripts/lib/providers/` 增加抓取器、接入 `fetch-metadata.js` 的 `fetchByPlatform()`。

3. **运行抓取**（首次必须）：

```bash
npm run fetch-data        # = node ./scripts/fetch-metadata.js
```

脚本会：读配置 → 调 Steam API / Puppeteer 抓豆瓣 / MusicBrainz API → 下载封面转 WebP → 写 `src/content/_generated/*.json` 与 `public/generated/*.webp`。

4. **本地预览 / 构建**：

```bash
npm run dev               # http://localhost:4321
npm run build             # 输出 dist/
npm run preview           # 预览生产构建
npm run check             # Astro 类型检查（astro check）
```

## 数据流向

```
用户编辑 src/config/*.json
   ↓
scripts/fetch-metadata.js + scripts/lib/*
   ↓
src/content/_generated/*.json   (结构化元数据)
public/generated/*.webp         (压缩封面)
   ↓
src/pages/[collection].astro + src/lib/collections.ts  (读取并渲染)
   ↓
dist/  →  Cloudflare Pages
```

## 分叉后：如何改成你自己的

Fork 之后，站点默认还是原作者的内容、域名与接口标识。按下面清单改完，它就真正属于你。**优先级从高到低。**

### 必改（不改会有明显问题）

| 改什么 | 文件 | 说明 |
| --- | --- | --- |
| 站点域名 | `astro.config.mjs` | 把 `site: 'https://houman.top'` 改成你的域名，影响 canonical / 绝对链接。 |
| API 联系方式 | `scripts/lib/constants.js` | `API_USER_AGENT` 里的 `https://houman.top` 改成你的网址或邮箱。**MusicBrainz 明确要求请求带应用标识 + 联系方式**，不改成自己的可能被限流或违规。 |
| 个人资料 | `src/config/profile.json` | `name` / `bio` / `avatar` / `wallpaper` / `social.*` / `links[]` / `copyright` 全部换成你的。 |
| 内容清单 | `src/config/games.json` · `movies.json` · `books.json` · `albums.json` | 换成你自己的链接；暂时用不上的集合把数组清空 `[]` 即可（页面会显示空状态/占位，不会报错）。 |

### 推荐改

| 改什么 | 文件 | 说明 |
| --- | --- | --- |
| 仓库首页文档 | 根目录 `README.md` | 那是 GitHub 个人主页展示用的，改成你的介绍。 |
| 包信息 | `package.json` | `name` 以及（可选）`repository` 字段。 |
| 浏览器图标 | `favicon.ico` | 换成你自己的图标（直接覆盖文件即可）。 |
| “其他”页正文 | `src/content/posts/other.md` | 标准 Markdown，已适配深色玻璃卡片。 |

### 进阶（文案 / 外观 / 增删集合）

- **集合文案**：`src/lib/collections.ts` 里每个集合的 `navLabel` / `titleEn` / `subtitle` / `panelDesc` / `chips` / `emptyText`，以及 `OTHER_SECTION`（`navLabel` / `titleEn` / `title` / `chips` / `libEyebrow` / `libTitle`）与 `fallbackItems` 占位文案。
- **配色与样式**：`src/styles/global.css`（`:root` 设计令牌、`.glass-panel` 工具类）。主题色默认从 `profile.json` 的 `wallpaper` 自动采样，也可在此强制指定 `--theme-color`。
- **新增社交图标**：`src/config/profile.json` 的 `social` 加字段（空字符串不显示）；`src/pages/index.astro` 的 `iconPaths` 加对应 SVG path（缺失则回退 `default`）。
- **删除一个集合**：删掉 `src/config/<key>.json` + 在 `collections.ts` 删除对应配置并从 `collectionList` 移除（两侧 key 必须保持一致）。只清空数组而不删配置也可，页面会显示空状态。
- **新增一个集合 / 平台**：见下方「自定义指南」与「维护者须知 3」。
- 其它外观/交互调整见「自定义指南」。

### 部署改造

- 在 Cloudflare Pages（或 Vercel / Netlify）新建项目，连接**你的**仓库，Build command `npm run build`，输出目录 `dist`，Node 版本 20+。原作者的 Cloudflare 项目与你无关，需自行新建。
- GitHub Actions：`.github/workflows/manual-fetcher.yml` 默认可用——仅手动触发、抓取并提交数据，推送 `main` 后由你的部署平台重新构建。**不需要改**；若想定时自动抓取，给该文件加 `on.schedule` 的 cron 即可（注意 Puppeteer 在 Actions 环境依赖已就绪）。

## 自定义指南

- **主题色**：自动从 `profile.json` 的 `wallpaper` 采样（canvas 平均色）。要强制指定，编辑 `src/styles/global.css` 的 `--theme-color` / `--theme-color-rgb`，并在 `Layout.astro` 的 `<script>` 中跳过 `initTheme()`。
- **新增社交图标**：`profile.json` 的 `social` 加字段（空字符串不显示）；`index.astro` 的 `iconPaths` 加对应 SVG path（缺失则回退 `default`）。
- **“其他”页面**：编辑 `src/content/posts/other.md`（标准 Markdown，已适配深色玻璃卡片）。
- **布局**：所有页面共用 `Layout.astro`；独立页由 `[collection].astro` 的 `getStaticPaths()` 按集合 key 动态生成，无需为每个集合手写页面。

## 数据格式

生成文件是条目数组（以游戏为例）：

```json
[
  {
    "id": "264710",
    "title": "Subnautica",
    "developer": ["Unknown Worlds Entertainment"],
    "publisher": ["Unknown Worlds Entertainment"],
    "releaseDate": "Jan 23, 2018",
    "description": "...",
    "coverUrl": "https://cdn.akamai.steamstatic.com/.../header.jpg",
    "posterUrl": "https://cdn.akamai.steamstatic.com/.../library_600x900.jpg",
    "localCoverPath": "/generated/game_264710_cover.webp",
    "localPosterPath": "/generated/game_264710_poster.webp",
    "type": "game",
    "platform": "steam",
    "url": "https://store.steampowered.com/app/264710/"
  }
]
```

- `coverUrl`/`posterUrl` 为远程地址；`localCoverPath`/`localPosterPath` 为本地 WebP 相对路径。
- 不同集合只填充对应语义字段（电影→`director`、书→`author`/`publisher`、专辑→`artist`），无关数组字段可能为空。
- 渲染层 `EntryCard.astro` 通过 `collections.ts` 的 `metaFields` / `coverKeys`（**字符串键**）决定展示哪些字段，与底层字段名解耦——改 provider 输出字段名时务必同步改这里。

## 自动化工作流

**GitHub Actions（手动触发）**：仓库 → Actions → “Manual Logbook Data Fetcher” → Run workflow。流程：克隆 → `npm ci` → 跑抓取脚本 → 若有变更则提交 `Auto-update logbook data` 并推送 `main`（推送触发 Cloudflare Pages 重新部署）。

**本地手动**：`npm run fetch-data` 后自行 `git add . && git commit && git push`。

## 故障排除

- **豆瓣抓取失败**：确认 Puppeteer 已装（`devDependencies`）；脚本内置 SHA-512 挑战解算与正则兜底，失败时看控制台日志。
- **Steam / MusicBrainz 返回空**：链接需完整且 id 可访问。
- **图片不显示**：重新 `npm run fetch-data`；检查 `public/generated/` 是否有 `.webp`，`_generated/*.json` 中 `localCoverPath` 是否正确。
- **主题色不匹配壁纸**：跨域图片 CORS 受限时会回退默认色；换允许 CORS 的壁纸或手动指定 `--theme-color`。

## 部署

**Cloudflare Pages**（推荐）：连接 Git 仓库，Build command `npm run build`，输出目录 `dist`，Node 版本 20+。推 `main` 自动部署。Vercel / Netlify / 自托管同理（自托管可用 `npx serve dist`）。

## 维护者须知（易踩的坑）

这些是该项目的“反直觉”约束，改代码前务必阅读，否则会引入**静默故障**或**性能回退**：

1. **豆瓣提取函数必须“自包含”**（`scripts/lib/providers/douban.js`）
   `getDoubanData` 通过 `page.evaluate(extractInPage, type)` 在浏览器里执行提取逻辑。Puppeteer **只序列化这个函数本身**，不会捕获它在 Node 模块作用域里引用的其它函数/常量。历史上曾把 `extractMovie`/`extractBook`/`extractAlbum`/`extractText`/`BOOK_INVALID_PUBLISHER` 拆成模块级函数传给 `page.evaluate`，结果浏览器里全部 `undefined` → 抛 `ReferenceError` → 被 `try/catch` 吞掉返回 `null` → **刷新时所有电影/书/专辑被静默丢弃**。
   ✅ 规则：所有在 `page.evaluate` 中运行的逻辑，必须内联进那个被传入的函数内部。

2. **`refresh.js` 的 `steam` 必需字段不要要求 `localPosterPath`**
   Steam 的 `library_600x900.jpg` 对部分 app 不存在，下载会返回 `null`。若把 `localPosterPath` 列为必需字段，条目永远“不完整”→ 每次抓取都重复请求 Steam。当前判据为 `['posterUrl', 'localCoverPath']`。改这里前想清楚：必填项应是“远程数据/本地封面”这类稳定可得的字段。

3. **配置与展示“双重注册”**
   抓取侧：新增 `src/config/<x>.json` 会被 `listConfigFiles()` 自动发现并抓取。
   渲染侧：还要在 `src/lib/collections.ts` 的 `collections` 增加展示配置（key、导航文案、卡片字段、封面来源），并加入 `collectionList`；路由 `[collection].astro` 已按 key 自动生成，无需新建页面。
   两侧 key 必须一致（games / movies / books / albums）。

4. **不要手动改 `_generated/` 与 `public/generated/`**
   二者均由 `npm run fetch-data` 生成，提交它们但不要手改；手改会在下次抓取被覆盖或产生不一致。

5. **改完抓取脚本要验证**
   `npm run build` / `npm run check` **不会执行** `scripts/` 下的 Node 脚本（纯 JS，不接入 Astro 类型检查）。改了 `scripts/` 后，至少跑 `node --check scripts/...` 做语法校验；涉及抓取逻辑则用 `npm run fetch-data` 实跑一次并核对 `_generated/*.json`。

6. **领域字段由字符串键驱动**
   `collections.ts` 的 `coverKeys` / `metaFields[].keys` 是字符串（如 `'developer'`），需与 provider 输出字段名逐一对应。重命名 provider 输出字段时，记得同步更新 `collections.ts`，否则该字段静默不显示。

## AI Agent 使用指南

本部分供 AI 助手（Copilot / Cursor / CodeBuddy 等）快速、安全地操作本项目。**严格依据本文件描述的真实结构，不要凭空假设文件。**

### 项目认知要点

- **数据驱动**：内容由 `src/config/*.json` 的 URL 列表驱动，抓取脚本生成 `src/content/_generated/*.json`。
- **配置与展示分离**：集合“展示配置”集中在 `src/lib/collections.ts`，与“数据”解耦；卡片字段由 `metaFields` / `coverKeys`（字符串键）配置驱动。
- **静态生成**：Astro 构建期生成纯静态文件，无运行时服务端依赖。
- **脚本与站点两套代码**：`scripts/`（Node 抓取管线，纯 JS）与 `src/`（Astro 前端，TS）互不进入对方的构建/类型检查。

### 操作清单

| 用户意图 | 操作 |
| --- | --- |
| 添加一个新游戏/电影/书/专辑 | 在对应 `src/config/<key>.json` 追加 URL → `npm run fetch-data` → 验证 `_generated/<key>.json` 与 `public/generated/*.webp` → 提交 |
| 修改个人信息 | 改 `src/config/profile.json`（立即生效，无需跑脚本）→ `npm run dev` 预览 |
| 修改样式 | 改 `src/styles/global.css`（`:root` 令牌、`.glass-panel` 工具类、各组件区块）→ `npm run dev` |
| 修改某集合展示字段 | 改 `src/lib/collections.ts` 对应集合的 `metaFields` / `coverKeys`（字符串键须匹配 provider 输出）→ `npm run check` |
| 新增内容类型（动漫/漫画） | ① 建 `src/config/<x>.json`；② 若新平台，在 `scripts/lib/url.js` 的 `MATCHERS` 加规则并在 `providers/` 加抓取器、接入 `fetchByPlatform()`；③ 在 `collections.ts` 加展示配置并加入 `collectionList`；④ `npm run fetch-data` |
| 修复滚动/标签页交互 | `src/pages/index.astro` 的 `<script>`（`hero-scroll-link` / `getBoundingClientRect` 计算） |
| 优化性能 | 封面已统一 WebP（Sharp 质量 80）；Astro 自动代码分割；Cloudflare 自动缓存 |

### 命令速查

```bash
npm run dev          # 开发服务器
npm run build        # 生产构建 → dist/
npm run preview      # 预览生产构建
npm run check        # Astro 类型检查（改了 src/ 后必跑）
npm run fetch-data   # 运行抓取脚本（改了 config 后必跑）

node --check scripts/lib/xxx.js   # 改了 scripts/ 后做语法校验（构建不会覆盖）

cat src/config/profile.json
cat src/content/_generated/games.json | head
ls -lh public/generated/
```

### 调试技巧

- 看抓取日志：脚本会逐条打印语言/平台/兜底情况；失败时 console.error 有上下文。
- 查生成数据：`cat src/content/_generated/<key>.json`，核对字段是否非空。
- 主题色：在 `src/lib/theme.ts` 的 `applyThemeColor()` 临时 `console.log` 采样结果。
- 豆瓣挑战：`scripts/lib/providers/douban.js` 的 `solveChallenge()` 处理 SHA-512 工作量证明。

### ✅ 推荐 / ❌ 避免

- ✅ 改 `src/config/*.json` 后立即 `npm run fetch-data`；改 `src/` 后跑 `npm run check`。
- ✅ 命名约定：配置小写 `.json`；生成文件在 `_generated/`；图片 `public/generated/{type}_{id}_{cover|poster}.webp`。
- ❌ 不要手改 `_generated/` 与 `public/generated/`。
- ❌ 不要把 `page.evaluate` 的函数拆出 Node 模块级依赖（见“维护者须知 1”）。
- ❌ 不要把 `refresh.js` 里 `steam` 的必需字段改成会 404 的 `localPosterPath`（见“维护者须知 2”）。
- ❌ 不要硬编码数据；所有内容来自配置文件。
- ❌ 不要直接改 `dist/`（构建产物）。

### 常见问题

**Q: 如何本地测试 GitHub Actions？**
A: 用 [act](https://github.com/nektos/act)：`act workflow_dispatch`（注意 Puppeteer 在容器内需要系统依赖）。

**Q: 如何提升豆瓣抓取成功率？**
A: 增大 Puppeteer 超时；调整 `solveChallenge()` 难度参数；降低频率（脚本已内置 `delay(1000)`）；必要时用代理 IP。

**Q: 为什么刷新后某些条目消失了？**
A: 优先检查 `getDoubanData` 是否因 `page.evaluate` 闭包问题返回 `null`（见维护者须知 1），或 `shouldRefreshItem` 因必需字段缺失而反复重抓却仍失败（见维护者须知 2）。

## 致谢

- [Astro](https://astro.build/) · [Sharp](https://sharp.pixelplumbing.com/) · [Puppeteer](https://pptr.dev/) · [Cloudflare Pages](https://pages.cloudflare.com/)
