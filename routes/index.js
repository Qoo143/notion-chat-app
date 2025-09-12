/**
 * 路由總匯出模組
 * 統一管理和註冊所有路由到 Express 應用
 */

const chatRoutes = require('./chat');      // 聊天相關路由
const systemRoutes = require('./system');  // 系統狀態路由

/**
 * 註冊所有路由到 Express 應用
 * @param {Express} app - Express 應用實例
 */
function registerRoutes(app) {
  // 註冊路由模組
  app.use('/chat', chatRoutes);    // POST /chat
  app.use('/', systemRoutes);      // GET /health, /api-status, /test-notion
  
  // 可以在這裡添加更多路由模組
  // app.use('/api', apiRoutes);
  // app.use('/admin', adminRoutes);
}

module.exports = {
  registerRoutes,
  
  // 也可以單獨匯出各個路由模組
  chatRoutes,
  systemRoutes
};