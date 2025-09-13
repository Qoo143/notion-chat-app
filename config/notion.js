// Notion API 配置
module.exports = {
  // 搜尋設定
  search: {
    pageSize: 10,           // 每個關鍵詞的搜尋結果數
    maxResults: 5,          // 最終限制的結果數
    maxSelectedPages: 3     // AI 選擇的頁面數量上限
  },
  
  // 內容讀取設定
  content: {
    maxDepth: 3,           // 遞歸讀取最大深度
    maxPreviewLength: 8000, // 內容預覽最大長度
    rateLimitDelay: 350,   // API 請求間隔（毫秒）
    maxBlocksPerPage: 100, // 每頁最大區塊數
    maxRecursiveDepth: 3   // 遞歸處理最大深度
  }
};