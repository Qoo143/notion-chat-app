# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 📚 快速記憶獲取指南

**重要**: README.md 包含完整的 AI 快速參考區塊，請優先閱讀以快速獲取專案記憶：

```bash
# 閱讀完整專案文檔和 AI 機器可讀區塊
Read README.md
# 特別注意第 337-396 行的 YAML 格式快速參考區塊
```

該區塊包含：
- 專案架構與技術堆疊
- 5關鍵字搜尋策略與 AI 篩選機制
- API 端點與環境變數
- Notion 工作區 URL 修正功能
- 意圖類型與使用限制
- 開發指令與部署資訊

## 🏗 專案架構摘要

**Notion Chat App** - AI 驅動的網頁聊天應用程式，整合 Express + Notion API + Google Gemini AI

### 🔧 核心技術栈
- **前端**: 原生 HTML/CSS/JavaScript (大地色系設計)
- **後端**: Express.js 4.18.2 (Web 伺服器)
- **AI 服務**: Google Gemini AI (@google/generative-ai)
- **API 整合**: Notion Client (@notionhq/client)
- **部署**: Render 雲端平台

### 🗂 關鍵檔案位置
```
├── server/index.js              # 主 Web 伺服器，路由與意圖分析
├── public/                      # 靜態網頁檔案
│   ├── index.html               # 主介面 (SPA)
│   ├── js/app.js                # 前端邏輯
│   ├── css/styles.css           # 編譯後樣式
│   └── scss/                    # SCSS 原始檔案
├── services/                    # 業務邏輯層
│   ├── searchService.js         # 多輪搜尋引擎 (1-3 輪)
│   ├── notionService.js         # Notion API 整合
│   └── geminiService.js         # Gemini AI 管理 + 多 Key 輪替
├── routes/                      # API 路由模組
├── config/                      # 模組化配置系統
│   ├── validator.js             # 環境變數驗證 (ntn_ 前綴支援)
│   └── intentAnalysis.js        # 意圖分析配置
└── .env                         # 環境變數 (NOTION_TOKEN, GEMINI_API_KEY)
```

## 📡 資料流向與通訊架構

```
用戶輸入 → Web 前端 → HTTP → server/index.js → /api/chat
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

### 智慧意圖分析 (routes/chat.js)
- **支援類型**: greeting、search、chat
- **AI 驅動**: 使用 Gemini 分析用戶意圖與關鍵詞
- **關鍵字生成**: 每次生成5個最適合的關鍵字

### 多輪搜尋引擎 (services/searchService.js)
- **搜尋模式**: 1-3 輪可調節搜尋深度
- **搜尋規模**: 5關鍵字 × 100結果 = 最多500個頁面
- **策略**: 原始5關鍵字 → AI優化關鍵字 → AI擴展關鍵字
- **去重機制**: 自動用 Map 結構去除重複頁面
- **AI 篩選**: Gemini 從所有結果中選5個最相關頁面

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
NOTION_TOKEN=ntn_your_token        # 支援 ntn_ 前綴
NOTION_WORKSPACE_ID=workspace-id   # 工作區 ID，用於修正 URL 格式
GEMINI_API_KEY=AIzaSy_your_key     # 主要 API Key
GEMINI_API_KEY_2=...               # 備用 Key (可選)
GEMINI_API_KEY_3=...               # 備用 Key (可選)

# 可選設定
PORT=3002                          # 固定埠號，可由 Render 自動設定
HOST=0.0.0.0                      # 部署時使用
NODE_ENV=production                # 生產環境
```

### 開發指令
```bash
npm start       # 生產模式啟動
npm run dev     # 開發模式 (同 server)
npm run server  # 啟動 Express 伺服器
npm run build:css   # 編譯 SCSS 樣式
npm run watch:css   # 監控 SCSS 變化
```

## 🔌 API 架構

### 核心端點 (加上 /api 前綴)
- `POST /api/chat` - 主要聊天介面，支援 maxRounds 參數
- `GET /api/test-notion` - Notion API 連線測試
- `GET /api/health` - 伺服器健康檢查
- `GET /api/api-status` - API Keys 狀態監控

### 請求格式
```javascript
// 標準聊天請求
{
  "message": "找一下 JavaScript 相關的筆記",
  "maxRounds": 2  // 搜尋輪數 (1-3)
}
```

### SPA 路由處理
- 所有非 `/api` 路由都返回 `public/index.html`
- 支援前端路由和直接 URL 存取

## 🌐 Render 部署

