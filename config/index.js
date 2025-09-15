// 主配置檔 - 匯出所有配置模組
module.exports = {
  server: require('./server'),
  notion: require('./notion'),
  gemini: require('./gemini'),
  intentAnalysis: require('./intentAnalysis')
};