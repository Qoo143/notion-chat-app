/**
 * 路由總匯出模組
 * 統一管理和註冊所有路由到 Express 應用
 */

const chatRoutes = require('./chat');      // 聊天相關路由
const systemRoutes = require('./system');  // 系統狀態路由

/**
 * 註冊所有路由到 Express 應用
 * @param {Express} app - Express 應用實例
 * @param {string} prefix - API 路由前綴，預設為空字串
 */
function registerRoutes(app, prefix = '') {
  // 註冊路由模組
  app.use(`${prefix}/chat`, chatRoutes);    // POST /api/chat
  app.use(`${prefix}`, systemRoutes);       // GET /api/health, /api/api-status, /api/test-notion
  
  // 可以在這裡添加更多路由模組
  // app.use(`${prefix}/users`, userRoutes);
  // app.use(`${prefix}/admin`, adminRoutes);
}

module.exports = {
  registerRoutes,
  
  // 也可以單獨匯出各個路由模組
  chatRoutes,
  systemRoutes
};