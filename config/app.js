// 應用程式配置
module.exports = {
  // Electron 主視窗設定
  window: {
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  },
  
  // 開發模式設定
  development: {
    openDevTools: true
  }
};