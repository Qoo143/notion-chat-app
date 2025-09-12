# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 📚 快速記憶獲取指南

**重要**: README.md 包含完整的 AI 快速參考區塊，請優先閱讀以快速獲取專案記憶：

```bash
# 閱讀完整專案文檔和 AI 機器可讀區塊
Read README.md
# 特別注意第 336-388 行的 YAML 格式快速參考區塊
```

該區塊包含：
- 專案架構與技術堆疊
- 關鍵檔案位置與服務
- API 端點與環境變數
- 意圖類型與使用限制
- 開發指令與部署資訊

## 🏗 專案架構摘要

**Notion Chat App** - AI 驅動的桌面聊天應用程式，整合 Electron + Express + Notion API + Google Gemini AI

### 🔧 核心技術栈
- **前端**: Electron 27.0.0 (桌面應用框架)
- **後端**: Express.js 4.18.2 (API 伺服器)
- **AI 服務**: Google Gemini AI (@google/generative-ai)
- **API 整合**: Notion Client (@notionhq/client)

### 🗂 關鍵檔案位置
```
├── server/index.js              # 主 API 伺服器，路由與意圖分析
├── src/main.js                  # Electron 主程序 + dotenv
├── src/renderer/                # 前端 UI (HTML/CSS/JS)
├── services/                    # 業務邏輯層
│   ├── searchService.js         # 多輪搜尋引擎 (1-3 輪)
│   ├── notionService.js         # Notion API 整合
│   └── geminiService.js         # Gemini AI 管理 + 多 Key 輪替
├── config/                      # 模組化配置系統
│   ├── validator.js             # 環境變數驗證 (ntn_ 前綴支援)
│   └── intentAnalysis.js        # 意圖分析配置
└── .env                         # 環境變數 (NOTION_TOKEN, GEMINI_API_KEY)
```

## 📡 資料流向與通訊架構

```
用戶輸入 → renderer.js → IPC(preload.js) → main.js → HTTP → server/index.js
                                                                    ↓
                                                             analyzeUserIntent()
                                                                    ↓
                                                        {greeting|search|chat}
                                                                    ↓
                                         searchService → Notion API + Gemini AI
                                                                    ↓
                                                              格式化回應
```

## 🎯 核心功能系統

### 智慧意圖分析 (server/index.js:197)
- **支援類型**: greeting、search、chat
- **AI 驅動**: 使用 Gemini 分析用戶意圖與關鍵詞
- **配置位置**: config/intentAnalysis.js

### 多輪搜尋引擎 (services/searchService.js)
- **搜尋模式**: 1-3 輪可調節搜尋深度
- **策略**: 基本搜尋 → 關鍵詞優化 → 擴展搜尋
- **限制**: 僅支援 Notion 標題搜尋，不支援內容全文搜尋

### Notion API 整合 (services/notionService.js)
- **功能**: 頁面搜尋、內容提取、遞歸處理
- **限制**: 速率限制 350ms、最多 10 個結果、深度限制 3 層
- **權限**: 需要正確的 Integration 設定

### Gemini AI 管理 (services/geminiService.js)
- **多 Key 輪替**: 自動切換 API Key 避免配額限制
- **模型**: gemini-1.5-flash
- **錯誤處理**: 智慧降級與重試機制

## ⚙️ 開發環境與配置

### 環境變數 (.env)
```bash
# 必要設定
NOTION_TOKEN=ntn_your_token        # 支援 ntn_ 前綴 (已修正 validator.js)
GEMINI_API_KEY=AIzaSy_your_key     # 主要 API Key
GEMINI_API_KEY_2=...               # 備用 Key (可選)
GEMINI_API_KEY_3=...               # 備用 Key (可選)

# 可選設定
PORT=3002                          # 固定埠號，hardcoded 在 main.js
HOST=localhost
```

### 開發指令
```bash
npm run dev     # 推薦：同時啟動後端和前端
npm run server  # 僅後端 API 伺服器
npm start       # 僅 Electron 應用
npm run build   # 建置桌面應用
```

### 程序管理
```bash
# 正常關閉
Ctrl+C

# 強制終止 (如果佔用 3002 埠)
netstat -ano | findstr :3002
powershell "Stop-Process -Id [PID] -Force"
```

## 🔌 API 架構

### 核心端點
- `POST /chat` - 主要聊天介面，支援 maxRounds 參數
- `GET /test-notion` - Notion API 連線測試
- `GET /health` - 伺服器健康檢查
- `GET /api-status` - API Keys 狀態監控

### 請求格式
```javascript
// 標準聊天請求
{
  "message": "找一下 JavaScript 相關的筆記",
  "maxRounds": 2  // 搜尋輪數 (1-3)
}
```

## ⚠️ 重要限制與注意事項

### Notion API 限制
- **搜尋範圍**: 僅標題搜尋，無內容全文搜尋
- **速率限制**: 350ms 間隔，避免 429 錯誤
- **結果限制**: 每次最多 10 個頁面
- **權限要求**: Integration 需正確分享至目標頁面

### 技術架構限制
- **本地部署**: 需同時運行 Express 伺服器 (3002 埠)
- **單用戶設計**: 無會話管理，無歷史記錄保存
- **同步處理**: 無並行請求支援
- **桌面限制**: Electron 應用，非 Web 版本

### 環境依賴
- **Node.js**: >= 16.0.0
- **網路連線**: 依賴外部 API (Notion + Gemini)
- **API 配額**: Gemini AI 有每日限制

## 🛠 常見開發任務

### 新增 API 端點
在 `server/index.js` 中新增路由，使用 `asyncHandler` 包裝

### 修改搜尋邏輯
編輯 `services/searchService.js`，調整 `performDynamicSearch` 函式

### 調整意圖分析
修改 `config/intentAnalysis.js` 關鍵詞或 `server/index.js` 中的 `analyzeUserIntent`

### 更新 UI 介面
編輯 `src/renderer/` 下的 HTML/CSS/JS 檔案

### 新增配置選項
在 `config/` 目錄建立模組，並在 `config/index.js` 中匯出

## 🔍 除錯與故障排除

### 常見問題
1. **GPU 程序錯誤**: Electron GPU 相關警告，通常無害，可忽略
2. **埠號佔用**: 使用程序管理指令強制終止
3. **API Token 無效**: 檢查 .env 檔案中的 token 格式與權限
4. **搜尋無結果**: 確認 Notion Integration 已正確分享至目標頁面

### 日誌檢查
- 後端日誌：在 `npm run dev` 的終端中查看
- 前端日誌：開啟 DevTools (開發模式自動開啟)

### 配置驗證
啟動時會自動驗證環境變數，失敗會顯示具體錯誤信息

## 🚀 部署準備

### 檢查清單
- [ ] Node.js >= 16.0.0
- [ ] 埠號 3002 可用
- [ ] Notion Integration Token 有效 (ntn_ 前綴)
- [ ] Gemini API Key 有效 (AIzaSy 前綴)
- [ ] 網路連線穩定
- [ ] Notion 工作區權限正確

### 建置輸出
`npm run build` 會在 `dist/` 目錄產生桌面應用安裝檔

---

**最後更新**: 2025-09-12
**版本**: 1.0.0
**狀態**: 穩定版本，核心功能完整