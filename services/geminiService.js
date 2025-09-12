/**
 * @fileoverview Gemini AI 服務模組
 * @description 管理多個 Gemini API Keys，提供內容生成、錯誤處理和配額管理功能
 * @author Claude Code
 * @version 1.0.0
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Gemini AI 服務類別
 * @class GeminiService
 * @description 提供 Google Gemini AI 的完整服務管理，包含多 API Key 輪替、錯誤處理和狀態追蹤
 */
class GeminiService {
  /**
   * 初始化 Gemini 服務
   * @constructor
   * @description 載入 API Keys，初始化狀態追蹤，設定目前使用的模型
   */
  constructor() {
    /** @type {string[]} API Keys 陣列 */
    this.apiKeys = this.loadAPIKeys();
    /** @type {number} 目前使用的 API Key 索引 */
    this.currentKeyIndex = 0;
    /** @type {Map<number, Object>} 每個 API Key 的狀態追蹤 */
    this.keyStatus = new Map();

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

  /**
   * 從環境變數載入 API Keys
   * @method loadAPIKeys
   * @returns {string[]} API Keys 陣列
   * @description 支援主要和多個備用 API Keys，自動過濾空值
   */
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

    logger.info(`載入了 ${keys.length} 個 Gemini API Keys`);
    return keys;
  }

  /**
   * 初始化目前的 Gemini 模型
   * @method initializeCurrentModel
   * @throws {Error} 當沒有可用的 API Key 時拋出錯誤
   * @description 基於目前的 API Key 索引初始化 GoogleGenerativeAI 實例
   */
  initializeCurrentModel() {
    if (this.apiKeys.length === 0) {
      throw new Error('沒有可用的 Gemini API Key');
    }

    const currentKey = this.apiKeys[this.currentKeyIndex];
    this.genAI = new GoogleGenerativeAI(currentKey);
    this.model = this.genAI.getGenerativeModel({ model: config.gemini.model });

    logger.debug(`使用 API Key ${this.currentKeyIndex + 1}/${this.apiKeys.length}`);
  }

  /**
   * 生成 AI 內容
   * @method generateContent
   * @async
   * @param {string} prompt - 輸入的提示詞
   * @returns {Promise<Object>} Gemini AI 的生成結果
   * @throws {Error} 當所有 API Keys 都失敗時拋出錯誤
   * @description 嘗試使用目前的 API Key 生成內容，失敗時自動切換到下一個 Key
   */
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

        logger.debug(`API Key ${this.currentKeyIndex + 1} 成功調用 (今日第 ${status.dailyUsage} 次)`);
        return result;

      } catch (error) {
        lastError = error;
        logger.error(`API Key ${this.currentKeyIndex + 1} 調用失敗:`, error.message);

        // 更新錯誤狀態
        const status = this.keyStatus.get(this.currentKeyIndex);
        status.errorCount++;
        status.lastError = error.message;

        // 如果是配額錯誤，標記為不可用
        if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('exceeded')) {
          status.available = false;
          logger.warn(`API Key ${this.currentKeyIndex + 1} 配額已用完，切換到下一個`);
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

  /**
   * 切換到下一個可用的 API Key
   * @method switchToNextKey
   * @async
   * @description 循環尋找下一個可用的 API Key，如果都不可用則重置所有狀態
   */
  async switchToNextKey() {
    const originalIndex = this.currentKeyIndex;

    // 找到下一個可用的 key
    for (let i = 0; i < this.apiKeys.length; i++) {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      const status = this.keyStatus.get(this.currentKeyIndex);

      // 如果找到可用的 key，初始化並使用
      if (status.available) {
        this.initializeCurrentModel();
        logger.info(`切換到 API Key ${this.currentKeyIndex + 1}`);
        return;
      }
    }

    // 如果所有 key 都不可用，重置所有狀態（也許配額已重置）
    logger.warn('所有 API Keys 都不可用，重置狀態');
    this.keyStatus.forEach(status => {
      status.available = true;
      status.errorCount = 0;
    });

    this.currentKeyIndex = originalIndex;
    this.initializeCurrentModel();
  }

  /**
   * 獲取所有 API Keys 的狀態
   * @method getStatus
   * @returns {Array<Object>} API Keys 狀態陣列
   * @description 返回每個 API Key 的可用性、使用次數、錯誤計數等詳細資訊
   */
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

module.exports = new GeminiService();