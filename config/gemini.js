// Gemini AI 配置
module.exports = {
  // 模型設定
  model: "gemini-1.5-flash",
  
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