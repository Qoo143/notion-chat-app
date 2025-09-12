/**
 * @fileoverview 搜尋服務模組
 * @description 管理動態多輪搜尋策略，整合 Notion API 和 Gemini AI 進行智慧化內容搜尋和分析
 * @author Claude Code
 * @version 1.0.0
 */

const notionService = require('./notionService');
const geminiService = require('./geminiService');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * 搜尋服務類別
 * @class SearchService
 * @description 提供進階的搜尋功能，包含動態多輪搜尋、關鍵詞最佳化、內容適用性評估等
 */
class SearchService {
  /**
   * 初始化搜尋服務
   * @constructor
   * @description 設定速率限制參數
   */
  constructor() {
    /** @type {number} 速率限制延遲時間（毫秒） */
    this.rateLimitDelayMs = config.notion.content.rateLimitDelay;
  }

  /**
   * 動態多輪搜尋主函式
   * @method performDynamicSearch
   * @async
   * @param {string} userMessage - 用戶詢息
   * @param {string[]} initialKeywords - 初始關鍵詞陣列
   * @param {number} maxRounds - 最大搜尋輪數 (1-3)
   * @param {Object} apiCounter - API 調用計數器
   * @returns {Promise<Object>} 搜尋結果，包含成功狀態、回覆內容和細節資訊
   * @description 根據指定輪數執行動態搜尋，每輪使用不同的關鍵詞策略
   */
  async performDynamicSearch(userMessage, initialKeywords, maxRounds, apiCounter) {
    logger.info(`🚀 開始${maxRounds}輪循環搜索策略`);

    const rounds = [];
    let currentKeywords = initialKeywords;

    // 動態執行指定輪數的搜索
    for (let roundNumber = 1; roundNumber <= maxRounds; roundNumber++) {
      logger.debug(`\n📍 第${roundNumber}輪搜索`);
      
      // 根據輪數決定關鍵詞策略
      if (roundNumber === 1) {
        logger.debug('使用原始關鍵詞');
        currentKeywords = initialKeywords;
      } else if (roundNumber === 2) {
        logger.debug('優化關鍵詞');
        currentKeywords = await this.generateOptimizedKeywords(userMessage, initialKeywords, 'optimize', apiCounter);
      } else if (roundNumber === 3) {
        logger.debug('擴展關鍵詞');
        currentKeywords = await this.generateOptimizedKeywords(userMessage, initialKeywords, 'expand', apiCounter);
      }

      const roundResult = await this.executeSingleSearchRound(userMessage, currentKeywords, roundNumber, apiCounter);
      rounds.push(roundResult);

      if (roundResult.suitable) {
        logger.info(`✅ 第${roundNumber}輪找到合適內容，結束搜索`);
        return {
          success: true,
          response: roundResult.response,
          foundPages: roundResult.pages,
          rounds: rounds
        };
      }
    }

    // 所有輪次都沒有找到合適內容
    logger.warn(`❌ ${maxRounds}輪搜索都沒有找到合適的內容`);
    return {
      success: false,
      response: this.generateFailureResponse(userMessage, rounds),
      foundPages: [],
      rounds: rounds
    };
  }

  /**
   * 執行單輪搜尋
   * @method executeSingleSearchRound
   * @async
   * @param {string} userMessage - 用戶詢息
   * @param {string[]} keywords - 本輪搜尋關鍵詞
   * @param {number} roundNumber - 輪次編號
   * @param {Object} apiCounter - API 調用計數器
   * @returns {Promise<Object>} 單輪搜尋結果
   * @description 執行一輪完整的搜尋流程：搜尋→選擇→讀取→評估→生成回覆
   */
  async executeSingleSearchRound(userMessage, keywords, roundNumber, apiCounter) {
    logger.debug(`🔍 第${roundNumber}輪關鍵詞: ${keywords.join(', ')}`);

    try {
      // 1. 搜索獲得頁面
      await this.rateLimitDelay();
      const searchResults = await notionService.performBasicSearch(keywords, apiCounter);
      logger.debug(`第${roundNumber}輪搜索結果: ${searchResults.length} 個頁面`);

      if (searchResults.length === 0) {
        return this.createRoundResult(roundNumber, keywords, [], [], [], false, null, '沒有找到相關頁面');
      }

      // 2. Gemini選擇最相關的頁面
      const selectedPages = await this.selectTopPages(userMessage, searchResults, config.notion.search.maxSelectedPages, apiCounter);
      logger.debug(`第${roundNumber}輪選中頁面: ${selectedPages.map(p => p.title).join(', ')}`);

      // 3. 獲取頁面內容
      const pageContents = await notionService.batchGetSelectedPageContents(selectedPages, apiCounter);
      logger.debug(`第${roundNumber}輪成功讀取: ${pageContents.length} 個頁面內容`);

      if (pageContents.length === 0) {
        return this.createRoundResult(roundNumber, keywords, searchResults, selectedPages, [], false, null, '無法讀取頁面內容');
      }

      // 4. 判斷內容是否合適
      const suitabilityResult = await this.evaluateContentSuitability(userMessage, pageContents, apiCounter);

      if (suitabilityResult.suitable) {
        // 5. 生成最終回覆
        const finalResponse = await this.generateFinalResponse(userMessage, pageContents, apiCounter);
        return this.createRoundResult(roundNumber, keywords, searchResults, selectedPages, pageContents, true, finalResponse, '找到合適內容');
      } else {
        return this.createRoundResult(roundNumber, keywords, searchResults, selectedPages, pageContents, false, null, suitabilityResult.reason || '內容不夠相關');
      }

    } catch (error) {
      logger.error(`第${roundNumber}輪搜索錯誤:`, error.message);
      return this.createRoundResult(roundNumber, keywords, [], [], [], false, null, `搜索錯誤: ${error.message}`);
    }
  }

