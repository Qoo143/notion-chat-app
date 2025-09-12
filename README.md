# Notion Chat App

> 🤖 AI 驅動的 Notion 知識庫聊天助手
> 
> 使用 Electron + Gemini AI + Notion API 構建的桌面聊天應用，讓你的 Notion 工作區變成智能對話夥伴

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/user/notion-chat-app)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org)
[![Electron](https://img.shields.io/badge/electron-27.0.0-9feaf9.svg)](https://electronjs.org)

## 📖 專案概述

**Notion Chat App** 是一個使用 Electron 構建的桌面聊天應用程式，整合了 Notion API 和 Google Gemini AI。使用者可以透過自然語言搜尋他們的 Notion 工作區，並獲得 AI 驅動的智慧回應以及相關頁面的直接連結。

### ✨ 核心特色

- 🔍 **智慧搜尋**: 多輪搜尋策略，從快速到精確的可調節搜尋深度
- 🧠 **意圖分析**: AI 自動分析用戶意圖 (問候/搜尋/對話)
- 📚 **深度整合**: 完整的 Notion 頁面內容提取與格式保留
- ⚡ **高效能**: 多 API Key 輪替，智慧錯誤處理
- 🔒 **安全設計**: Context isolation + IPC 安全通訊
- 🎨 **現代 UI**: 直觀的聊天介面，即時狀態回饋

### 🎯 適用場景

- 📝 **知識管理**: 快速搜尋大量 Notion 筆記和文件
- 💡 **內容發現**: 透過自然語言找到相關資料
- 🤔 **問答系統**: 對 Notion 內容進行智慧問答
- 📊 **資料查詢**: 高效率的工作區內容檢索

## 🏗 技術架構

```mermaid
graph TB
    A[用戶輸入] --> B[Electron 渲染程序]
    B --> C[IPC 通訊]
    C --> D[Electron 主程序]
    D --> E[Express API 伺服器]
    E --> F[意圖分析系統]
    F --> G{意圖類型}
    G -->|greeting| H[問候處理]
    G -->|search| I[搜尋服務]
    G -->|chat| J[對話處理]
    I --> K[Notion API]
    I --> L[Gemini AI]
    K --> M[內容提取]
    L --> N[智慧回應]
    M --> O[結果整合]
    N --> O
    O --> P[格式化回傳]
    P --> Q[前端顯示]
```

### 🛠 技術堆疊

| 層級 | 技術 | 版本 | 用途 |
|------|------|------|------|
| **前端** | Electron | ^27.0.0 | 桌面應用框架 |
| **後端** | Express.js | ^4.18.2 | API 伺服器 |
| **AI** | Google Gemini | ^0.2.1 | 智慧分析與回應 |
| **API** | Notion Client | ^2.2.13 | 工作區數據存取 |
| **工具** | Axios | ^1.6.0 | HTTP 客戶端 |
| **配置** | dotenv | ^16.3.1 | 環境變數管理 |

## 🚀 快速開始

### 前置要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- Notion Integration Token
- Google Gemini AI API Key

### 安裝步驟

1. **克隆專案**
   ```bash
   git clone https://github.com/user/notion-chat-app.git
   cd notion-chat-app
   ```

2. **安裝依賴**
   ```bash
   npm install
   ```

3. **環境配置**
   ```bash
   # 複製環境變數範本
   cp .env.example .env
   
   # 編輯 .env 檔案，填入你的 API 金鑰
   NOTION_TOKEN=ntn_your_notion_integration_token
   GEMINI_API_KEY=AIzaSy_your_gemini_api_key
   ```

4. **啟動應用**
   ```bash
   # 開發模式 (同時啟動後端和前端)
   npm run dev
   ```

### 📋 可用指令

| 指令 | 功能 |
|------|------|
| `npm start` | 僅啟動 Electron 應用 |
| `npm run server` | 僅啟動後端 API 伺服器 |
| `npm run dev` | 同時啟動伺服器和應用 ⭐ |
| `npm run build` | 建置桌面應用程式 |

## ⚙️ 配置說明

### 環境變數設定

在 `.env` 檔案中配置以下變數：

```bash
# Notion API 設定 (必須)
NOTION_TOKEN=ntn_your_notion_integration_token

# Gemini API 設定 - 支援多 Key 輪替 (必須)
GEMINI_API_KEY=AIzaSy_your_primary_key
GEMINI_API_KEY_2=AIzaSy_your_backup_key_2  # 可選
GEMINI_API_KEY_3=AIzaSy_your_backup_key_3  # 可選

# 伺服器設定 (可選)
PORT=3002                    # 預設: 3002
HOST=localhost              # 預設: localhost
```

### Notion Integration 設定

1. 前往 [Notion Integrations](https://www.notion.so/my-integrations)
2. 建立新的 Integration
3. 複製 Integration Token (以 `ntn_` 開頭)
4. 將 Integration 加入到你要搜尋的 Notion 頁面

### Google Gemini API 設定

1. 前往 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 建立 API Key (以 `AIzaSy` 開頭)
3. 建議設定多個 API Key 以避免配額限制

## 💬 使用方法

### 基本操作

1. **啟動應用**: 運行 `npm run dev`
2. **選擇搜尋模式**: 
   - 單循環 (快速) - 基本搜尋
   - 雙循環 (平衡) - 優化搜尋
   - 三循環 (精確) - 深度搜尋
3. **輸入查詢**: 使用自然語言描述你要找的內容
4. **查看結果**: AI 會分析並回傳相關的 Notion 頁面和智慧回應

### 支援的查詢類型

#### 🔍 搜尋查詢
```
找一下關於 JavaScript 的筆記
有沒有專案管理相關的文件？
幫我查找會議記錄
```

#### 👋 問候對話
```
你好
嗨！
早安
```

#### 💭 一般對話
```
如何學習 React？
什麼是人工智慧？
```

## 📊 功能限制與注意事項

### ⚠️ Notion API 限制

- **搜尋範圍**: 僅支援頁面標題搜尋，不支援內容全文搜尋
- **速率限制**: 每次請求間隔 350ms，避免觸發限制
- **權限要求**: 需要正確的 Integration 設定和頁面存取權限
- **回傳限制**: 每次搜尋最多回傳 10 個結果

### 🤖 Gemini AI 限制

- **網路依賴**: 需要穩定的網際網路連線
- **配額限制**: 有每日 API 調用限制
- **回應品質**: 依賴模型版本和提示品質

### 🔧 技術限制

- **本地部署**: 需要同時運行後端伺服器 (埠號 3002)
- **單用戶**: 設計為單用戶桌面應用，無多用戶支援
- **內容深度**: 頁面內容提取最大深度 3 層
- **同步處理**: 無法處理大量並行請求

## 📡 API 架構

### 核心端點

| 方法 | 端點 | 描述 |
|------|------|------|
| POST | `/chat` | 主要聊天介面，支援多輪搜尋 |
| GET  | `/test-notion` | 測試 Notion API 連線 |
| GET  | `/health` | 伺服器健康檢查 |
| GET  | `/api-status` | API Keys 狀態檢查 |

### 請求範例

```javascript
// 發送聊天訊息
const response = await fetch('http://localhost:3002/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: '找一下 JavaScript 相關的筆記',
    maxRounds: 2  // 搜尋輪數 (1-3)
  })
});
```

### 回應格式

```json
{
  "success": true,
  "response": "AI 產生的智慧回應...",
  "foundPages": [
    {
      "id": "page-id",
      "title": "頁面標題",
      "url": "https://www.notion.so/...",
      "snippet": "頁面摘要..."
    }
  ],
  "intent": "search",
  "apiStats": {
    "notionCalls": 2,
    "geminiCalls": 3,
    "totalCalls": 5
  }
}
```

詳細 API 文檔請參閱 [docs/API.md](docs/API.md)

## 🗂 專案結構

```
notion-chat-app/
├── config/                    # 📁 模組化配置系統
│   ├── app.js                # ⚙️ Electron 應用配置
│   ├── server.js             # 🌐 伺服器配置
│   ├── notion.js             # 📚 Notion API 配置
│   ├── gemini.js             # 🤖 Gemini AI 配置
│   ├── validator.js          # ✅ 配置驗證器
│   └── index.js              # 📤 配置匯出模組
├── server/
│   └── index.js              # 🚀 Express API 伺服器主檔
├── src/
│   ├── main.js               # 🖥 Electron 主程序
│   ├── preload.js            # 🔒 安全的 IPC 橋接
│   └── renderer/             # 🎨 前端渲染程序
│       ├── index.html        # 📄 主介面
│       ├── renderer.js       # ⚡ 前端邏輯
│       └── styles.css        # 🎭 介面樣式
├── services/                 # 🛠 業務邏輯服務層
│   ├── geminiService.js      # 🤖 Gemini AI 服務
│   ├── notionService.js      # 📚 Notion API 服務
│   └── searchService.js      # 🔍 多輪搜尋服務
├── middleware/
│   └── errorHandler.js       # 🚨 錯誤處理中間件
├── utils/
│   └── logger.js             # 📋 日誌工具
├── docs/                     # 📖 專案文檔
└── .env.example              # 🔧 環境變數範本
```

## 🔧 開發指南

### 本地開發

1. **修改程式碼**: 編輯相關檔案
2. **熱重載**: 
   - 後端更改需重啟 `npm run dev`
   - 前端更改可直接重新載入
3. **偵錯**: 開發模式會自動開啟 DevTools

### 新增功能

1. **新增 API 端點**: 在 `server/index.js` 中新增路由
2. **擴展搜尋邏輯**: 修改 `services/searchService.js`
3. **調整 UI**: 編輯 `src/renderer/` 下的檔案
4. **新增配置**: 在 `config/` 目錄下建立模組

### 程序管理

#### 正常關閉
在終端按 `Ctrl+C` 中斷程序

#### 強制關閉
如果程序未正常關閉：
```bash
# 查找占用 3002 埠號的程序
netstat -ano | findstr :3002

# 終止程序 (將 PID 替換為實際程序 ID)
powershell "Stop-Process -Id [PID] -Force"
```

## 🚢 部署與建置

### 桌面應用建置

```bash
# 建置所有平台
npm run build

# 輸出位置: dist/
```

### 環境部署檢查清單

- [ ] Node.js >= 16.0.0 已安裝
- [ ] 埠號 3002 未被佔用
- [ ] Notion Integration Token 已設定且有效
- [ ] Gemini API Key 已設定且有效
- [ ] 網際網路連線正常
- [ ] Notion 工作區權限已正確配置

## 🤖 AI 快速參考 (機器可讀)

```yaml
project_metadata:
  name: "notion-chat-app"
  type: "electron-desktop-app"
  version: "1.0.0"
  
core_technologies:
  frontend: "electron@27.0.0"
  backend: "express@4.18.2"
  ai_service: "google-generative-ai@0.2.1"
  api_client: "@notionhq/client@2.2.13"
  
architecture_pattern: "electron-ipc-express-api"

entry_points:
  electron_main: "src/main.js"
  api_server: "server/index.js"
  frontend: "src/renderer/index.html"
  
api_endpoints:
  - "POST /chat"
  - "GET /test-notion" 
  - "GET /health"
  - "GET /api-status"

key_services:
  - "services/searchService.js"    # Multi-round search engine
  - "services/notionService.js"    # Notion API integration
  - "services/geminiService.js"    # Gemini AI management
  
config_system: "config/ directory with modular configuration"

environment_vars:
  required: ["NOTION_TOKEN", "GEMINI_API_KEY"]
  optional: ["GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "PORT", "HOST"]
  
intent_types: ["greeting", "search", "chat"]
search_modes: [1, 2, 3]  # rounds of search

limitations:
  notion_api: "title_search_only"
  rate_limit: "350ms_between_requests"
  max_results: 10
  content_depth: 3
  
development_commands:
  dev: "npm run dev"
  server_only: "npm run server"  
  electron_only: "npm start"
  build: "npm run build"
```

## 🤝 開發團隊

| 角色 | 功能 |
|------|------|
| **Core Developer** | 架構設計、核心功能開發 |
| **AI Integration** | Gemini AI 整合、智慧分析 |
| **UI/UX Design** | 使用者介面設計、互動體驗 |

## 📄 授權條款

本專案採用 MIT 授權條款。詳細內容請參閱 [LICENSE](LICENSE) 檔案。

## 🔗 相關連結

- [Notion API 文檔](https://developers.notion.com/)
- [Google Gemini AI](https://ai.google.dev/)
- [Electron 官方文檔](https://www.electronjs.org/)
- [專案 API 詳細文檔](docs/API.md)

---

**Made with ❤️ by Developer Team**

*如有問題或建議，歡迎提交 Issue 或 Pull Request*