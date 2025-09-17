// Gemini AI 配置
module.exports = {
  // 模型設定
  model: "gemini-2.5-flash",
  
  // API Key 管理
  apiKeys: {
    rotationEnabled: true,
    maxRetries: 3
  },
  
  // 搜尋策略設定
  search: {
    rounds: 3,              // 三輪搜尋策略
    maxKeywords: 5,         // 每輪最大關鍵詞數量
    keywordLimits: {
      initial: 5,
      optimize: 5,
      expand: 5
    }
  }
};

//  Geminitoken消耗預估
//  1. 選擇階段：100-200 個標題 ≈ 2-3K tokens
//  2. 評估階段：5 頁面 × 8000 字元 ≈ 15-20K tokens
//  3. 最終回覆：同樣的 15-20K tokens