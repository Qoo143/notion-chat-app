const express = require('express');
const cors = require('cors');
const { Client } = require('@notionhq/client');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
require('dotenv').config();

const app = express();
const PORT = config.server.port;

// 中介軟體
app.use(cors());
app.use(express.json());

// 初始化 API 客戶端
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

// Gemini API Key 管理系統
class GeminiAPIManager {
  constructor() {
    // 從環境變數讀取多個 API Key
    this.apiKeys = this.loadAPIKeys();
    this.currentKeyIndex = 0;
    this.keyStatus = new Map(); // 追蹤每個 key 的狀態

    // 初始化所有 key 的狀態
    this.apiKeys.forEach((key, index) => {
      this.keyStatus.set(index, {
        available: true,
        errorCount: 0,
        lastError: null,
        lastUsed: 0,
        dailyUsage: 0
      });
    });

    this.initializeCurrentModel();
  }

  loadAPIKeys() {
    const keys = [];

    // 主要的 API Key
    if (process.env.GEMINI_API_KEY) {
      keys.push(process.env.GEMINI_API_KEY);
    }

    // 備用的 API Keys
    if (process.env.GEMINI_API_KEY_2) {
      keys.push(process.env.GEMINI_API_KEY_2);
    }

    if (process.env.GEMINI_API_KEY_3) {
      keys.push(process.env.GEMINI_API_KEY_3);
    }

    console.log(`載入了 ${keys.length} 個 Gemini API Keys`);
    return keys;
  }

  initializeCurrentModel() {
    if (this.apiKeys.length === 0) {
      throw new Error('沒有可用的 Gemini API Key');
    }

    const currentKey = this.apiKeys[this.currentKeyIndex];
    this.genAI = new GoogleGenerativeAI(currentKey);
    this.model = this.genAI.getGenerativeModel({ model: config.gemini.model });

    console.log(`使用 API Key ${this.currentKeyIndex + 1}/${this.apiKeys.length}`);
  }

  async generateContent(prompt) {
    const maxRetries = this.apiKeys.length;
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await this.model.generateContent(prompt);

        // 成功時更新狀態
        const status = this.keyStatus.get(this.currentKeyIndex);
        status.lastUsed = Date.now();
        status.dailyUsage++;
        status.errorCount = 0;

        console.log(`API Key ${this.currentKeyIndex + 1} 成功調用 (今日第 ${status.dailyUsage} 次)`);
        return result;

      } catch (error) {
        lastError = error;
        console.error(`API Key ${this.currentKeyIndex + 1} 調用失敗:`, error.message);

        // 更新錯誤狀態
        const status = this.keyStatus.get(this.currentKeyIndex);
        status.errorCount++;
        status.lastError = error.message;

        // 如果是配額錯誤，標記為不可用
        if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('exceeded')) {
          status.available = false;
          console.log(`API Key ${this.currentKeyIndex + 1} 配額已用完，切換到下一個`);
        }

        // 切換到下一個 API Key
        await this.switchToNextKey();

        // 如果所有 key 都試過了，跳出循環
        if (attempt === maxRetries - 1) {
          break;
        }
      }
    }

    // 所有 key 都失敗了
    throw new Error(`所有 ${this.apiKeys.length} 個 API Keys 都無法使用: ${lastError?.message || '未知錯誤'}`);
  }

  async switchToNextKey() {
    const originalIndex = this.currentKeyIndex;

    // 找到下一個可用的 key
    for (let i = 0; i < this.apiKeys.length; i++) {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      const status = this.keyStatus.get(this.currentKeyIndex);

      // 如果找到可用的 key，初始化並使用
      if (status.available) {
        this.initializeCurrentModel();
        console.log(`切換到 API Key ${this.currentKeyIndex + 1}`);
        return;
      }
    }

    // 如果所有 key 都不可用，重置所有狀態（也許配額已重置）
    console.log('所有 API Keys 都不可用，重置狀態');
    this.keyStatus.forEach(status => {
      status.available = true;
      status.errorCount = 0;
    });

    this.currentKeyIndex = originalIndex;
    this.initializeCurrentModel();
  }

  getStatus() {
    const status = [];
    this.apiKeys.forEach((key, index) => {
      const keyStatus = this.keyStatus.get(index);
      status.push({
        keyIndex: index + 1,
        available: keyStatus.available,
        dailyUsage: keyStatus.dailyUsage,
        errorCount: keyStatus.errorCount,
        isCurrent: index === this.currentKeyIndex
      });
    });
    return status;
  }
}

// 初始化 Gemini API 管理器
const geminiManager = new GeminiAPIManager();

// 存儲最近的搜尋結果（簡單的會話記憶）
let lastSearchResults = [];

