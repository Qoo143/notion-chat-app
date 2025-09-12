const logger = require('../utils/logger');
const config = require('../config');

/**
 * 全域錯誤處理中間件
 */
function errorHandler(err, req, res, next) {
  logger.error('全域錯誤處理:', err.message);
  
  // 記錄完整錯誤堆疊（僅開發環境）
  if (process.env.NODE_ENV === 'development') {
    logger.debug('錯誤堆疊:', err.stack);
  }

  // 根據錯誤類型設定狀態碼
  let statusCode = 500;
  let errorMessage = '伺服器內部錯誤';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorMessage = '請求資料格式錯誤';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorMessage = '未授權存取';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    errorMessage = '資源不存在';
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    errorMessage = '外部服務連線失敗';
  } else if (err.message.includes('Notion')) {
    statusCode = 502;
    errorMessage = 'Notion API 服務錯誤';
  } else if (err.message.includes('Gemini')) {
    statusCode = 502;
    errorMessage = 'Gemini AI 服務錯誤';
  }

  // 回傳錯誤回應
  res.status(statusCode).json({
    success: false,
    error: errorMessage,
    ...(process.env.NODE_ENV === 'development' && {
      details: err.message,
      stack: err.stack
    })
  });
}

/**
 * 404 錯誤處理中間件
 */
function notFoundHandler(req, res) {
  logger.warn(`404 錯誤 - 路徑不存在: ${req.method} ${req.path}`);
  
  res.status(404).json({
    success: false,
    error: '請求的端點不存在',
    path: req.path,
    method: req.method
  });
}

/**
 * 非同步錯誤包裝器
 * 自動捕獲 async 函數中的錯誤並傳遞給錯誤處理中間件
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 程序級錯誤處理
 */
function setupProcessErrorHandling() {
  // 捕獲未處理的 Promise 拒絕
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('未處理的 Promise 拒絕:', reason);
    logger.debug('Promise:', promise);
  });

  // 捕獲未捕獲的例外
  process.on('uncaughtException', (error) => {
    logger.error('未捕獲的例外:', error.message);
    logger.debug('堆疊:', error.stack);
    
    // 優雅關閉
    process.exit(1);
  });

  // 處理程序終止信號
  process.on('SIGTERM', () => {
    logger.info('收到 SIGTERM 信號，準備關閉伺服器...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('收到 SIGINT 信號，準備關閉伺服器...');
    process.exit(0);
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  setupProcessErrorHandling
};