# Notion Chat App

一個整合 Notion API 和 Google Gemini AI 的智能桌面聊天應用程式。用戶可以透過自然語言搜尋他們的 Notion 工作區，並獲得 AI 驅動的回應。

![License](https://img.shields.io/badge/license-MIT-green)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)
![Electron](https://img.shields.io/badge/Electron-Latest-blue)

## ✨ 特色功能

- 🤖 **智能意圖分析** - 自動識別用戶是要搜尋、問候或一般對話
- 🔍 **動態多輪搜索** - 支援 1-3 輪搜索策略，可自動優化和擴展關鍵詞
- 📚 **深度內容抓取** - 遞歸讀取 Notion 頁面內容，包含子頁面和所有區塊類型
- 🎯 **智能內容篩選** - AI 自動評估內容適用性並生成整合回覆
- 🔄 **多 API Key 輪替** - 支援多個 Gemini API Keys 自動切換
- 🔒 **安全設計** - 採用 Electron 安全最佳實務，禁用 Node 整合
- 📊 **詳細統計** - 提供 API 調用統計和搜索過程透明化

## 🏗️ 技術架構

```
Frontend (Electron Renderer)
    ↓ IPC 通訊 (安全的 Context Bridge)
Main Process (Electron)
    ↓ HTTP 請求
Express.js API Server
    ↓ 模組化服務層
┌─────────────────┬─────────────────┬─────────────────┐
│  SearchService  │ NotionService  │ GeminiService  │
│  (搜索策略)      │ (API 整合)      │ (AI 生成)       │
└─────────────────┴─────────────────┴─────────────────┘
```

### 核心技術棧

- **前端**: Electron (Renderer Process) + HTML/CSS/JS
- **後端**: Node.js + Express.js
- **外部 API**: Notion API (@notionhq/client) + Google Gemini AI (@google/generative-ai)
- **架構**: 模組化服務導向架構 (SOA)

## 🚀 快速開始

### 環境需求

- Node.js 18.0+
- npm 或 yarn
- Notion 工作區和 Integration Token
- Google AI Studio API Key

### 1. 安裝

```bash
# 克隆專案
git clone <repository-url>
cd notion-chat-app

# 安裝依賴
npm install
```

### 2. 配置環境變數

複製 `.env.example` 為 `.env` 並設定：

```bash
# Notion API
NOTION_TOKEN=secret_xxx...

# Gemini AI (支援多個 Keys)
GEMINI_API_KEY=AIzaSy...
GEMINI_API_KEY_2=AIzaSy...  # 可選
GEMINI_API_KEY_3=AIzaSy...  # 可選

# 伺服器
PORT=3002
NODE_ENV=development
```

### 3. Notion Integration 設定

1. 前往 [Notion Developers](https://www.notion.so/my-integrations)
2. 創建新的 Integration
3. 複製 `Internal Integration Token`
4. 在需要搜尋的頁面點擊 **Share** → **Invite** → 選擇你的 Integration

### 4. 運行應用

```bash
# 開發模式 (同時啟動伺服器和 Electron)
npm run dev

# 或分別啟動
npm run server    # 啟動後端 API (port 3002)
npm start         # 啟動 Electron 桌面應用
```

## 📖 使用說明

### 基本搜索

1. 在聊天輸入框輸入搜索請求：
   - "找 React 相關的筆記"
   - "搜尋關於 API 設計的資料"
   - "有沒有 Python 教學內容"

2. 選擇搜索模式：
   - **單循環** 🟢 - 快速搜索，使用原始關鍵詞
   - **雙循環** 🟡 - 平衡模式，第二輪優化關鍵詞
   - **三循環** 🔴 - 精確模式，第三輪擴展搜索範圍

### 搜索策略說明

#### 🔍 動態多輪搜索流程

```
用戶輸入 → 意圖分析 → 生成關鍵詞
    ↓
第一輪：原始關鍵詞 → Notion 搜索 → AI 篩選頁面 → 讀取內容 → 評估適用性
    ↓ (如果不適合)
第二輪：優化關鍵詞 → 重複上述流程
    ↓ (如果仍不適合)  
第三輪：擴展關鍵詞 → 重複上述流程
    ↓
生成整合回覆 + 參考連結
```

## 🛠️ 開發指南

### 專案結構

```
notion-chat-app/
├── src/                    # Electron 相關檔案
│   ├── main.js            # 主程序
│   ├── preload.js         # 預載腳本 (安全橋接)
│   └── renderer/          # 渲染程序 (前端)
│       ├── index.html
│       ├── styles.css
│       └── renderer.js
├── server/                # Express API 伺服器
│   └── index.js          # API 路由和中間件
├── services/              # 服務層模組
│   ├── geminiService.js   # Gemini AI 管理
│   ├── notionService.js   # Notion API 操作
│   └── searchService.js   # 搜索業務邏輯
├── middleware/            # Express 中間件
│   └── errorHandler.js    # 全域錯誤處理
├── config/                # 配置檔案
│   ├── index.js          # 統一配置入口
│   ├── app.js            # Electron 應用配置
│   ├── server.js         # 伺服器配置
│   └── validator.js      # 環境變數驗證
├── utils/                 # 工具函式
│   └── logger.js         # 日誌系統
└── docs/                  # 文檔
    └── API.md            # API 詳細文檔
```

### 可用腳本

```bash
npm run dev          # 開發模式 (concurrently 啟動伺服器和應用)
npm run server       # 僅啟動 Express API 伺服器
npm start            # 僅啟動 Electron 應用
npm run build        # 建置桌面應用程式
npm test             # 運行測試 (尚未實作)
```

### API 端點

| 方法 | 端點 | 描述 |
|------|------|------|
| POST | `/chat` | 主要聊天介面，支援多輪搜索 |
| POST | `/analyze-page` | 分析特定 Notion 頁面 |
| GET  | `/test-notion` | 測試 Notion API 連線 |
| GET  | `/health` | 伺服器健康檢查 |
| GET  | `/api-status` | API Keys 狀態檢查 |

詳細 API 文檔請參閱 [docs/API.md](docs/API.md)

## 🔧 配置選項

### Electron 配置 (`config/app.js`)

```javascript
module.exports = {
  window: {
    width: 800,
    height: 800,
    webPreferences: {
      nodeIntegration: false,      // 安全設定
      contextIsolation: true,      // 啟用上下文隔離
      preload: path.join(...)      // 安全預載腳本
    }
  }
};
```

### 伺服器配置 (`config/server.js`)

```javascript
module.exports = {
  port: process.env.PORT || 3002,
  cors: {
    origin: ['http://localhost:*', 'https://localhost:*'],
    credentials: true
  }
};
```

## 🧪 測試

```bash
# 測試 Notion API 連線
curl http://localhost:3002/test-notion

# 測試聊天功能
curl -X POST http://localhost:3002/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"找React筆記","maxRounds":2}'

# 檢查伺服器健康狀態
curl http://localhost:3002/health
```

## 🔐 安全考量

### Electron 安全

- ✅ 禁用 `nodeIntegration`
- ✅ 啟用 `contextIsolation`
- ✅ 使用安全的 `preload.js` 腳本
- ✅ 透過 `contextBridge` 限制 API 暴露

### API 安全

- ✅ 統一錯誤處理中間件
- ✅ 環境變數驗證
- ✅ 程序級錯誤捕獲
- ✅ API Key 輪替機制

## 📊 效能最佳化

### API 調用管理

- **Notion API**: 內建速率限制 (每秒 3 次請求)
- **Gemini AI**: 多 Key 輪替，自動錯誤恢復
- **記憶體管理**: 限制頁面內容大小和遞歸深度

### 搜索效率

- 關鍵詞去重機制
- 頁面選擇優化 (AI 篩選最相關)
- 內容適用性預先評估

## 🚧 已知限制

1. **Notion API 限制**: 只能搜索頁面標題，不能搜索內容
2. **語言支援**: 主要針對繁體中文優化
3. **快取機制**: 目前無搜索結果快取
4. **離線功能**: 需要網路連線才能運作

## 🛣️ 未來規劃

- [ ] 搜索結果快取機制
- [ ] 支援更多語言
- [ ] 頁面內容全文搜索
- [ ] 搜索歷史記錄
- [ ] 自定義搜索模板
- [ ] 資料匯出功能

## 🐛 故障排除

### 常見問題

**Q: Notion API 連線失敗**
```bash
# 檢查 Token 設定
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.notion.com/v1/users/me
```

**Q: Gemini API 配額用盡**
- 添加更多 API Keys 到環境變數
- 檢查 API Keys 狀態: `GET /api-status`

**Q: Electron 無法啟動**
- 確認 Node.js 版本 18+
- 清除 node_modules: `rm -rf node_modules && npm install`

### 除錯模式

```bash
# 啟用詳細日誌
NODE_ENV=development npm run dev

# 查看錯誤日誌
tail -f logs/error.log  # 如果有日誌檔案
```

## 🤝 貢獻指南

1. Fork 專案
2. 創建功能分支: `git checkout -b feature/new-feature`
3. 提交變更: `git commit -m 'Add new feature'`
4. 推送分支: `git push origin feature/new-feature`
5. 提交 Pull Request

## 📝 授權條款

本專案採用 MIT 授權條款 - 詳見 [LICENSE](LICENSE) 檔案

## 🙏 致謝

- [Notion API](https://developers.notion.com/) - 強大的筆記平台
- [Google Gemini AI](https://ai.google.dev/) - 先進的生成式 AI
- [Electron](https://www.electronjs.org/) - 跨平台桌面應用框架

---

**如有問題或建議，歡迎開啟 Issue 討論！** 🚀

*最後更新: 2025-01-11*