// 使用 Gemini 智能分析用戶意圖和搜尋需求
async function analyzeUserIntentWithGemini(message, apiCounter) {
  try {
    const intentPrompt = `
分析以下用戶訊息，判斷用戶的意圖並決定是否需要搜尋 Notion：

用戶訊息：「${message}」

請以 JSON 格式回覆，包含：
{
  "needSearch": true/false,
  "intentType": "chat/search/greeting",
  "searchKeywords": ["關鍵詞1", "關鍵詞2", ...] (如果 needSearch 為 true)
}

判斷規則：
1. 如果是問候語（你好、hi、hello等），設定 intentType 為 "greeting"，needSearch 為 false
2. 如果用戶想查找特定資料、筆記、文件，設定 needSearch 為 true，intentType 為 "search"，並提供多個相關搜尋關鍵詞
3. 如果是一般對話、問題解答，設定 needSearch 為 false，intentType 為 "chat"

範例：
- 「你好」→ {"needSearch": false, "intentType": "greeting"}
- 「今天天氣如何」→ {"needSearch": false, "intentType": "chat"}
- 「幫我找安全相關筆記」→ {"needSearch": true, "intentType": "search", "searchKeywords": ["安全", "資安", "security"]}
- 「有沒有關於 Python 的資料」→ {"needSearch": true, "intentType": "search", "searchKeywords": ["Python", "程式", "編程"]}
- 「我要找promise的notion筆記」→ {"needSearch": true, "intentType": "search", "searchKeywords": ["Promise", "JavaScript", "異步"]}
- 「找react相關的資料」→ {"needSearch": true, "intentType": "search", "searchKeywords": ["React", "組件", "JSX"]}

重要：searchKeywords 陣列最多包含 3 個關鍵詞，選擇最核心和最相關的詞彙。

只回覆 JSON，不要其他文字。
`;

    const result = await geminiManager.generateContent(intentPrompt);
    apiCounter.incrementGemini();
    const response = await result.response;
    const responseText = response.text().trim();

    console.log('Gemini 意圖分析原始回覆:', responseText);

    // 嘗試解析 JSON
    const intentData = parseGeminiJSON(responseText);
    if (intentData) {
      // 限制搜索關鍵詞數量
      if (intentData.searchKeywords && Array.isArray(intentData.searchKeywords)) {
        if (intentData.searchKeywords.length > config.gemini.search.maxKeywords) {
          console.log(`⚠️ 意圖分析提供了${intentData.searchKeywords.length}個關鍵詞，已限制為${config.gemini.search.maxKeywords}個`);
          intentData.searchKeywords = intentData.searchKeywords.slice(0, config.gemini.search.maxKeywords);
        }
      }

      console.log('解析後的意圖資料:', intentData);
      return intentData;
    } else {
      console.log('JSON 解析失敗，使用降級處理');
      return fallbackIntentAnalysis(message);
    }

  } catch (error) {
    console.error('Gemini 意圖分析錯誤:', error);
    // 降級處理
    return fallbackIntentAnalysis(message);
  }
}

// 降級意圖分析（當 Gemini 失敗時使用）
function fallbackIntentAnalysis(message) {
  const msg = message.toLowerCase();

  const greetingKeywords = config.intentAnalysis.keywords.greeting;
  const searchKeywords = config.intentAnalysis.keywords.search;

  if (greetingKeywords.some(keyword => msg.includes(keyword))) {
    return { needSearch: false, intentType: 'greeting' };
  }

  if (searchKeywords.some(keyword => msg.includes(keyword))) {
    return { needSearch: true, intentType: 'search', searchKeywords: [message] };
  }

  return { needSearch: false, intentType: 'chat' };
}

// API 調用計數器
class APICounter {
  constructor() {
    this.reset();
  }

  reset() {
    this.notionCalls = 0;
    this.geminiCalls = 0;
    this.startTime = Date.now();
  }

  incrementNotion() {
    this.notionCalls++;
    console.log(`Notion API 調用: ${this.notionCalls}`);
  }

  incrementGemini() {
    this.geminiCalls++;
    console.log(`Gemini API 調用: ${this.geminiCalls}`);
  }

  getStats() {
    const duration = Date.now() - this.startTime;
    return {
      notionCalls: this.notionCalls,
      geminiCalls: this.geminiCalls,
      totalCalls: this.notionCalls + this.geminiCalls,
      duration: Math.round(duration / 1000 * 100) / 100 // 秒，保留兩位小數
    };
  }
}

// 請求速率控制
async function rateLimitDelay() {
  // Notion API 限制: 每秒3次請求，安全起見設為350ms間隔
  await new Promise(resolve => setTimeout(resolve, config.notion.content.rateLimitDelay));
}

// 清理和解析 Gemini 回覆的 JSON
function parseGeminiJSON(responseText, fallbackValue = null) {
  try {
    // 清理可能的 markdown 代碼塊標記和多餘空白
    let cleanedText = responseText.trim();

    // 移除可能的 markdown 代碼塊
    cleanedText = cleanedText.replace(/```json\s*/gi, '');
    cleanedText = cleanedText.replace(/```\s*$/g, '');

    // 移除可能的前後空白和換行
    cleanedText = cleanedText.trim();

    // 如果文本以非 JSON 字符開頭，嘗試找到 JSON 部分
    const jsonStart = cleanedText.indexOf('{');
    const jsonEnd = cleanedText.lastIndexOf('}');

    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleanedText = cleanedText.substring(jsonStart, jsonEnd + 1);
    }

    return JSON.parse(cleanedText);
  } catch (error) {
    console.error('JSON 解析失敗:', {
      原始文本: responseText,
      錯誤: error.message
    });
    return fallbackValue;
  }
}

