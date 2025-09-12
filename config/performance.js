// 效能配置
module.exports = {
  // 快取設定
  cache: {
    enabled: false,          // 目前未實作，預留設定
    ttl: 900000              // 15分鐘 TTL
  },
  
  // 請求限制
  limits: {
    maxConcurrentRequests: 3,
    requestTimeout: 30000    // 30秒超時
  }
};