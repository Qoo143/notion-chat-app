// 伺服器配置
module.exports = {
  // API 伺服器設定
  port: process.env.PORT || 3002,
  apiBaseUrl: 'http://localhost:3002',
  
  // 跨域設定
  cors: {
    enabled: true
  }
};