// 聊天端點
app.post('/chat', async (req, res) => {
  const apiCounter = new APICounter();

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: '請提供訊息內容' });
    }

    console.log(`收到訊息: ${message}`);
    console.log('='.repeat(80));

    // 使用 Gemini 分析用戶意圖
    const intent = await analyzeUserIntentWithGemini(message, apiCounter);
    console.log(`用戶意圖分析結果:`, intent);

    let response;

    if (intent.intentType === 'greeting') {
      // 問候回應
      response = config.ui.messages.greeting;
      res.json({
        success: true,
        response: response,
        intent: intent.intentType,
        apiStats: apiCounter.getStats()
      });

    } else if (intent.needSearch && intent.searchKeywords && intent.searchKeywords.length > 0) {
      // 需要搜尋 Notion - 使用三輪循環策略
      console.log(`執行三輪循環搜尋，關鍵詞: ${intent.searchKeywords.join(', ')}`);

      const searchResult = await threeRoundSearch(message, intent.searchKeywords, apiCounter);

      if (searchResult.success) {
        res.json({
          success: true,
          response: searchResult.response,
          intent: intent.intentType,
          searchResults: searchResult.foundPages,
          searchKeywords: intent.searchKeywords,
          rounds: searchResult.rounds,
          apiStats: apiCounter.getStats()
        });
      } else {
        res.json({
          success: true,
          response: searchResult.response,
          intent: intent.intentType,
          searchResults: [],
          searchKeywords: intent.searchKeywords,
          rounds: searchResult.rounds,
          apiStats: apiCounter.getStats()
        });
      }

    } else {
      // 一般對話，不需要搜尋 Notion
      console.log('執行一般對話模式');

      const chatPrompt = `用戶說：「${message}」

請以友善、有幫助的方式用繁體中文回覆。你是一個智能助手，可以回答各種問題、提供建議或進行對話。如果用戶之後想要搜尋 Notion 筆記，你也可以協助他們。`;

      try {
        const result = await geminiManager.generateContent(chatPrompt);
        apiCounter.incrementGemini();
        const chatResponse = await result.response;
        response = chatResponse.text();
      } catch (error) {
        console.error('一般對話 Gemini 錯誤:', error);
        response = config.ui.messages.errors.aiProcessingError;
      }

      res.json({
        success: true,
        response: response,
        intent: intent.intentType,
        apiStats: apiCounter.getStats()
      });
    }

  } catch (error) {
    console.error('處理聊天請求時發生錯誤:', error);
    res.status(500).json({
      error: '伺服器內部錯誤',
      details: error.message,
      apiStats: apiCounter.getStats()
    });
  }
});

// 三輪循環搜索主函數
async function threeRoundSearch(userMessage, initialKeywords, apiCounter) {
  console.log('🚀 開始三輪循環搜索策略');

  const rounds = [];
  let foundSuitableContent = false;
  let finalResponse = '';
  let finalFoundPages = [];

  // 第一輪：原始關鍵詞
  console.log('\n📍 第一輪搜索 - 使用原始關鍵詞');
  const round1Result = await executeSingleSearchRound(userMessage, initialKeywords, 1, apiCounter);
  rounds.push(round1Result);

  if (round1Result.suitable) {
    console.log('✅ 第一輪找到合適內容，結束搜索');
    return {
      success: true,
      response: round1Result.response,
      foundPages: round1Result.pages,
      rounds: rounds
    };
  }

  // 第二輪：優化關鍵詞
  console.log('\n📍 第二輪搜索 - 優化關鍵詞');
  const optimizedKeywords = await generateOptimizedKeywords(userMessage, initialKeywords, 'optimize', apiCounter);
  const round2Result = await executeSingleSearchRound(userMessage, optimizedKeywords, 2, apiCounter);
  rounds.push(round2Result);

  if (round2Result.suitable) {
    console.log('✅ 第二輪找到合適內容，結束搜索');
    return {
      success: true,
      response: round2Result.response,
      foundPages: round2Result.pages,
      rounds: rounds
    };
  }

  // 第三輪：擴展關鍵詞
  console.log('\n📍 第三輪搜索 - 擴展關鍵詞');
  const expandedKeywords = await generateOptimizedKeywords(userMessage, initialKeywords, 'expand', apiCounter);
  const round3Result = await executeSingleSearchRound(userMessage, expandedKeywords, 3, apiCounter);
  rounds.push(round3Result);

  if (round3Result.suitable) {
    console.log('✅ 第三輪找到合適內容，結束搜索');
    return {
      success: true,
      response: round3Result.response,
      foundPages: round3Result.pages,
      rounds: rounds
    };
  }

  // 三輪都沒有找到合適內容
  console.log('❌ 三輪搜索都沒有找到合適的內容');
  return {
    success: false,
    response: generateFailureResponse(userMessage, rounds),
    foundPages: [],
    rounds: rounds
  };
}

