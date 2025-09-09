# Notion 智能聊天助手 🤖

一個基於 Electron 的智能桌面聊天應用程式，深度整合 Notion API 和 Gemini AI，透過先進的三輪搜索策略和多 API Key 輪換機制，讓您能夠高效、精準地搜尋和分析 Notion 筆記內容。

## ✨ 核心功能特色

### 🎯 智能搜索系統
- **三輪循環搜索策略**：原始關鍵詞 → AI 優化關鍵詞 → AI 擴展關鍵詞
- **AI 意圖識別**：智能判斷問候、一般對話或搜索需求
- **內容智能評估**：AI 評估搜索結果品質，自動優化搜索方向
- **關鍵詞智能限制**：每輪最多 3 個精準關鍵詞，提高搜索效率

### 🔄 高可用性設計
- **多 API Key 自動輪換**：支援最多 3 個 Gemini API Keys 無縫切換
- **配額智能管理**：自動檢測 API 限制，智能切換可用 Key
- **降級處理機制**：API 失敗時的完整容錯設計
- **透明狀態監控**：實時顯示所有 API Keys 使用狀況

### 🎨 優質用戶體驗
- **實時 API 統計**：顯示 Notion API 和 Gemini AI 調用次數及處理時間
- **豐富內容格式**：支援 Markdown、程式碼區塊、清單等格式顯示
- **響應式設計**：適配不同螢幕尺寸，優雅的聊天介面
- **便捷連結跳轉**：直接點擊開啟 Notion 頁面

### 🛡️ 穩定性保障
- **JSON 解析容錯**：自動處理 Gemini AI 回覆格式變化
- **速率限制控制**：350ms 間隔確保符合 Notion API 限制
- **全面錯誤處理**：詳細日誌記錄，確保系統穩定運行

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

# Gemini API Keys - 支援多個 API Key 自動輪換（建議設定3個）
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_API_KEY_2=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_API_KEY_3=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 伺服器端口（預設：3002）
PORT=3002
```

### 3. 取得 API 金鑰

#### Notion API Token
1. 前往 [Notion Developers](https://developers.notion.com/)
2. 建立新的 Integration
3. 複製 Internal Integration Token
4. 在您的 Notion 工作區中分享頁面給此 Integration

#### Gemini API Keys（建議設定多個）
1. 前往 [Google AI Studio](https://aistudio.google.com/)
2. 建立新的 API Key（建議建立 2-3 個不同的 Keys）
3. 複製 API Keys 到對應的環境變數

**多 API Key 優勢：**
- 自動輪換：當一個 Key 達到配額限制時，自動切換到下一個
- 擴展額度：Gemini 免費版每個 Key 每日 50 次，3 個 Key = 150 次
- 提高穩定性：單一 Key 失敗不會影響整體服務

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

## 核心功能詳解

### 🔍 三輪循環搜索策略

採用業界領先的多層搜索策略，最大化內容發現率：

#### 第一輪：原始關鍵詞搜索
- **意圖分析**：Gemini AI 解析用戶問題，提取 3 個核心關鍵詞
- **並行搜索**：3 個關鍵詞同時搜索，每個最多 10 個結果
- **智能去重**：合併結果並去除重複頁面，保留前 5 個候選
- **AI 篩選**：Gemini 從 5 個候選中選擇最相關的 3 個頁面
- **內容分析**：獲取完整頁面內容進行適用性評估

#### 第二輪：優化關鍵詞搜索 
- **關鍵詞優化**：AI 生成同義詞、相關術語和不同表達方式
- **精準搜索**：使用優化後的 3 個關鍵詞重新搜索
- **深度評估**：對新找到的內容進行更嚴格的相關性判斷

#### 第三輪：擴展關鍵詞搜索
- **範圍擴展**：使用更廣泛的類別詞和相關領域術語
- **多語言支援**：包含中英文關鍵詞和技術術語
- **概念擴展**：考慮上下位概念，確保覆蓋所有可能

### 🤖 AI 驅動的智能功能

#### 意圖識別系統
- **問候識別**：自動識別問候語，提供友善回應
- **搜索意圖**：精確判斷用戶是否需要搜索 Notion 內容
- **對話模式**：支援技術討論、一般對話等多種交互模式

#### 內容智能評估
- **相關性分析**：評估找到內容與用戶問題的匹配度
- **完整性檢查**：判斷內容是否足夠回答用戶問題
- **品質控制**：自動過濾低質量或無關內容

### 🔧 多 API Key 輪換系統

#### 智能切換機制
- **配額監控**：實時追蹤每個 API Key 的使用情況
- **自動切換**：429 錯誤自動觸發下一個可用 Key
- **狀態恢復**：定期重置 Key 狀態，應對配額重新計算

#### 透明化管理
- **使用統計**：顯示每個 Key 的日用量和錯誤次數
- **狀態監控**：實時查看當前使用的 Key 和可用狀態
- **效能優化**：智能分配請求，避免單一 Key 過載

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
  "response": "根據您的問題找到以下相關資料...\n\n📊 **API 調用統計**\n• Notion API: 4 次\n• Gemini AI: 3 次\n• 總調用次數: 7 次\n• 處理時間: 2.45 秒\n• 搜索輪數: 1 輪",
  "intent": "search",
  "searchResults": [
    {
      "id": "page-id",
      "title": "Python 入門教學", 
      "url": "https://notion.so/xxx",
      "created_time": "2024-01-01T00:00:00.000Z",
      "last_edited_time": "2024-01-02T00:00:00.000Z",
      "matchedKeyword": "Python"
    }
  ],
  "rounds": [
    {
      "round": 1,
      "keywords": ["Python", "程式", "編程"],
      "searchResults": 5,
      "selectedPages": 3,
      "suitable": true,
      "reason": "找到合適內容"
    }
  ],
  "apiStats": {
    "notionCalls": 4,
    "geminiCalls": 3, 
    "totalCalls": 7,
    "duration": 2.45
  }
}
```

