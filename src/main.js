const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');
const config = require('../config');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: config.app.window.width,
    height: config.app.window.height,
    webPreferences: config.app.window.webPreferences,
    icon: path.join(__dirname, 'assets', 'icon.png') // 可選
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 開發模式下開啟開發者工具
  if (process.env.NODE_ENV === 'development' && config.app.development.openDevTools) {
    mainWindow.webContents.openDevTools();
  }
}

// 處理聊天請求
ipcMain.handle('send-message', async (event, message) => {
  try {
    const response = await axios.post(`${config.server.apiBaseUrl}/chat`, {
      message: message
    });
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('發送訊息錯誤:', error);
    return {
      success: false,
      error: error.response?.data?.error || '無法連接到伺服器'
    };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});