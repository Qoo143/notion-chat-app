const express = require('express');
const router = express.Router();

// 引入依賴模組
const logger = require('../utils/logger');
const APICounter = require('../utils/APICounter');
const searchService = require('../services/searchService');
const geminiService = require('../services/geminiService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 聊天主端點
 * POST /chat
 * 處理用戶訊息，包含意圖分析和搜尋功能
 */
router.post('/', asyncHandler(async (req, res) => {
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

// ================================================================
// 輔助函式 (將來可能移到獨立模組)
// ================================================================

/**
 * 意圖分析函數
 */
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
    - 只搜尋頁面標題，不搜尋內容（部分匹配，最多100結果）
    - 關鍵詞必須簡短、核心，避免複合詞或長句
    - 優先順序：英文技術術語 > 繁體中文核心詞 > 專案名稱
    
    📋 **關鍵詞生成原則**：
    - 使用1-2個字的核心概念（如：繼承 → "Inheritance", "繼承"）
    - 技術主題優先用英文術語（JavaScript → "JavaScript", "JS"）
    - 避免複合描述詞（不要："原型繼承模式"，要："Prototype", "繼承"）
    
    💡 **範例**：
    - 用戶問"javascript繼承" → ["JavaScript", "Inheritance", "繼承"]
    - 用戶問"react hooks用法" → ["React", "Hooks", "Hook"]
    - 用戶問"資料庫設計" → ["Database", "資料庫", "設計"]

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

/**
 * 處理問候
 */
async function handleGreeting(message, apiCounter) {
  const greetingPrompt = `用戶說：「${message}」，這是一個問候訊息。請用繁體中文友善地回應，並簡介你是 Notion 工作區的搜尋助手。回應要簡潔親切，約50字內。`;
  
  try {
    const result = await geminiService.generateContent(greetingPrompt);
    apiCounter.incrementGemini();
    const response = await result.response;
    return response.text();
  } catch (error) {
    logger.error('Gemini問候處理錯誤:', error.message);
    return '您好！我是您的 Notion 搜尋助手，可以幫您找到工作區中的筆記和資料。有什麼可以幫您的嗎？';
  }
}

/**
 * 處理一般對話
 */
async function handleGeneralChat(message, apiCounter) {
  const chatPrompt = `用戶問：「${message}」。請用繁體中文回應。如果問題與 Notion 或筆記管理相關，提供實用建議；否則進行一般對話。回應要自然友善，約100字內。`;
  
  try {
    const result = await geminiService.generateContent(chatPrompt);
    apiCounter.incrementGemini();
    const response = await result.response;
    return response.text();
  } catch (error) {
    logger.error('Gemini對話處理錯誤:', error.message);
    return '抱歉，我現在無法處理您的問題。請稍後再試，或者嘗試搜尋您的 Notion 筆記。';
  }
}

/**
 * 解析 Gemini 回應的 JSON
 */
function parseGeminiJSON(text, fallback) {
  try {
    // 清理回應文字，移除可能的 markdown 標記
    let cleanText = text.trim();
    
    // 移除 ```json 和 ``` 標記
    cleanText = cleanText.replace(/```json\s*/, '').replace(/```\s*$/, '');
    
    // 嘗試解析 JSON
    const parsed = JSON.parse(cleanText);
    return parsed;
  } catch (error) {
    logger.warn('無法解析 Gemini JSON 回應:', text);
    return fallback;
  }
}

module.exports = router;