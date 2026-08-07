# 英语写作练习 App

> AI 驱动的英语写作练习工具 — 智能纠错 · 对话陪练 · 日记生成

## ✨ 功能

| 功能 | 说明 |
|------|------|
| **智能纠错** | 输入中文/英文/中英混合，AI 自动纠正语法、翻译并给出解析 |
| **对话陪练** | 纠正后切换对话模式，纯英文持续练习，AI 自然接话 |
| **日记生成** | 说「结束」汇总所有练习句子，AI 生成结构化英文日记 |
| **历史记录** | 本地 IndexedDB 持久化，随时回顾历史练习和日记 |
| **PWA 离线** | 可安装到手机桌面，离线可用 |

## 🛠 技术栈

- **前端**: React 18 + TypeScript + Vite 5
- **样式**: Tailwind CSS（移动优先响应式）
- **PWA**: vite-plugin-pwa（Service Worker + Manifest）
- **AI**: DeepSeek API（OpenAI 兼容格式）
- **存储**: IndexedDB（via idb）
- **部署**: Vercel（前端 + Serverless API 代理）

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

复制环境变量模板：

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入你的 DeepSeek API Key：

```bash
# 方式 A：开发直连（仅本地开发用，Key 暴露在浏览器中）
VITE_DEEPSEEK_API_KEY=sk-your-key-here

# 方式 B：通过 Serverless 代理（推荐，安全）
# 不需要配置前端变量，在 Vercel 部署时配置 DEEPSEEK_API_KEY
```

> 获取 DeepSeek API Key: https://platform.deepseek.com/api_keys

### 3. 本地开发

```bash
npm run dev
```

浏览器打开 `http://localhost:5173`

### 4. 生产构建

```bash
npm run build
npm run preview  # 本地预览构建产物
```

## 📦 部署到 Vercel

### 方式一：CLI 部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署（首次会询问项目配置，按默认即可）
vercel --prod
```

### 方式二：Git 集成部署

1. 将代码推送到 GitHub
2. 在 Vercel 控制台导入项目
3. **关键**：在项目设置 → Environment Variables 中添加：
   - `DEEPSEEK_API_KEY` = `sk-your-key-here`
4. 部署完成

### 配置 API Key（必须）

> 无论哪种部署方式，都需要在 Vercel 中配置 `DEEPSEEK_API_KEY` 环境变量。
> 这个 Key 存储在服务端，前端无法读取，确保安全。

路径：Vercel 项目 → Settings → Environment Variables → 添加 `DEEPSEEK_API_KEY`

## 📱 安装为手机 App（PWA）

1. 用手机浏览器访问部署后的 URL
2. **iOS Safari**: 点击分享按钮 →「添加到主屏幕」
3. **Android Chrome**: 点击菜单 →「添加到主屏幕」
4. 从桌面图标启动，全屏沉浸体验

## 🏗 项目结构

```
english-practice-app/
├── api/
│   └── chat.ts              # Vercel Serverless API 代理（保护 API Key）
├── src/
│   ├── components/          # UI 组件
│   │   ├── WelcomeScreen.tsx    # 欢迎页
│   │   ├── MessageBubble.tsx    # 消息气泡（纠错卡片/对话气泡）
│   │   ├── InputBar.tsx         # 底部输入栏
│   │   ├── ModeSwitcher.tsx     # 纠错/对话模式切换
│   │   ├── DiaryView.tsx        # 日记展示
│   │   ├── HistoryDrawer.tsx    # 历史记录抽屉
│   │   └── TypingIndicator.tsx  # 打字指示器
│   ├── hooks/
│   │   └── usePracticeApp.ts    # 核心状态管理 Hook
│   ├── lib/
│   │   ├── api.ts               # DeepSeek API 客户端
│   │   └── db.ts                # IndexedDB 持久化
│   ├── types/
│   │   └── index.ts             # TypeScript 类型定义
│   ├── styles/
│   │   └── index.css            # 全局样式
│   ├── App.tsx                  # 主应用组件
│   ├── main.tsx                 # 入口
│   └── vite-env.d.ts            # Vite 环境变量类型
├── public/                      # 静态资源（图标、favicon）
├── vercel.json                  # Vercel 部署配置
├── vite.config.ts               # Vite + PWA 配置
└── tailwind.config.js           # Tailwind 配置
```

## 🔄 交互流程

```
┌─────────────────────────────────────────────────┐
│                   开始练习                        │
│                       ↓                          │
│            ┌─── 纠错模式（默认）───┐              │
│            │  用户输入中/英/混合    │              │
│            │       ↓               │              │
│            │  AI 纠正 + 翻译 + 解析 │              │
│            │       ↓               │              │
│            │  句子存入纠正列表      │              │
│            └───────┬───────────────┘              │
│                    ↓                              │
│         用户切换到「对话模式」                      │
│                    ↓                              │
│            ┌─── 对话模式 ───┐                    │
│            │  纯英文对话陪练  │                    │
│            │  AI 自然接话     │                    │
│            └───────┬────────┘                    │
│                    ↓                              │
│         用户点击「结束 & 生成日记」                 │
│                    ↓                              │
│         AI 汇总所有纠正句子 → 生成英文日记          │
│                    ↓                              │
│         展示日记（可复制/分享/开始新练习）            │
└─────────────────────────────────────────────────┘
```

## 📝 使用说明

1. **纠错模式**：输入任意中文或英文，AI 会纠正语法、翻译并解释。每次纠正的句子会自动收集。
2. **对话模式**：点击顶部「💬 对话」切换，进入纯英文对话练习。AI 会自然接话，引导你多说。
3. **生成日记**：点击「结束 & 生成日记」，AI 会将所有纠正过的句子整合成一篇连贯的英文日记。
4. **历史记录**：点击左上角菜单图标，查看历史练习和日记。

## ⚙️ 环境变量

| 变量名 | 位置 | 说明 |
|--------|------|------|
| `DEEPSEEK_API_KEY` | Vercel 服务端 | 生产环境 API Key（安全，推荐） |
| `VITE_DEEPSEEK_API_KEY` | `.env.local` | 开发直连用（不推荐生产） |

## 📄 License

MIT
