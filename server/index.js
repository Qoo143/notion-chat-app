// 外部依賴模組
const express = require('express');             // Web 應用框架
const cors = require('cors');                   // 跨域資源共享中間件
const path = require('path');                   // 路徑處理工具
require('dotenv').config();                     // 環境變數載入

// 內部模組引入
const config = require('../config');            // 統一配置管理
const logger = require('../utils/logger');      // 日誌工具
const { registerRoutes } = require('../routes'); // 路由註冊

// 核心服務模組 (移至路由模組中)
// const geminiService = require('../services/geminiService');
// const notionService = require('../services/notionService');
// const searchService = require('../services/searchService');

// 中間件模組
const { 
  errorHandler,              // 全域錯誤
  notFoundHandler,           // 404 錯誤
  asyncHandler,              // 非同步錯誤
  setupProcessErrorHandling  // 程序級錯誤
} = require('../middleware/errorHandler');       // 錯誤處理中間件

const app = express();
const PORT = config.server.port;

// 設定程序級錯誤處理
setupProcessErrorHandling();

// 中介軟體
app.use(cors());
app.use(express.json({ limit: '10mb' })); // 增加請求大小限制
app.use(express.urlencoded({ limit: '10mb', extended: true })); // 也支援 URL 編碼

// 靜態檔案服務 (提供前端檔案)
app.use(express.static(path.join(__dirname, '../public')));

// ================================================================
// API 路由註冊 (加上 /api 前綴)
// ================================================================
registerRoutes(app, '/api');

// ================================================================
// SPA fallback - 所有非 API 路由都返回 index.html
// ================================================================
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});

// ================================================================
// 錯誤處理中間件 (必須放在所有路由之後)
// ================================================================
app.use(notFoundHandler);          // 404 處理
app.use(errorHandler);             // 全域錯誤處理

// ================================================================
// 啟動伺服器
// ================================================================
app.listen(PORT, () => {
  logger.info(`🚀 Notion Chat API 伺服器已啟動`);
  logger.info(`📡 監聽埠號: ${PORT}`);
  logger.info(`🌐 API 端點: ${config.server.apiBaseUrl}`);
  logger.info(`📋 Notion Token: 已設定`);
});