# Logbook

一个基于 Astro 4.x 构建的高级内容策展平台，旨在自动捕捉和组织您在游戏、电影、书籍等方面数字体验。

## 🏗️ 架构概览

### 核心技术栈
- **框架**: Astro 4.x (静态站点生成模式) - 专为内容驱动的站点提供原生 Markdown 支持
- **数据存储**: 纯文本驱动方法，利用 GitHub 仓库中的 Markdown (.md) 和 JSON 文件
- **数据处理**: GitHub Actions + Node.js (Puppeteer/API 脚本) 进行定时数据获取和转换
- **托管平台**: Cloudflare Pages 与 GitHub 集成，实现在边缘节点部署

### 仓库结构
```
logbook/
├── .github/
│   └── workflows/
│       └── manual-fetcher.yml    # GitHub Actions 工作流，用于手动数据获取
├── scripts/
│   └── fetch-metadata.js         # 用于链接爬取、元数据处理和图片转换的核心脚本
├── src/
│   ├── content/
│   │   ├── config/               # 💡 博主日常维护区域
│   │   │   ├── profile.json      # 主页头像、简介、社交链接配置
│   │   │   ├── games.json        # 仅存放 Steam/Epic 链接
│   │   │   ├── movies.json       # 仅存放 豆瓣电影 链接
│   │   │   ├── books.json        # 仅存放 豆瓣图书 链接
│   │   │   └── other.md          # "其他"页面的自定义 Markdown 内容
│   │   └── _generated/           # ⛔ 由 Actions 自动生成 (封面图、摘要等JSON格式)
│   ├── pages/                    # 页面路由 (首页、游戏、电影、书籍、其他)
│   └── layouts/                  # 整体布局 (包含自动提取壁纸色调功能)
└── astro.config.mjs              # Astro 配置文件
```

## 🤖 自动化数据管道

用于"自动获取"和"图片压缩"的核心自动化流程:

```
[博主更新链接 JSON / 手动触发]
                    │
                    ▼
        GitHub Actions 执行
                    │
                    ▼
        运行 scripts/fetch-metadata.js
                    │
                    ▼
        ┌─────────────────────────────────┐
        │ 读取原始链接列表                │
        │ (games.json / movies.json /    │
        │  books.json)                   │
        └─────────────────────────────────┘
                    │
                    ▼
        ┌─────────────────────────────────┐
        │ 与缓存数据对比，                │
        │ 识别新链接                     │
        └─────────────────────────────────┘
                    │
                    ▼
        ┌─────────────────────────────────┐
        │ 通过开源爬虫/API 获取数据:       │
        │ • Steam/Epic → Steam 商店 API  │
        │ • 豆瓣 → 无头浏览器            │
        │   (Puppeteer) 获取结构化元数据 │
        └─────────────────────────────────┘
                    │
                    ▼
        ┌─────────────────────────────────┐
        │ 使用 sharp 库自动压缩高分辨率  │
        │ 封面图片为 .webp 格式          │
        └─────────────────────────────────┘
                    │
                    ▼
        ┌─────────────────────────────────┐
        │ 将处理好的数据 (本地 WebP 路径, │
        │ 摘要, 发布日期等) 写入         │
        │ src/content/_generated/        │
        └─────────────────────────────────┘
                    │
                    ▼
        自动 Git 提交并推送回去
                    │
                    ▼
Cloudflare Pages 检测到仓库变更 → 触发构建 → 网站部署完成!
```

## 🎨 前端与交互设计

### 英雄区: 个人主页 (全屏卡片)
- **视觉层**: 全屏背景壁纸 (在 profile.json 中配置)
- **主题色自动提取**: 布局模板包含轻量级 colorthief/node-vibrant 脚本，在静态编译期间计算壁纸的主色调和鲜艳色，注入为 CSS 全局变量 (如 --theme-color)。按钮边框和高亮文字自动匹配提取的颜色。

### 社交组件: 内置 GitHub、邮箱、X、Instagram、Telegram、Facebook 的 SVG 图标。从 profile.json 读取激活的频道，自动呈现相应的跳转按钮。

### 主内容: 滚动渐变与分类导航
- **视差效果**: 随着向下滚动，背景壁纸逐渐降低不透明度并添加高斯模糊 (backdrop-filter: blur)，平滑过渡到沉浸式的深色/浅色卡片背景。
- **导航**: 顶部固定导航栏，包含"游戏、电影、书籍、专辑、其他"标签，具有无缝平滑动画 (利用 Astro 的视图转换 API)。

### 内容展示页面
- **卡片网格 (瀑布流)**: 每个媒体项目以精美的海报卡片形式显示。所有封面都固化为快速加载的本地 .webp 文件。
- **悬停效果**: 卡片悬停时的 3D 倾斜效果。每个卡片下方精美排版展示:
  - 游戏: 标题、封面、摘要、开发商/发行商、发布日期
  - 电影: 标题、封面、剧情摘要、制作/发行公司、发布日期
  - 书籍: 标题、封面、作者、摘要

### 其他页面: 通过 Astro 的 `<Content />` 直接渲染 other.md 文件的图文内容，无缝呈现博主的自定义 Markdown 样式。

## 🔧 安装说明

### 前置条件
- Node.js v18+
- npm 或 yarn 包管理器

### 安装步骤
1. 克隆仓库:
```bash
git clone https://github.com/hohouman/logbook.git
cd logbook
```

2. 安装依赖:
```bash
npm install
```

3. 在 `src/content/config/profile.json` 中配置个人信息

4. 在以下文件中添加您的链接:
   - `src/content/config/games.json` - Steam/Epic 游戏链接
   - `src/content/config/movies.json` - 豆瓣电影链接
   - `src/content/config/books.json` - 豆瓣图书链接

### 本地运行
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

## 🚀 部署

此项目专为在 Cloudflare Pages 上部署而设计:
1. 将您的 GitHub 仓库连接到 Cloudflare Pages
2. 设置构建命令为 `npm run build`
3. 设置构建输出目录为 `dist`
4. Cloudflare Pages 将在每次提交时自动重建和部署

## 🤖 GitHub Actions 自动化

仓库包含一个 GitHub Action 工作流 (`manual-fetcher.yml`)，可以手动触发以:
1. 从提供的链接获取元数据
2. 下载并转换图片为 WebP 格式
3. 在 `src/content/_generated/` 中生成 JSON 文件
4. 提交并推送更改回仓库

要手动触发工作流:
1. 前往 GitHub 仓库的"操作"选项卡
2. 选择"手动 Logbook 数据获取器"工作流
3. 点击"运行工作流"