// 執行單輪搜索
async function executeSingleSearchRound(userMessage, keywords, roundNumber, apiCounter) {
  console.log(`🔍 第${roundNumber}輪關鍵詞: ${keywords.join(', ')}`);

  try {
    // 1. 搜索獲得5個頁面連結
    await rateLimitDelay(); // 速率控制
    const searchResults = await performBasicSearch(keywords, apiCounter);
    console.log(`第${roundNumber}輪搜索結果: ${searchResults.length} 個頁面`);

    if (searchResults.length === 0) {
      return {
        round: roundNumber,
        keywords: keywords,
        searchResults: [],
        selectedPages: [],
        pages: [],
        suitable: false,
        response: null,
        reason: '沒有找到相關頁面'
      };
    }

    // 2. Gemini選擇最相關的頁面
    const selectedPages = await selectTopPages(userMessage, searchResults, config.notion.search.maxSelectedPages, apiCounter);
    console.log(`第${roundNumber}輪選中頁面: ${selectedPages.map(p => p.title).join(', ')}`);

    // 3. 獲取這3個頁面的完整內容
    const pageContents = await batchGetSelectedPageContents(selectedPages, apiCounter);
    console.log(`第${roundNumber}輪成功讀取: ${pageContents.length} 個頁面內容`);

    if (pageContents.length === 0) {
      return {
        round: roundNumber,
        keywords: keywords,
        searchResults: searchResults,
        selectedPages: selectedPages,
        pages: [],
        suitable: false,
        response: null,
        reason: '無法讀取頁面內容'
      };
    }

    // 4. Gemini判斷內容是否合適
    const suitabilityResult = await evaluateContentSuitability(userMessage, pageContents, apiCounter);

    if (suitabilityResult.suitable) {
      // 5. 生成最終回覆
      const finalResponse = await generateFinalResponse(userMessage, pageContents, apiCounter);

      return {
        round: roundNumber,
        keywords: keywords,
        searchResults: searchResults,
        selectedPages: selectedPages,
        pages: pageContents,
        suitable: true,
        response: finalResponse,
        reason: '找到合適內容'
      };
    } else {
      return {
        round: roundNumber,
        keywords: keywords,
        searchResults: searchResults,
        selectedPages: selectedPages,
        pages: pageContents,
        suitable: false,
        response: null,
        reason: suitabilityResult.reason || '內容不夠相關'
      };
    }

  } catch (error) {
    console.error(`第${roundNumber}輪搜索錯誤:`, error);
    return {
      round: roundNumber,
      keywords: keywords,
      searchResults: [],
      selectedPages: [],
      pages: [],
      suitable: false,
      response: null,
      reason: `搜索錯誤: ${error.message}`
    };
  }
}

// 基本搜索函數（替代原來的複雜搜索）
async function performBasicSearch(keywords, apiCounter) {
  const allResults = new Map();

  for (const keyword of keywords) {
    console.log(`🔍 搜索關鍵詞: "${keyword}"`);

    try {
      await rateLimitDelay(); // 速率控制
      const response = await notion.search({
        query: keyword,
        page_size: config.notion.search.pageSize,
      });

      apiCounter.incrementNotion();

      response.results.forEach(page => {
        if (!allResults.has(page.id)) {
          const pageInfo = extractPageInfo(page);
          pageInfo.matchedKeyword = keyword;
          allResults.set(page.id, pageInfo);
        }
      });
    } catch (error) {
      console.error(`搜索關鍵詞 "${keyword}" 失敗:`, error.message);
    }
  }

  const results = Array.from(allResults.values());
  return results.slice(0, config.notion.search.maxResults);
}

// Gemini選擇最相關的頁面
async function selectTopPages(userMessage, searchResults, count, apiCounter) {
  if (searchResults.length <= count) {
    return searchResults;
  }

  try {
    const selectionPrompt = `
用戶問題：「${userMessage}」

以下是搜索到的頁面列表：
${searchResults.map((page, index) => `${index + 1}. ${page.title} (ID: ${page.id})`).join('\n')}

請選擇最相關的${count}個頁面來回答用戶的問題。

請以JSON格式回覆，只包含選中頁面的ID：
{
  "selectedIds": ["page_id_1", "page_id_2", "page_id_3"]
}

只回覆JSON，不要其他文字。
`;

    const result = await geminiManager.generateContent(selectionPrompt);
    apiCounter.incrementGemini();
    const response = await result.response;

    const selectionData = parseGeminiJSON(response.text());
    if (selectionData && selectionData.selectedIds && Array.isArray(selectionData.selectedIds)) {
      const selectedPages = searchResults.filter(page =>
        selectionData.selectedIds.includes(page.id)
      );

      if (selectedPages.length > 0) {
        console.log(`AI 選擇了 ${selectedPages.length} 個頁面: ${selectedPages.map(p => p.title).join(', ')}`);
        return selectedPages;
      }
    }
  } catch (error) {
    console.error('Gemini頁面選擇錯誤:', error);
  }

  // 降級處理：返回前N個頁面
  return searchResults.slice(0, count);
}

// 批量獲取選中頁面的內容
async function batchGetSelectedPageContents(selectedPages, apiCounter) {
  const pageContents = [];

  for (const page of selectedPages) {
    try {
      await rateLimitDelay(); // 速率控制
      const content = await getNotionPageContent(page.id);
      apiCounter.incrementNotion();

      if (content && content.trim()) {
        pageContents.push({
          ...page,
          content: content,
          contentLength: content.length
        });
      }
    } catch (error) {
      console.error(`讀取頁面 "${page.title}" 內容失敗:`, error.message);
    }
  }

  return pageContents;
}

