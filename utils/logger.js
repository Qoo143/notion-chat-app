// 簡潔的日誌系統
class SimpleLogger {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  /**
   * 格式化時間戳
   */
  timestamp() {
    return new Date().toLocaleString('zh-TW');
  }

  /**
   * INFO 日誌 - 一般資訊
   */
  info(message, data = null) {
    console.log(`[INFO] ${this.timestamp()} - ${message}`, data || '');
  }

  /**
   * 錯誤日誌
   */
  error(message, error = null) {
    console.error(`[ERROR] ${this.timestamp()} - ${message}`, error || '');
  }

  /**
   * 警告日誌
   */
  warn(message, data = null) {
    console.warn(`[WARN] ${this.timestamp()} - ${message}`, data || '');
  }

  /**
   * 除錯日誌 - 只在開發環境顯示
   */
  debug(message, data = null) {
    if (this.isDevelopment) {
      console.log(`[DEBUG] ${this.timestamp()} - ${message}`, data || '');
    }
  }
}

module.exports = new SimpleLogger();