  /**
   * 創建輪次結果物件
   * @method createRoundResult
   * @param {number} round - 輪次編號
   * @param {string[]} keywords - 使用的關鍵詞
   * @param {Array<Object>} searchResults - 搜尋結果
   * @param {Array<Object>} selectedPages - 選中的頁面
   * @param {Array<Object>} pages - 頁面內容
   * @param {boolean} suitable - 內容是否適合
   * @param {string|null} response - 生成的回覆
   * @param {string} reason - 結果原因說明
   * @returns {Object} 結構化的輪次結果物件
   * @description 將單輪搜尋結果結構化為標準格式
   */
  createRoundResult(round, keywords, searchResults, selectedPages, pages, suitable, response, reason) {
    return {
      round,
      keywords,
      searchResults,
      selectedPages,
      pages,
      suitable,
      response,
      reason
    };
  }

  /**
   * 生成搜尋失敗回覆
   * @method generateFailureResponse
   * @param {string} userMessage - 用戶詢息
   * @param {Array<Object>} rounds - 所有輪次的搜尋結果
   * @returns {string} 格式化的失敗回覆訊息
   * @description 當所有輪次都沒有找到合適內容時，生成詳細的失敗說明
   */
  generateFailureResponse(userMessage, rounds) {
    const roundCount = rounds.length;
    let response = `抱歉，經過${roundCount}輪搜索都沒有找到與「${userMessage}」相關的合適內容。\n\n`;

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

  /**
   * 速率限制延遲
   * @method rateLimitDelay
   * @async
   * @returns {Promise<void>} 延遲 Promise
   * @description 根據配置的延遲時間進行等待，避免 API 速率限制
   */
  async rateLimitDelay() {
    return new Promise(resolve => setTimeout(resolve, this.rateLimitDelayMs));
  }

  /**
   * 生成優化關鍵詞
   */
  async generateOptimizedKeywords(userMessage, currentKeywords, mode, apiCounter) {
    try {
      const optimizationPrompt = mode === 'optimize' ? `
用戶問題：「${userMessage}」
當前關鍵詞：${currentKeywords.join(', ')}

第一輪搜索沒有找到合適內容。請優化關鍵詞，提供更精確的搜索詞。

⚠️ **重要：Notion API 搜尋限制**
- 只搜尋頁面標題，不搜尋內容
- 關鍵詞必須可能出現在標題中
- 優先選擇名詞、技術術語、專案名稱

請以JSON格式回覆：
{
  "keywords": ["優化關鍵詞1", "優化關鍵詞2", "優化關鍵詞3"]
}

**標題導向優化策略：**
- 替換為更常見的標題用詞
- 考慮技術縮寫和全名
- 包含分類詞（如：筆記、文檔、專案、學習）
- 使用同義但更簡潔的術語
- 考慮中英文混用（常見於技術標題）

範例優化：
- 「異步處理」→ 「Promise」、「async」、「非同步」
- 「前端框架」→ 「React」、「Vue」、「Angular」  
- 「資料庫」→ 「MySQL」、「MongoDB」、「Database」
- 「機器學習」→ 「ML」、「AI」、「深度學習」

只回覆JSON，不要其他文字。
` : `
用戶問題：「${userMessage}」
原始關鍵詞：${currentKeywords.join(', ')}

前兩輪搜索都沒有找到合適內容。請擴展關鍵詞範圍，提供更廣泛的搜索詞。

⚠️ **重要：Notion API 搜尋限制**
- 只搜尋頁面標題，不搜尋內容
- 擴展關鍵詞仍需可能出現在標題中

請以JSON格式回覆：
{
  "keywords": ["擴展關鍵詞1", "擴展關鍵詞2", "擴展關鍵詞3"]
}

**標題導向擴展策略：**
- 使用更廣泛的上位詞（如：「React」→「前端」→「開發」）
- 包含相關工具和技術
- 添加時間相關詞（如：「2024」、「新版」、「最新」）
- 考慮學習和工作場景詞彙
- 嘗試常見標題模式詞

範例擴展：
- 「Python」→ 「程式設計」、「開發」、「coding」
- 「安全」→ 「網路安全」、「資安」、「Security」
- 「專案管理」→ 「管理」、「Project」、「規劃」
- 「設計模式」→ 「軟體工程」、「架構」、「Pattern」

只回覆JSON，不要其他文字。
`;

      const result = await geminiService.generateContent(optimizationPrompt);
      apiCounter.incrementGemini();
      const response = await result.response;

      const keywordData = this.parseGeminiJSON(response.text());
      if (keywordData && keywordData.keywords && Array.isArray(keywordData.keywords)) {
        const limitedKeywords = keywordData.keywords.slice(0, config.gemini.search.maxKeywords);
        logger.info(`${mode === 'optimize' ? '優化' : '擴展'}關鍵詞: ${limitedKeywords.join(', ')}`);

        if (keywordData.keywords.length > config.gemini.search.maxKeywords) {
          logger.warn(`⚠️ Gemini提供了${keywordData.keywords.length}個關鍵詞，已限制為${config.gemini.search.maxKeywords}個`);
        }

        return limitedKeywords;
      } else {
        logger.error('關鍵詞優化JSON解析失敗，使用原關鍵詞');
        return currentKeywords.slice(0, config.gemini.search.maxKeywords);
      }

    } catch (error) {
      logger.error('Gemini關鍵詞優化錯誤:', error.message);
      return currentKeywords;
    }
  }

  /**
   * 選擇最相關的頁面
   */
  async selectTopPages(userMessage, searchResults, count, apiCounter) {
    try {
      if (searchResults.length <= count) {
        return searchResults;
      }

      const selectionPrompt = `
用戶查詢：「${userMessage}」

找到以下頁面：
${searchResults.map((page, index) => 
  `${index + 1}. ${page.title} (最後編輯：${page.lastEdited})`
).join('\n')}

請從這${searchResults.length}個頁面中選出最相關的${count}個，按相關性排序。

請以JSON格式回覆：
{
  "selectedIndices": [頁面索引1, 頁面索引2, 頁面索引3],
  "reason": "選擇理由"
}

選擇標準：
1. 標題與用戶查詢最相關
2. 考慮最近編輯時間（較新的內容優先）
3. 專業技術內容優於一般內容

只回覆JSON，不要其他文字。
`;

      const result = await geminiService.generateContent(selectionPrompt);
      apiCounter.incrementGemini();
      const response = await result.response;

      const selectionData = this.parseGeminiJSON(response.text());
      if (selectionData && selectionData.selectedIndices && Array.isArray(selectionData.selectedIndices)) {
        const selectedPages = selectionData.selectedIndices
          .filter(index => index >= 1 && index <= searchResults.length)
          .map(index => searchResults[index - 1]);

        logger.info(`頁面選擇原因: ${selectionData.reason}`);
        return selectedPages.slice(0, count);
      } else {
        logger.error('頁面選擇JSON解析失敗，使用前N個頁面');
        return searchResults.slice(0, count);
      }

    } catch (error) {
      logger.error('Gemini頁面選擇錯誤:', error.message);
      return searchResults.slice(0, count);
    }
  }

  /**
   * 評估內容適用性
   */
  async evaluateContentSuitability(userMessage, pageContents, apiCounter) {
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

      const result = await geminiService.generateContent(evaluationPrompt);
      apiCounter.incrementGemini();
      const response = await result.response;

      const evaluationData = this.parseGeminiJSON(response.text(), { suitable: false, reason: 'JSON解析失敗' });
      logger.info(`內容適用性評估: ${evaluationData.suitable ? '✅' : '❌'} - ${evaluationData.reason}`);
      return evaluationData;

    } catch (error) {
      logger.error('Gemini適用性評估錯誤:', error.message);
      return { suitable: false, reason: `評估錯誤: ${error.message}` };
    }
  }

  /**
   * 生成最終回覆
   */
  async generateFinalResponse(userMessage, pageContents, apiCounter) {
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

      const result = await geminiService.generateContent(responsePrompt);
      apiCounter.incrementGemini();
      const response = await result.response;
      return response.text();

    } catch (error) {
      logger.error('生成最終回覆錯誤:', error.message);
      return `找到 ${pageContents.length} 筆相關資料，但整合回覆時發生錯誤：${error.message}`;
    }
  }

  /**
   * 解析 Gemini JSON 回覆
   */
  parseGeminiJSON(text, fallback = null) {
    try {
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanedText);
    } catch (error) {
      logger.error('JSON解析錯誤:', error.message);
      return fallback;
    }
  }
}

module.exports = new SearchService();