// 評估內容是否合適回答用戶問題
async function evaluateContentSuitability(userMessage, pageContents, apiCounter) {
  try {
    const evaluationPrompt = `
用戶問題：「${userMessage}」

從 Notion 工作區找到的相關頁面內容：
${pageContents.map((page, index) => `
頁面${index + 1}: ${page.title}
內容預覽: ${page.content.substring(0, 800)}...
`).join('\n')}

請評估這些 Notion 頁面內容是否足夠回答用戶的問題。

重要理解：
- 這些都是用戶存儲在 Notion 中的筆記/資料
- 用戶要找的就是存儲在 Notion 中與關鍵詞相關的任何內容
- 例如：用戶問「找Promise的筆記」= 找Notion中關於Promise的任何資料
- 例如：用戶問「React相關資料」= 找Notion中關於React的任何內容

請以JSON格式回覆：
{
  "suitable": true/false,
  "reason": "評估原因說明"
}

判斷標準：
- 內容與用戶查找的關鍵詞/主題相關 → suitable: true
- 內容能提供用戶需要的技術資訊或知識 → suitable: true  
- 內容完全不相關於查找主題 → suitable: false
- 內容雖不完整但有參考價值 → suitable: true
- 只要是相關主題的技術內容都應該被認為合適 → suitable: true

只回覆JSON，不要其他文字。
`;

    const result = await geminiManager.generateContent(evaluationPrompt);
    apiCounter.incrementGemini();
    const response = await result.response;

    const evaluationData = parseGeminiJSON(response.text(), { suitable: false, reason: 'JSON解析失敗' });
    console.log(`內容適用性評估: ${evaluationData.suitable ? '✅' : '❌'} - ${evaluationData.reason}`);
    return evaluationData;

  } catch (error) {
    console.error('Gemini適用性評估錯誤:', error);
    return { suitable: false, reason: `評估錯誤: ${error.message}` };
  }
}

// 生成優化的關鍵詞
async function generateOptimizedKeywords(userMessage, currentKeywords, mode, apiCounter) {
  try {
    const optimizationPrompt = mode === 'optimize' ? `
用戶問題：「${userMessage}」
當前關鍵詞：${currentKeywords.join(', ')}

第一輪搜索沒有找到合適內容。請優化關鍵詞，提供更精確的搜索詞。

請以JSON格式回覆：
{
  "keywords": ["優化關鍵詞1", "優化關鍵詞2", "優化關鍵詞3"]
}

重要：只提供 3 個最核心、最相關的關鍵詞。

優化策略：
- 使用同義詞和相關術語
- 調整關鍵詞的具體程度
- 考慮不同的表達方式

只回覆JSON，不要其他文字。
` : `
用戶問題：「${userMessage}」
原始關鍵詞：${currentKeywords.join(', ')}

前兩輪搜索都沒有找到合適內容。請擴展關鍵詞範圍，提供更廣泛的搜索詞。

請以JSON格式回覆：
{
  "keywords": ["擴展關鍵詞1", "擴展關鍵詞2", "擴展關鍵詞3"]
}

重要：只提供 3 個最相關的擴展關鍵詞。

擴展策略：
- 使用更廣泛的類別詞
- 包含相關領域的術語  
- 嘗試不同語言（中英文）
- 考慮上下位概念

只回覆JSON，不要其他文字。
`;

    const result = await geminiManager.generateContent(optimizationPrompt);
    apiCounter.incrementGemini();
    const response = await result.response;

    const keywordData = parseGeminiJSON(response.text());
    if (keywordData && keywordData.keywords && Array.isArray(keywordData.keywords)) {
      // 限制關鍵詞數量
      const limitedKeywords = keywordData.keywords.slice(0, config.gemini.search.maxKeywords);
      console.log(`${mode === 'optimize' ? '優化' : '擴展'}關鍵詞: ${limitedKeywords.join(', ')}`);

      if (keywordData.keywords.length > config.gemini.search.maxKeywords) {
        console.log(`⚠️ Gemini提供了${keywordData.keywords.length}個關鍵詞，已限制為${config.gemini.search.maxKeywords}個`);
      }

      return limitedKeywords;
    } else {
      console.error('關鍵詞優化JSON解析失敗，使用原關鍵詞');
      return currentKeywords.slice(0, config.gemini.search.maxKeywords); // 返回原關鍵詞作為備份
    }

  } catch (error) {
    console.error('Gemini關鍵詞優化錯誤:', error);
    return currentKeywords; // 返回原關鍵詞作為備份
  }
}

