# Notion 聊天助手

一個基於 Electron 的桌面聊天應用程式，整合 Notion API 和 Gemini AI，讓您可以透過自然語言搜尋 Notion 筆記。

## 功能特色

- 🔍 **智能搜尋**：使用自然語言搜尋 Notion 中的頁面和資料庫
- 🤖 **AI 回覆**：透過 Gemini AI 生成友善的自然語言回覆
- 💬 **直覺介面**：簡潔的聊天介面，支援即時對話
- 🔗 **便捷連結**：直接點擊連結開啟 Notion 頁面
- 📱 **響應式設計**：適配不同螢幕尺寸

## 安裝與設置

### 1. 下載依賴套件

```bash
cd notion-chat-app
npm install
```

### 2. 環境變數設定

複製 `.env.example` 為 `.env` 並填入您的 API 金鑰：

```bash
cp .env.example .env
```

編輯 `.env` 檔案：

```env
# Notion API Token
NOTION_TOKEN=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Gemini API Key  
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 伺服器端口（預設：3000）
PORT=3000
```

### 3. 取得 API 金鑰

#### Notion API Token
1. 前往 [Notion Developers](https://developers.notion.com/)
2. 建立新的 Integration
3. 複製 Internal Integration Token
4. 在您的 Notion 工作區中分享頁面給此 Integration

#### Gemini API Key
1. 前往 [Google AI Studio](https://aistudio.google.com/)
2. 建立新的 API Key
3. 複製 API Key

## 使用方法

### 開發模式

```bash
# 同時啟動伺服器和桌面應用
npm run dev
```

### 分別啟動

```bash
# 啟動後端 API 伺服器
npm run server

# 在另一個終端啟動 Electron 應用
npm start
```

### 建置應用程式

```bash
npm run build
```

## 專案結構

```
notion-chat-app/
├── server/
│   └── index.js           # Express API 伺服器
├── src/
│   ├── main.js           # Electron 主程序
│   └── renderer/
│       ├── index.html    # 使用者介面
│       ├── styles.css    # 樣式表
│       └── renderer.js   # 前端邏輯
├── package.json
├── .env.example          # 環境變數範本
└── README.md
```

## API 端點

### POST /chat
接收聊天訊息並回傳搜尋結果

**請求格式：**
```json
{
  "message": "搜尋 Python 相關的筆記"
}
```

**回覆格式：**
```json
{
  "success": true,
  "response": "找到 2 筆相關筆記：\n1. Python 入門教學 (https://notion.so/xxx)\n2. Python 資料處理技巧 (https://notion.so/yyy)",
  "notionResults": [
    {
      "id": "page-id",
      "title": "Python 入門教學",
      "url": "https://notion.so/xxx",
      "created_time": "2024-01-01T00:00:00.000Z",
      "last_edited_time": "2024-01-02T00:00:00.000Z"
    }
  ]
}
```

### GET /health
檢查伺服器狀態

## 疑難排解

### 常見問題

1. **無法連接到伺服器**
   - 確認後端伺服器已啟動 (`npm run server`)
   - 檢查端口 3000 是否被其他程式佔用

2. **Notion API 錯誤**
   - 確認 `NOTION_TOKEN` 是否正確
   - 檢查 Integration 是否有存取工作區的權限

3. **Gemini API 錯誤**
   - 確認 `GEMINI_API_KEY` 是否正確
   - 檢查 API 配額是否足夠

4. **搜尋結果為空**
   - 確認 Notion 工作區中有相關內容
   - 嘗試使用不同的關鍵字

## 技術架構

- **前端**: Electron + HTML + CSS + JavaScript
- **後端**: Node.js + Express
- **API 整合**: 
  - Notion API (@notionhq/client)
  - Gemini AI (@google/generative-ai)

## 開發者資訊

此專案使用現代 Web 技術構建，支援跨平台桌面應用程式開發。

## 授權

MIT License