const { contextBridge, ipcRenderer } = require('electron');

// 透過 context bridge 安全地暴露 API 給渲染程序
contextBridge.exposeInMainWorld('electronAPI', {
  // 發送聊天訊息
  sendMessage: (messageData) => ipcRenderer.invoke('send-message', messageData),
  
  // 獲取配置
  getConfig: () => ipcRenderer.invoke('get-config')
});

// 安全檢查：確保沒有直接暴露 Node.js API
console.log('Preload script loaded - Context isolation enabled');