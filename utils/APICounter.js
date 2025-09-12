/**
 * API 調用計數器
 * 用於追蹤和統計 API 調用次數與執行時間
 */
class APICounter {
  constructor() {
    this.notionCalls = 0;      // Notion API 調用次數
    this.geminiCalls = 0;      // Gemini AI API 調用次數
    this.startTime = Date.now(); // 開始時間戳記
  }

  /**
   * 增加 Notion API 調用計數
   */
  incrementNotion() {
    this.notionCalls++;
  }

  /**
   * 增加 Gemini AI API 調用計數
   */
  incrementGemini() {
    this.geminiCalls++;
  }

  /**
   * 獲取統計資訊
   * @returns {Object} 包含調用次數和執行時間的統計物件
   */
  getStats() {
    return {
      notionCalls: this.notionCalls,           // Notion API 調用次數
      geminiCalls: this.geminiCalls,           // Gemini AI 調用次數
      totalCalls: this.notionCalls + this.geminiCalls,  // 總調用次數
      duration: ((Date.now() - this.startTime) / 1000).toFixed(2)  // 執行時間(秒)
    };
  }

  /**
   * 重置計數器
   */
  reset() {
    this.notionCalls = 0;
    this.geminiCalls = 0;
    this.startTime = Date.now();
  }

  /**
   * 獲取平均調用速率（每秒調用次數）
   * @returns {number} 每秒平均調用次數
   */
  getCallRate() {
    const duration = (Date.now() - this.startTime) / 1000;
    const totalCalls = this.notionCalls + this.geminiCalls;
    return duration > 0 ? (totalCalls / duration).toFixed(2) : 0;
  }
}

module.exports = APICounter;