### 自動部署配置
- **Repository**: https://github.com/Qoo143/notion-chat-app.git
- **Branch**: master
- **Auto Deploy**: 是的，推送到 master 分支會觸發自動部署
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### 部署流程
1. **本地開發** → 測試功能
2. **Git 提交** → `git push origin master`
3. **自動觸發** → Render 檢測推送
4. **建置部署** → 執行 `npm install` 和 `npm start`
5. **服務上線** → 更新完成

### 環境變數 (Render Dashboard)
必須在 Render 設定：
- `NOTION_TOKEN`
- `GEMINI_API_KEY`
- `NODE_ENV=production`

## ⚠️ 重要限制與注意事項

### Notion API 限制
- **搜尋範圍**: 僅標題搜尋，無內容全文搜尋
- **單次搜尋**: 每個關鍵字最多 100 個結果 (API 固定限制)
- **總搜尋量**: 5關鍵字 × 100 = 最多 500 個頁面
- **速率限制**: 350ms 間隔，避免 429 錯誤
- **AI 篩選**: 最終選擇 5 個最相關頁面進行內容提取
- **權限要求**: Integration 需正確分享至目標頁面

### 技術架構限制
- **Web 應用**: 純網頁應用，已移除 Electron 架構
- **多用戶設計**: 支援多用戶同時使用
- **同步處理**: 無並行請求支援
- **雲端部署**: 運行於 Render 平台

### 環境依賴
- **Node.js**: >= 18.0.0
- **網路連線**: 依賴外部 API (Notion + Gemini)
- **API 配額**: Gemini AI 有每日限制
- **部署平台**: 依賴 Render 雲端服務

## 🛠 常見開發任務

### 新增 API 端點
在 `routes/` 目錄中新增路由模組，使用 `asyncHandler` 包裝

### 修改搜尋邏輯
編輯 `services/searchService.js`，調整 `performDynamicSearch` 函式

### 調整意圖分析
修改 `config/intentAnalysis.js` 關鍵詞或路由中的 `analyzeUserIntent`

### 更新 UI 介面
編輯 `public/` 下的 HTML/CSS/JS 檔案

### 樣式開發
1. 編輯 `public/scss/` 下的 SCSS 檔案
2. 使用 `npm run watch:css` 監控變化
3. 編譯後的 CSS 會輸出到 `public/css/`

### 新增配置選項
在 `config/` 目錄建立模組，並適當匯出

## 🔍 除錯與故障排除

### 常見問題
1. **部署失敗**: 檢查環境變數是否正確設定
2. **API Token 無效**: 檢查 .env 檔案中的 token 格式與權限
3. **搜尋無結果**: 確認 Notion Integration 已正確分享至目標頁面
4. **CSS 樣式問題**: 確保 SCSS 已正確編譯

### 日誌檢查
- **本地開發**: 在 `npm run dev` 的終端中查看
- **Render 部署**: 在 Render Dashboard 的 Logs 頁面查看
- **前端除錯**: 使用瀏覽器開發者工具

### 配置驗證
啟動時會自動驗證環境變數，失敗會顯示具體錯誤信息

## 🚀 部署準備

### 本地開發檢查清單
- [ ] Node.js >= 18.0.0
- [ ] 埠號 3002 可用 (可調整)
- [ ] Notion Integration Token 有效 (ntn_ 前綴)
- [ ] Gemini API Key 有效 (AIzaSy 前綴)
- [ ] 網路連線穩定
- [ ] Notion 工作區權限正確

### Render 部署檢查清單
- [ ] GitHub Repository 已連結
- [ ] 環境變數已在 Render Dashboard 設定
- [ ] Auto Deploy 已啟用
- [ ] Build 和 Start 命令正確
- [ ] 服務域名已設定

### 部署測試
1. **本地測試**: `npm start` 確保功能正常
2. **推送代碼**: `git push origin master`
3. **監控部署**: 在 Render Dashboard 查看部署狀態
4. **驗證服務**: 確認部署的網站功能正常
5. **API 測試**: 測試 `/api/health` 和 `/api/test-notion`

---

**最後更新**: 2025-09-13
**版本**: 2.0.0 (Web Application)
**狀態**: 已部署至 Render，支援自動部署更新

## 🔄 自動部署確認

**是的，你的專案支援自動部署！**

當你執行 `git push origin master` 推送更新到 GitHub 時：
1. Render 會自動檢測到 master 分支的變更
2. 觸發新的部署流程
3. 執行 `npm install` 安裝依賴
4. 執行 `npm start` 啟動服務
5. 部署完成後更新線上服務

你可以在 Render Dashboard 監控整個部署過程和狀態。