# Notion Chat App API 文檔

## 概述

這是一個整合 Notion API 和 Google Gemini AI 的桌面聊天應用程式後端 API。用戶可以透過自然語言搜尋他們的 Notion 工作區，並獲得 AI 驅動的回應。

**基礎 URL**: `http://localhost:3002`

---

## 核心端點

### 1. 聊天 API

**端點**: `POST /chat`

主要的聊天介面，支援多輪搜索策略和意圖分析。

#### 請求格式
```json
{
  "message": "用戶訊息內容",
  "maxRounds": 1  // 可選，搜索輪數 (1-3)，預設為 1
}
```

#### 回應格式
```json
{
  "success": true,
  "response": "AI 整合後的回覆內容",
  "foundPages": [
    {
      "pageId": "notion-page-id",
      "title": "頁面標題",
      "url": "https://www.notion.so/...",
      "content": "頁面內容"
    }
  ],
  "rounds": [
    {
      "round": 1,
      "keywords": ["關鍵詞1", "關鍵詞2"],
      "searchResults": [...],
      "selectedPages": [...],
      "pages": [...],
      "suitable": true,
      "response": "該輪回覆",
      "reason": "找到合適內容"
    }
  ],
  "maxRounds": 1,
  "actualRounds": 1,
  "intent": "search|greeting|chat",
  "apiStats": {
    "notionCalls": 5,
    "geminiCalls": 3,
    "totalCalls": 8,
    "duration": "2.45"
  }
}
```

#### 意圖類型
- **search**: 搜索 Notion 內容（含「找」、「搜尋」、「查」等關鍵詞）
- **greeting**: 問候訊息（「你好」、「嗨」等）
- **chat**: 一般對話

#### 搜索模式
- **1輪**: 快速搜索，使用原始關鍵詞
- **2輪**: 平衡模式，第二輪優化關鍵詞
- **3輪**: 精確模式，第三輪擴展關鍵詞範圍

---

### 2. 頁面分析 API

**端點**: `POST /analyze-page`

分析特定 Notion 頁面內容，可選擇性提出問題。

#### 請求格式
```json
{
  "pageId": "notion-page-id",
  "question": "關於此頁面的問題"  // 可選
}
```

#### 回應格式
```json
{
  "success": true,
  "response": "AI 分析結果或問題回答",
  "contentLength": 1250,
  "title": "頁面標題",
  "url": "https://www.notion.so/..."
}
```

---

### 3. Notion API 測試

**端點**: `GET /test-notion`

測試與 Notion API 的連線狀態。

#### 回應格式
```json
{
  "success": true,
  "message": "Notion API 連線成功",
  "results_count": 3,
  "pages": [
    {
      "id": "page-id",
      "title": "頁面標題",
      "url": "https://www.notion.so/..."
    }
  ]
}
```

---

### 4. 健康檢查

**端點**: `GET /health`

檢查伺服器和服務狀態。

#### 回應格式
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "env": {
    "notion_token": "Set",
    "gemini_keys": 3
  },
  "geminiStatus": [
    {
      "keyIndex": 1,
      "available": true,
      "dailyUsage": 12,
      "errorCount": 0,
      "isCurrent": true
    }
  ]
}
```

---

### 5. API Keys 狀態

**端點**: `GET /api-status`

檢查 Gemini API Keys 的詳細狀態。

#### 回應格式
```json
{
  "success": true,
  "geminiKeys": [...],
  "totalKeys": 3,
  "currentKey": 1
}
```

---

## 錯誤處理

所有 API 端點都採用統一的錯誤格式：

### 錯誤回應格式
```json
{
  "success": false,
  "error": "人類可讀的錯誤訊息",
  "details": "技術錯誤詳情",  // 僅開發環境
  "stack": "錯誤堆疊",        // 僅開發環境
  "apiStats": {              // 若適用
    "notionCalls": 2,
    "geminiCalls": 1,
    "totalCalls": 3,
    "duration": "1.23"
  }
}
```

### 常見錯誤碼

| 狀態碼 | 錯誤類型 | 描述 |
|--------|----------|------|
| 400 | 請求格式錯誤 | 缺少必要參數或格式不正確 |
| 404 | 資源不存在 | 請求的端點不存在 |
| 500 | 伺服器內部錯誤 | 服務器處理時發生錯誤 |
| 502 | 外部服務錯誤 | Notion API 或 Gemini AI 服務錯誤 |
| 503 | 服務不可用 | 外部服務連線失敗 |

---

## 搜索演算法

### 動態輪次搜索策略

1. **第一輪**: 使用意圖分析產生的原始關鍵詞
2. **第二輪** (如果啟用): 使用 Gemini 優化關鍵詞
3. **第三輪** (如果啟用): 使用 Gemini 擴展關鍵詞範圍

### Notion API 限制

⚠️ **重要**: Notion API 只搜尋頁面標題，不搜尋內容
- 關鍵詞必須可能出現在標題中
- 優先選擇名詞、技術術語、專案名稱
- 考慮中英文混用的情況

### 內容評估標準

Gemini AI 會評估找到的內容是否適合回答用戶問題：
- 內容與關鍵詞/主題相關 ✅
- 能提供技術資訊或知識 ✅
- 有參考價值即可 ✅
- 完全不相關 ❌

---

## 配置需求

### 環境變數

```bash
# Notion API
NOTION_TOKEN=secret_xxx...

# Gemini AI (支援多個 API Keys 輪替)
GEMINI_API_KEY=AIzaSy...
GEMINI_API_KEY_2=AIzaSy...  # 可選
GEMINI_API_KEY_3=AIzaSy...  # 可選

# 伺服器配置
PORT=3002
NODE_ENV=development

# API Base URL (可選，動態生成)
API_BASE_URL=http://localhost:3002
```

### Notion Integration 設定

需要在 Notion 中創建 Integration 並分享相關頁面：

1. 前往 [Notion Developers](https://www.notion.so/my-integrations)
2. 創建新的 Integration
3. 複製 Internal Integration Token
4. 在需要搜尋的 Notion 頁面中點擊「Share」→「Invite」→ 選擇你的 Integration

---

## 使用範例

### 搜索 React 相關筆記
```javascript
fetch('http://localhost:3002/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: '找 React 相關的筆記',
    maxRounds: 2
  })
})
.then(response => response.json())
.then(data => console.log(data));
```

### 分析特定頁面
```javascript
fetch('http://localhost:3002/analyze-page', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pageId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    question: '這篇筆記的主要重點是什麼？'
  })
})
.then(response => response.json())
.then(data => console.log(data));
```

---

## 效能考量

### API 調用限制
- **Notion API**: 每秒 3 次請求
- **Gemini AI**: 支援多 Key 輪替，自動處理配額限制

### 快取策略
- 目前無快取機制，每次請求都會重新搜索
- 建議未來可考慮對搜索結果進行短期快取

### 超時設定
- HTTP 請求: 預設 2 分鐘超時
- Notion API: 內建速率限制延遲
- Gemini AI: 自動重試機制

---

*最後更新: 2025-01-11*