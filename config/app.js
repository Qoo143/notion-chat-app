const path = require('path');

// 應用程式配置
module.exports = {
  // Electron 主視窗設定
  window: {
    width: 800,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'src', 'preload.js')
    }
  },
  
  // 開發模式設定
  development: {
    openDevTools: true
  }
};