// 外部依賴模組
const express = require('express');             // Web 應用框架
const cors = require('cors');                   // 跨域資源共享中間件
require('dotenv').config();                     // 環境變數載入

// 內部模組引入
const config = require('../config');            // 統一配置管理
const logger = require('../utils/logger');      // 日誌工具

// 核心服務模組
const geminiService = require('../services/geminiService');    // Google Gemini AI 服務
const notionService = require('../services/notionService');    // Notion API 整合服務
const searchService = require('../services/searchService');    // 多輪搜尋引擎

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
app.use(express.json());

// API 調用計數器
class APICounter {
  constructor() {
    this.notionCalls = 0;
    this.geminiCalls = 0;
    this.startTime = Date.now();
  }

  incrementNotion() {
    this.notionCalls++;
  }

  incrementGemini() {
    this.geminiCalls++;
  }

  getStats() {
    return {
      notionCalls: this.notionCalls,
      geminiCalls: this.geminiCalls,
      totalCalls: this.notionCalls + this.geminiCalls,
      duration: ((Date.now() - this.startTime) / 1000).toFixed(2)
    };
  }
}

// 聊天主端點
app.post('/chat', asyncHandler(async (req, res) => {
  const apiCounter = new APICounter();
  
  try {
    const { message, maxRounds = 1 } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: '訊息內容不能為空' });
    }

    logger.info(`接收到用戶訊息: ${message}（搜索模式: ${maxRounds}輪）`);

    // 1. 意圖分析
    const intent = await analyzeUserIntent(message, apiCounter);
    logger.debug(`用戶意圖: ${intent.intentType}`);

    // 2. 根據意圖處理
    let response = '';

    if (intent.intentType === 'greeting') {
      response = await handleGreeting(message, apiCounter);
      res.json({
        success: true,
        response: response,
        intent: intent.intentType,
        apiStats: apiCounter.getStats()
      });
    } else if (intent.intentType === 'search') {
      const searchResult = await searchService.performDynamicSearch(message, intent.keywords, maxRounds, apiCounter);
      
      res.json({
        success: searchResult.success,
        response: searchResult.response,
        foundPages: searchResult.foundPages || [],
        rounds: searchResult.rounds || [],
        maxRounds: maxRounds,
        actualRounds: searchResult.rounds?.length || 0,
        intent: intent.intentType,
        apiStats: apiCounter.getStats()
      });
    } else {
      // 一般對話
      response = await handleGeneralChat(message, apiCounter);
      res.json({
        success: true,
        response: response,
        intent: intent.intentType,
        apiStats: apiCounter.getStats()
      });
    }

  } catch (error) {
    // 附加 API 統計到錯誤中，讓錯誤處理中間件能夠存取
    error.apiStats = apiCounter.getStats();
    throw error;
  }
}));


// 測試 Notion API 連線
app.get('/test-notion', asyncHandler(async (req, res) => {
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

// 健康檢查端點
app.get('/health', (req, res) => {
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

// API Keys 狀態檢查端點
app.get('/api-status', (req, res) => {
  res.json({
    success: true,
    geminiKeys: geminiService.getStatus(),
    totalKeys: geminiService.apiKeys.length,
    currentKey: geminiService.currentKeyIndex + 1
  });
});

// 意圖分析函數
async function analyzeUserIntent(message, apiCounter) {
  try {
    const intentPrompt = `
    分析以下用戶訊息的意圖：「${message}」

    請以JSON格式回覆:
    {
      "intentType": "greeting|search|chat",
      "keywords": ["關鍵詞1", "關鍵詞2", "關鍵詞3"],
      "confidence": 0.8
    }

    意圖分類：
    1. greeting: 純粹打招呼（你好、嗨、早安等）
    2. search: 想要搜尋/查找/找到特定資料（包含「找」、「搜尋」、「查」、「有沒有」等）
    3. chat: 一般對話或問答

    如果是search意圖，請提供3個最適合的關鍵詞用於Notion頁面標題搜索。

    ⚠️ **重要:Notion API 搜尋限制**
    - 只搜尋頁面標題，不搜尋內容
    - 關鍵詞必須可能出現在標題中
    - 優先選擇名詞、技術術語、專案名稱

    只回覆JSON，不要其他文字。
    `;

    const result = await geminiService.generateContent(intentPrompt);
    apiCounter.incrementGemini();
    const response = await result.response;

    const intentData = parseGeminiJSON(response.text(), { 
      intentType: 'chat', 
      keywords: [], 
      confidence: 0.5 
    });

    logger.debug(`意圖分析結果: ${intentData.intentType} (信心度: ${intentData.confidence})`);
    return intentData;

  } catch (error) {
    logger.error('Gemini意圖分析錯誤:', error.message);
    return { intentType: 'chat', keywords: [], confidence: 0.0 };
  }
}

// 處理問候
async function handleGreeting(message, apiCounter) {
  try {
    const greetingPrompt = `用戶說：「${message}」
    
    請以友善、簡潔的方式用繁體中文回應這個問候，
    並簡單介紹你可以幫助搜尋他們的 Notion 筆記。回覆限制在50字以內。`;

    const result = await geminiService.generateContent(greetingPrompt);
    apiCounter.incrementGemini();
    const response = await result.response;
    return response.text();

  } catch (error) {
    logger.error('問候回應錯誤:', error.message);
    return config.ui.messages.errors.aiProcessingError;
  }
}

// 處理一般對話
async function handleGeneralChat(message, apiCounter) {
  try {
    const chatPrompt = `用戶說：「${message}」

    請以友善、有幫助的方式用繁體中文回覆。
    你是一個智能助手，可以回答各種問題、提供建議或進行對話。
    如果用戶之後想要搜尋 Notion 筆記，你也可以協助他們。`;

    const result = await geminiService.generateContent(chatPrompt);
    apiCounter.incrementGemini();
    const response = await result.response;
    return response.text();

  } catch (error) {
    logger.error('一般對話錯誤:', error.message);
    return config.ui.messages.errors.aiProcessingError;
  }
}

// 解析 Gemini JSON 回覆
function parseGeminiJSON(text, fallback = null) {
  try {
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    logger.error('JSON解析錯誤:', error.message);
    return fallback;
  }
}

// 404 處理
app.use(notFoundHandler);

// 全域錯誤處理 (必須放在所有路由之後)
app.use(errorHandler);

// 啟動伺服器
app.listen(PORT, () => {
  logger.info(`Notion Chat API 伺服器已啟動`);
  logger.info(`監聽埠號: ${PORT}`);
  logger.info(`API 端點: http://localhost:${PORT}`);
  
  // 啟動時檢查服務狀態
  logger.info(`Gemini API Keys: ${geminiService.apiKeys.length} 個`);
  logger.info(`Notion Token: ${process.env.NOTION_TOKEN ? '已設定' : '未設定'}`);
});