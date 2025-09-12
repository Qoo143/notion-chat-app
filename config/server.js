// 伺服器配置
const validator = require('./validator');

// 獲取驗證後的配置
const config = validator.validate();

module.exports = {
  // API 伺服器設定
  port: config.port,
  host: config.host,
  apiBaseUrl: config.apiBaseUrl,
  
  // 跨域設定
  cors: {
    enabled: true,
    origin: config.corsOrigin
  }
};