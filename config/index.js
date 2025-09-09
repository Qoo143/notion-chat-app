// 主配置檔 - 匯出所有配置模組
module.exports = {
  app: require('./app'),
  server: require('./server'),
  notion: require('./notion'),
  gemini: require('./gemini'),
  ui: require('./ui'),
  intentAnalysis: require('./intentAnalysis'),
  logging: require('./logging'),
  performance: require('./performance')
};