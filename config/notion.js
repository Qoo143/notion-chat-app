// Notion API 配置
module.exports = {
  // 搜尋設定
  search: {
    pageSize: 100,          // 每個關鍵詞的搜尋結果數 (Notion API 最大限制)
    maxSelectedPages: 5     // AI 選擇進入遞歸內容讀取的頁面數量
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