// 生成最終回覆
async function generateFinalResponse(userMessage, pageContents, apiCounter) {
  try {
    let aggregatedContent = `用戶問題：「${userMessage}」\n\n找到以下相關資料：\n\n`;

    pageContents.forEach((page, index) => {
      aggregatedContent += `=== 資料 ${index + 1}：${page.title} ===\n`;
      aggregatedContent += `網址：${page.url}\n`;
      aggregatedContent += `內容：\n${page.content.substring(0, config.notion.content.maxPreviewLength)}${page.content.length > config.notion.content.maxPreviewLength ? '...' : ''}\n\n`;
    });

    const responsePrompt = `
根據以下用戶問題和找到的 Notion 資料，請提供一個精煉、整合且有用的回覆：

${aggregatedContent}

請以繁體中文回覆，要求：
1. 整合多個資料來源的資訊
2. 回答用戶的具體問題
3. 提供重要細節和關鍵點
4. 如果資料間有矛盾，請指出
5. 在回覆末尾列出參考的頁面標題和連結
6. 保持回覆結構清晰、易讀

回覆格式：
[整合後的主要回覆內容]

📚 **參考資料：**
• [頁面標題1]（[URL1]）
• [頁面標題2]（[URL2]）
...
`;

    const result = await geminiManager.generateContent(responsePrompt);
    apiCounter.incrementGemini();
    const response = await result.response;

    return response.text();

  } catch (error) {
    console.error('生成最終回覆錯誤:', error);

    // 降級處理
    let fallbackResponse = `找到 ${pageContents.length} 筆相關資料：\n\n`;

    pageContents.forEach((page, index) => {
      fallbackResponse += `${index + 1}. **${page.title}**\n`;
      fallbackResponse += `   網址：${page.url}\n`;
      fallbackResponse += `   內容預覽：${page.content.substring(0, 200)}...\n\n`;
    });

    return fallbackResponse;
  }
}

// 生成搜索失敗回覆
function generateFailureResponse(userMessage, rounds) {
  let response = `抱歉，經過三輪搜索都沒有找到與「${userMessage}」相關的合適內容。\n\n`;

  response += `🔍 **搜索記錄：**\n`;
  rounds.forEach(round => {
    response += `第${round.round}輪：使用關鍵詞 [${round.keywords.join(', ')}]\n`;
    response += `　　　結果：${round.reason}\n`;
  });

  response += `\n💡 **建議：**\n`;
  response += `• 檢查 Notion Integration 是否有正確的頁面存取權限\n`;
  response += `• 確認相關內容確實存在於您的工作區中\n`;
  response += `• 嘗試使用不同的關鍵詞或描述方式\n`;
  response += `• 確保要查找的資料已經儲存在 Notion 中`;

  return response;
}


// 提取頁面資訊 (共用函式)
function extractPageInfo(page) {
  let title = 'Untitled';

  if (page.properties) {
    const titleProperty = Object.values(page.properties).find(
      prop => prop.type === 'title'
    );
    if (titleProperty && titleProperty.title && titleProperty.title.length > 0) {
      title = titleProperty.title.map(t => t.plain_text).join('');
    }
  }

  if (title === 'Untitled' && page.title) {
    title = page.title;
  }

  return {
    id: page.id,
    title: title,
    url: page.url,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time
  };
}


// 讀取 Notion 頁面內容
async function getNotionPageContent(pageId) {
  try {
    console.log(`讀取頁面內容: ${pageId}`);

    // 首先檢查頁面是否存在以及權限
    let page;
    try {
      page = await notion.pages.retrieve({ page_id: pageId });
      console.log(`頁面標題: ${getPageTitle(page)}`);
    } catch (pageError) {
      console.error('無法讀取頁面基本資訊:', {
        status: pageError.status,
        code: pageError.code,
        message: pageError.message
      });

      if (pageError.status === 403) {
        throw new Error(config.ui.messages.errors.notionPermission);
      } else if (pageError.status === 404) {
        throw new Error(config.ui.messages.errors.pageNotFound);
      }
      throw pageError;
    }

    // 獲取頁面內容區塊（遞歸獲取所有子內容）
    const rawContent = await extractAllBlocksRecursively(pageId);

    // 後處理：清理和美化內容
    const content = formatFinalOutput(rawContent, getPageTitle(page));

    console.log(`頁面內容長度: ${content.length} 字符`);
    return content.trim();

  } catch (error) {
    console.error('讀取頁面內容錯誤:', error);
    return null;
  }
}

// 遞歸提取所有區塊內容（包含子區塊和子頁面）
async function extractAllBlocksRecursively(blockId, depth = 0, maxDepth = config.notion.content.maxDepth) {
  try {
    if (depth > maxDepth) {
      console.log(`達到最大深度 ${maxDepth}，停止遞歸`);
      return '';
    }

    const indent = '  '.repeat(depth);
    console.log(`${indent}讀取區塊/頁面: ${blockId} (深度: ${depth})`);

    const blocks = await notion.blocks.children.list({
      block_id: blockId,
      page_size: 100,
    });

    console.log(`${indent}找到 ${blocks.results.length} 個區塊`);

    let content = '';
    let blockCount = 0;

    for (const block of blocks.results) {
      blockCount++;
      console.log(`${indent}處理區塊 ${blockCount}: ${block.type}`);

      // 提取當前區塊的文字（已包含格式化）
      const blockText = extractBlockText(block, depth);
      if (blockText) {
        content += blockText + '\n';
      }

      // 處理有子內容的區塊類型
      if (block.has_children) {
        console.log(`${indent}區塊 ${block.type} 包含子內容，遞歸讀取...`);
        try {
          const childContent = await extractAllBlocksRecursively(block.id, depth + 1, maxDepth);
          if (childContent) {
            // 為子內容添加縮進
            const indentedChild = childContent.split('\n')
              .map(line => line ? '    ' + line : line)
              .join('\n');
            content += indentedChild + '\n';
          }
        } catch (childError) {
          console.error(`${indent}讀取子區塊失敗:`, childError.message);
          content += `    [無法讀取子內容: ${childError.message}]\n`;
        }
      }

      // 處理子頁面連結
      if (block.type === 'child_page') {
        console.log(`${indent}發現子頁面: ${block.child_page?.title || 'Untitled'}`);
        try {
          const subPageContent = await extractAllBlocksRecursively(block.id, depth + 1, maxDepth);
          if (subPageContent) {
            content += `\n${'='.repeat(50)}\n`;
            content += `📄 子頁面: ${block.child_page?.title || 'Untitled'}\n`;
            content += `${'='.repeat(50)}\n`;
            content += subPageContent + '\n';
          }
        } catch (subPageError) {
          console.error(`${indent}讀取子頁面失敗:`, subPageError.message);
          content += `❌ [無法讀取子頁面 "${block.child_page?.title}": ${subPageError.message}]\n`;
        }
      }

      // 處理資料庫中的頁面
      if (block.type === 'child_database') {
        console.log(`${indent}發現子資料庫: ${block.child_database?.title || 'Untitled'}`);
        content += `\n${'='.repeat(50)}\n`;
        content += `🗄️ 子資料庫: ${block.child_database?.title || 'Untitled'}\n`;
        content += `${'='.repeat(50)}\n`;
      }
    }

    return content;

  } catch (error) {
    console.error(`讀取區塊內容錯誤 (深度 ${depth}):`, error);
    return `❌ [讀取錯誤: ${error.message}]`;
  }
}

