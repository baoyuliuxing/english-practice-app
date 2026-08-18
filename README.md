# 英语写作练习 App

> AI 驱动的英语写作练习工具 — 智能纠错 · 对话陪练 · 日记生成

## ✨ 功能

| 功能 | 说明 |
|------|------|
| **智能纠错** | 输入中文/英文/中英混合，AI 自动纠正语法、翻译并给出解析 |
| **对话陪练** | 纠错同时 AI 英文接话引导，一次回复完成纠错+陪练 |
| **日记生成** | 点击「结束 & 生成日记」，AI 汇总所有练习句子生成英文日记 |
| **日历工作台** | 按月回看每天的练习和日记，无记录的日期可补写 |
| **生词本** | 点击任意英文单词加入生词本，支持遮盖中/英文背诵模式 |
| **数据导入导出** | 全部数据（练习+日记+生词）一键导出 JSON，粘贴即可导入 |
| **历史记录** | 本地 IndexedDB 持久化，随时回顾历史练习和日记 |
| **PWA 离线** | 可安装到手机桌面（HTTPS 环境下） |

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

首次打开应用后，点击右上角 🔑 图标，粘贴你的 DeepSeek API Key（存在浏览器本地）。

> 获取 DeepSeek API Key: https://platform.deepseek.com/api_keys

### 3. 本地开发

```bash
npm run dev
```

浏览器打开 `http://localhost:5173`

## 🏠 本地部署（无需梯子）

应用是纯静态网站，数据全部存在浏览器 IndexedDB 里，AI 直连 DeepSeek（国内可直连）。
在本地跑起来后不依赖任何外部服务。

### Windows

1. 安装 [Node.js LTS](https://nodejs.org/zh-cn)（只需装一次）
2. 双击项目目录里的 **`启动本地服务.bat`**
3. 看到 `http://localhost:4173` 即成功

### Mac / Linux

```bash
./start-local.sh
```

### 手机访问

1. 手机和电脑连接**同一个 WiFi**
2. 启动脚本会显示局域网地址（如 `http://192.168.1.100:4173`）
3. 手机浏览器打开该地址，建议添加到书签

### 数据迁移（重要）

浏览器数据按访问地址隔离：从线上地址换到本地地址后，之前的日记和生词**不会自动带过来**。
迁移步骤：

1. 在**旧地址**打开应用 → 顶部栏 ⇄ 按钮 → **导出** → 复制或下载
2. 在**新地址**打开应用 → ⇄ 按钮 → **导入** → 粘贴内容 → 导入

### 局域网 HTTP 访问的限制

Service Worker 需要 HTTPS 或 localhost，所以局域网 IP 访问时：
- ❌ PWA 安装到桌面、离线缓存不可用
- ✅ 所有功能正常（练习、日记、生词本、导入导出）

## 📦 部署到 Vercel（可选）

推送到 GitHub 后在 Vercel 导入仓库即可自动部署：

https://english-practice-app-kohl.vercel.app

> 注意：vercel.app 在国内部分网络环境下需要梯子才能访问，建议配合上面的本地部署使用。

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

1. **开始练习**：输入任意中文或英文，AI 会纠正语法、翻译、解释，并英文接话引导对话。
2. **生词本**：点击任意英文单词（消息、日记中都可以）加入生词本，可在生词本中遮盖中文/英文背诵。
3. **生成日记**：点击「结束 & 生成日记」，AI 会将所有纠正过的句子整合成一篇连贯的英文日记。
4. **日历工作台**：点击 📅 按月回看练习记录和日记，没练的日期可以补写。
5. **历史记录**：点击左上角菜单图标，查看历史练习和日记。
6. **数据迁移**：⇄ 按钮导出全部数据，换设备/换地址时粘贴导入。

## ⚙️ 数据与隐私

- API Key 存在浏览器 localStorage
- 练习记录、日记、生词本存在浏览器 IndexedDB
- 清除浏览器数据会丢失记录，建议定期用 ⇄ 导出备份

## 📄 License

MIT