### GET /health
檢查伺服器狀態和 API Keys 狀態

### GET /api-status  
檢查所有 Gemini API Keys 的使用狀況和系統狀態

**回覆格式：**
```json
{
  "success": true,
  "geminiKeys": [
    {
      "keyIndex": 1,
      "available": true,
      "dailyUsage": 23,
      "errorCount": 0,
      "isCurrent": true
    },
    {
      "keyIndex": 2, 
      "available": true,
      "dailyUsage": 15,
      "errorCount": 0,
      "isCurrent": false
    },
    {
      "keyIndex": 3,
      "available": false,
      "dailyUsage": 50,
      "errorCount": 3,
      "isCurrent": false
    }
  ],
  "totalKeys": 3,
  "currentKey": 1
}
```

### POST /analyze-page
分析特定 Notion 頁面內容

**請求格式：**
```json
{
  "pageId": "page-id",
  "question": "特定問題（可選）"
}
```

## 疑難排解

### 常見問題

1. **無法連接到伺服器**
   - 確認後端伺服器已啟動 (`npm run server`)
   - 檢查端口 3002 是否被其他程式佔用

2. **Notion API 錯誤**
   - 確認 `NOTION_TOKEN` 是否正確
   - 檢查 Integration 是否有存取工作區的權限

3. **Gemini API 錯誤**
   - 確認 `GEMINI_API_KEY`、`GEMINI_API_KEY_2`、`GEMINI_API_KEY_3` 環境變數設置
   - 訪問 `/api-status` 檢查所有 API Keys 的使用狀況
   - 配額超出時系統會自動切換到可用的 Key
   - 建議設定 3 個不同的 API Keys 以獲得最佳體驗

4. **搜尋結果為空**
   - 確認 Notion 工作區中有相關內容
   - 嘗試使用不同的關鍵字或表達方式
   - 系統會自動進行三輪搜索優化：原始詞 → 優化詞 → 擴展詞
   - 查看控制台日誌了解詳細的搜索過程

5. **JSON 解析錯誤**
   - 系統已內建 Gemini AI 回覆格式容錯機制
   - 自動清理 markdown 代碼塊標記和多餘字符
   - 如持續出現問題，請檢查網路連接穩定性

6. **API 調用次數過多**
   - 每輪搜索最多使用 3 個關鍵詞，有效控制 API 調用
   - 系統設有 350ms 請求間隔，符合 Notion API 限制
   - 使用多個 Gemini API Keys 可大幅提升可用額度

## 🏗️ 技術架構

### 核心技術棧
- **前端框架**: Electron 22+ (跨平台桌面應用)
- **後端服務**: Node.js 18+ + Express.js 4+
- **AI 整合**: Google Gemini 1.5 Flash (多 API Key 輪換)
- **資料來源**: Notion API v1 (完整內容解析)
- **程式語言**: JavaScript ES2022

### 架構設計特色
- **微服務架構**: 前後端分離，IPC 通訊
- **智能代理系統**: AI 驅動的搜索策略優化
- **高可用設計**: 多 API Key 容錯和自動切換
- **實時監控**: 完整的 API 調用統計和狀態追蹤

### 效能指標
- **搜索響應時間**: 1.5-4 秒（視內容複雜度）
- **API 調用效率**: 每次查詢 4-12 次 API 調用
- **記憶體佔用**: 約 150-200MB（Electron 應用）
- **並發處理**: 支援多用戶同時使用

## 🔮 未來發展規劃

### 即將推出功能
- **本地快取系統**: 減少重複 API 調用，提升響應速度
- **搜索歷史記錄**: 智能推薦相關查詢
- **多工作區支援**: 同時管理多個 Notion 工作區
- **進階過濾器**: 按日期、作者、標籤等條件篩選

### 技術優化方向
- **向量化搜索**: 整合語義搜索技術
- **離線模式**: 本地 AI 模型支援基本功能
- **API 效能優化**: 智能批量處理和請求合併
- **多語言支援**: 英文、日文等國際化擴展

## 👥 開發者資訊

### 專案特色
- **完整開源**: MIT 授權，歡迎貢獻代碼
- **現代化架構**: 採用最新的 Web 技術標準
- **生產就緒**: 完整的錯誤處理和日誌系統
- **可擴展設計**: 模組化架構便於功能擴展

### 貢獻指南
- 提交 Issue 報告 Bug 或建議新功能
- Fork 專案後提交 Pull Request
- 遵循現有的程式碼風格和註解規範
- 確保新功能有適當的測試覆蓋

## 📄 授權

MIT License - 詳見 LICENSE 文件

---

**🚀 讓 Notion 筆記搜索變得更智能、更高效！**