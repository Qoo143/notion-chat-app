# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

這是一個使用 Electron 構建的桌面聊天應用程式，整合了 Notion API 和 Google Gemini AI。使用者可以透過自然語言搜尋他們的 Notion 工作區，並獲得 AI 驅動的回應以及相關頁面的直接連結。

## 技術架構

**前端**: Electron 主程序 + 渲染程序（HTML/CSS/JS）
**後端**: Express.js API 伺服器
**外部 API**: Notion API (@notionhq/client) + Google Gemini AI (@google/generative-ai)

### 核心元件

1. **src/main.js**: Electron 主程序，處理與渲染程序的 IPC 通訊
2. **src/renderer/**: 前端 UI 元件（index.html、styles.css、renderer.js）
3. **server/index.js**: Express API 伺服器，包含 Notion 搜尋、Gemini AI 整合和內容分析

### 通訊流程

```
使用者輸入 → 渲染程序 → IPC → 主程序 → HTTP 請求 → Express 伺服器 → Notion API + Gemini AI → 回應鏈
```

## 開發指令

```bash
# 安裝依賴套件
npm install

# 開發模式（同時執行伺服器和 Electron 應用）
npm run dev

# 僅啟動後端 API 伺服器（埠號 3002）
npm run server

# 僅啟動 Electron 應用（需要伺服器運行中）
npm start

# 建置桌面應用程式
npm run build
```

## 環境設定

複製 `.env.example` 為 `.env` 並配置：
- `NOTION_TOKEN`: Notion Integration 令牌（secret_...）
- `GEMINI_API_KEY`: Google AI Studio API 金鑰（AIzaSy...）
- `PORT`: API 伺服器埠號（預設：3002）

**重要**: 主程序預期 API 伺服器運行在埠號 3002（在 src/main.js:29 中硬編碼）

## API 架構

### 核心端點

- `POST /chat`: 主要聊天端點，具備意圖分析（問候/搜尋/分析）
- `POST /analyze-page`: 直接頁面內容分析，可選問題
- `GET /test-notion`: Notion API 連接測試
- `GET /health`: 伺服器健康檢查，包含環境狀態

### 意圖系統

伺服器自動分析使用者意圖：
- **greeting**: 歡迎回應
- **search**: Notion 工作區搜尋，配合 Gemini 生成的回應
- **analyze**: 對先前找到的頁面進行深度內容分析

### Notion 整合功能

- 完整遞歸頁面內容擷取，包括子頁面/區塊
- 全面支援區塊類型（標題、清單、程式碼、表格、媒體等）
- 格式化內容輸出，包含視覺分隔符號和圖示
- 權限處理和錯誤恢復

## 程式碼模式

### IPC 通訊
```javascript
// 渲染程序 → 主程序
const result = await ipcRenderer.invoke('send-message', message);

// 主程序處理器
ipcMain.handle('send-message', async (event, message) => {
    // 向 Express 伺服器發送 HTTP 請求
});
```

### 錯誤處理
- 渲染程序中的網路連接檢查
- 連接狀態的狀態指示器
- Gemini AI 失敗時的優雅降級
- 詳細錯誤記錄，包含 API 錯誤代碼

### 內容處理
- 具深度限制的遞歸區塊擷取
- 豐富文本格式保留
- URL 連結檢測和處理
- 顯示用內容清理

## 開發注意事項

- 繁體中文是 UI 和回應的主要語言
- 伺服器運行在獨立埠號（3002），不同於典型開發伺服器
- Electron 使用 `nodeIntegration: true` 來存取 IPC
- 前端無建置程序 - 直接檔案載入
- Notion API 需要正確的 Integration 設定和頁面分享

## 常見任務

### 新增新區塊類型
在 server/index.js 中擴展 `extractBlockText()` 函式，新增 Notion 區塊類型處理器。

### 修改聊天意圖邏輯
更新 `analyzeUserIntent()` 函式關鍵字，並在 switch 陳述式中新增新案例。

### 更改 API 伺服器埠號
同時更新 `.env` 檔案和 `src/main.js:29` 中的硬編碼埠號。