// 提取區塊文字內容（改善排版格式）
function extractBlockText(block, depth = 0) {
  try {
    const baseIndent = '  '.repeat(Math.max(0, depth - 1));

    switch (block.type) {
      case 'paragraph':
        const text = block.paragraph?.rich_text?.map(text => text.plain_text).join('') || '';
        return text ? `${baseIndent}${text}` : '';

      case 'heading_1':
        const h1Text = block.heading_1?.rich_text?.map(text => text.plain_text).join('') || '';
        return h1Text ? `\n${'#'.repeat(60)}\n# ${h1Text.toUpperCase()}\n${'#'.repeat(60)}` : '';

      case 'heading_2':
        const h2Text = block.heading_2?.rich_text?.map(text => text.plain_text).join('') || '';
        return h2Text ? `\n${'='.repeat(40)}\n## ${h2Text}\n${'='.repeat(40)}` : '';

      case 'heading_3':
        const h3Text = block.heading_3?.rich_text?.map(text => text.plain_text).join('') || '';
        return h3Text ? `\n${'-'.repeat(30)}\n### ${h3Text}\n${'-'.repeat(30)}` : '';

      case 'bulleted_list_item':
        const bulletText = block.bulleted_list_item?.rich_text?.map(text => text.plain_text).join('') || '';
        return bulletText ? `${baseIndent}• ${bulletText}` : '';

      case 'numbered_list_item':
        const numberedText = block.numbered_list_item?.rich_text?.map(text => text.plain_text).join('') || '';
        return numberedText ? `${baseIndent}1. ${numberedText}` : '';

      case 'to_do':
        const checked = block.to_do?.checked ? '☑️' : '☐';
        const todoText = block.to_do?.rich_text?.map(text => text.plain_text).join('') || '';
        return todoText ? `${baseIndent}${checked} ${todoText}` : '';

      case 'code':
        const code = block.code?.rich_text?.map(text => text.plain_text).join('') || '';
        const language = block.code?.language || 'text';
        return code ? `\n${'`'.repeat(50)}\n💻 程式碼 (${language}):\n${'`'.repeat(50)}\n${code}\n${'`'.repeat(50)}` : '';

      case 'quote':
        const quoteText = block.quote?.rich_text?.map(text => text.plain_text).join('') || '';
        return quoteText ? `${baseIndent}💬 "${quoteText}"` : '';

      case 'callout':
        const calloutText = block.callout?.rich_text?.map(text => text.plain_text).join('') || '';
        const icon = block.callout?.icon?.emoji || '📝';
        return calloutText ? `\n${icon} 重要提醒\n${'▔'.repeat(30)}\n${calloutText}\n${'▔'.repeat(30)}` : '';

      case 'toggle':
        const toggleText = block.toggle?.rich_text?.map(text => text.plain_text).join('') || '';
        return toggleText ? `\n🔽 ${toggleText}` : '';

      case 'divider':
        return `\n${'━'.repeat(80)}\n`;

      case 'table':
        return `\n📊 [表格內容]\n`;

      case 'image':
        const imageCaption = block.image?.caption?.[0]?.plain_text || '';
        return `\n🖼️ [圖片${imageCaption ? ': ' + imageCaption : ''}]\n`;

      case 'video':
        return `\n🎥 [影片內容]\n`;

      case 'file':
        const fileName = block.file?.name || '未知檔案';
        return `\n📎 [檔案: ${fileName}]\n`;

      case 'pdf':
        return `\n📄 [PDF 文件]\n`;

      case 'bookmark':
        const bookmarkUrl = block.bookmark?.url || '';
        const bookmarkTitle = block.bookmark?.caption?.[0]?.plain_text || bookmarkUrl;
        return bookmarkUrl ? `\n🔖 書籤: ${bookmarkTitle}\n   📍 ${bookmarkUrl}\n` : '';

      case 'link_preview':
        const linkUrl = block.link_preview?.url || '';
        return linkUrl ? `\n🔗 連結預覽: ${linkUrl}\n` : '';

      case 'embed':
        const embedUrl = block.embed?.url || '';
        return embedUrl ? `\n📎 嵌入內容: ${embedUrl}\n` : '';

      default:
        console.log(`未處理的區塊類型: ${block.type}`);
        return `\n❓ [未知內容類型: ${block.type}]\n`;
    }
  } catch (error) {
    console.error(`提取區塊文字時發生錯誤 (${block.type}):`, error);
    return '';
  }
}

