const express = require('express');
const router = express.Router();

// 引入依賴模組
const logger = require('../utils/logger');
const APICounter = require('../utils/APICounter');
const notionService = require('../services/notionService');
const geminiService = require('../services/geminiService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 健康檢查端點
 * GET /system/health
 * 返回伺服器狀態和環境資訊
 */
router.get('/system/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    env: {
      notion_token: process.env.NOTION_TOKEN ? 'Set' : 'Missing',
      gemini_keys: geminiService.apiKeys.length
    },
    geminiStatus: geminiService.getStatus()
  });
});

/**
 * API Keys 狀態檢查端點
 * GET /system/status
 * 返回 Gemini API Keys 的詳細狀態
 */
router.get('/system/status', (req, res) => {
  res.json({
    success: true,
    geminiKeys: geminiService.getStatus(),
    totalKeys: geminiService.apiKeys.length,
    currentKey: geminiService.currentKeyIndex + 1
  });
});

/**
 * 測試 Notion API 連線
 * GET /system/test
 * 執行基本搜尋測試 Notion API 連線狀態
 */
router.get('/system/test', asyncHandler(async (req, res) => {
  try {
    logger.info('測試 Notion API 連線...');
    
    const apiCounter = new APICounter();
    const testResults = await notionService.performBasicSearch(['test'], apiCounter);

    res.json({
      success: true,
      message: 'Notion API 連線成功',
      results_count: testResults.length,
      pages: testResults.slice(0, 5).map(page => ({
        id: page.pageId,
        title: page.title,
        url: page.url
      }))
    });

  } catch (error) {
    throw error;
  }
}));

module.exports = router;