// 最終內容格式化和美化
function formatFinalOutput(content, pageTitle = 'Untitled') {
  try {
    // 移除多餘的空行（保留一些結構）
    let formatted = content.replace(/\n\s*\n\s*\n/g, '\n\n');

    // 添加頁面標題區塊
    const titleBlock = `
╔${'═'.repeat(Math.min(pageTitle.length + 4, 76))}╗
║  📖 ${pageTitle.padEnd(Math.min(pageTitle.length, 72))} ║
╚${'═'.repeat(Math.min(pageTitle.length + 4, 76))}╝
`;

    // 組合最終內容
    formatted = titleBlock + '\n' + formatted;

    // 清理格式
    formatted = formatted
      // 移除過多的連續空行
      .replace(/\n{4,}/g, '\n\n\n')
      // 確保分隔線前後有適當空行
      .replace(/([^\n])\n(═+|─+|━+)/g, '$1\n\n$2')
      .replace(/(═+|─+|━+)\n([^\n])/g, '$1\n\n$2')
      // 確保代碼區塊前後有空行
      .replace(/([^\n])\n(`{3,})/g, '$1\n\n$2')
      .replace(/(`{3,})\n([^\n`])/g, '$1\n\n$2')
      // 修正縮進問題
      .replace(/^    {2,}/gm, '    ');

    return formatted.trim();

  } catch (error) {
    console.error('格式化內容時發生錯誤:', error);
    return content; // 回傳原始內容作為備份
  }
}

// 獲取頁面標題
function getPageTitle(page) {
  try {
    if (page.properties) {
      const titleProperty = Object.values(page.properties).find(
        prop => prop.type === 'title'
      );
      if (titleProperty?.title?.[0]?.plain_text) {
        return titleProperty.title[0].plain_text;
      }
    }
    return 'Untitled';
  } catch (error) {
    console.error('獲取頁面標題錯誤:', error);
    return 'Untitled';
  }
}

// 分析 Notion 頁面內容的端點
app.post('/analyze-page', async (req, res) => {
  try {
    const { pageId, question } = req.body;

    if (!pageId) {
      return res.status(400).json({ error: '請提供頁面 ID' });
    }

    console.log(`分析頁面: ${pageId}, 問題: ${question || '無特定問題'}`);

    // 讀取頁面內容
    const content = await getNotionPageContent(pageId);

    if (!content) {
      return res.json({
        success: false,
        response: '抱歉，無法讀取該頁面的內容。可能是權限問題或頁面不存在。'
      });
    }

    // 使用 Gemini 分析內容
    const analysisPrompt = question
      ? `用戶問題：「${question}」\n\n以下是 Notion 頁面的內容：\n${content}\n\n請根據頁面內容回答用戶的問題，用繁體中文回覆。`
      : `以下是 Notion 頁面的內容：\n${content}\n\n請用繁體中文總結這個頁面的主要內容，包括關鍵重點和重要資訊。`;

    const result = await geminiManager.generateContent(analysisPrompt);
    const response = await result.response;

    res.json({
      success: true,
      response: response.text(),
      contentLength: content.length
    });

  } catch (error) {
    console.error('分析頁面錯誤:', error);
    res.status(500).json({
      error: '分析頁面時發生錯誤',
      details: error.message
    });
  }
});

// 測試 Notion API 連線
app.get('/test-notion', async (req, res) => {
  try {
    console.log('測試 Notion API 連線...');
    console.log('Token:', process.env.NOTION_TOKEN ? 'Token 已設定' : 'Token 未設定');

    const response = await notion.search({
      query: '',
      page_size: 5,
    });

    console.log('Notion API 回應:', {
      results_count: response.results.length,
      has_more: response.has_more
    });

    res.json({
      success: true,
      message: 'Notion API 連線成功',
      results_count: response.results.length,
      pages: response.results.map(page => ({
        id: page.id,
        title: page.properties?.title?.title?.[0]?.plain_text || 'Untitled',
        url: page.url
      }))
    });

  } catch (error) {
    console.error('Notion API 測試錯誤:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      status: error.status
    });
  }
});

// 健康檢查端點
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    env: {
      notion_token: process.env.NOTION_TOKEN ? 'Set' : 'Missing',
      gemini_keys: geminiManager.apiKeys.length
    },
    geminiStatus: geminiManager.getStatus()
  });
});

// API Keys 狀態檢查端點
app.get('/api-status', (req, res) => {
  res.json({
    success: true,
    geminiKeys: geminiManager.getStatus(),
    totalKeys: geminiManager.apiKeys.length,
    currentKey: geminiManager.currentKeyIndex + 1
  });
});

app.listen(PORT, () => {
  console.log(`伺服器運行在 http://localhost:${PORT}`);
});