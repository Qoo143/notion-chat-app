// 配置驗證器
class ConfigValidator {
  constructor() {
    this.requiredEnvVars = [
      'NOTION_TOKEN',
      'GEMINI_API_KEY'
    ];
    
    this.optionalEnvVars = [
      'GEMINI_API_KEY_2',
      'GEMINI_API_KEY_3',
      'PORT',
      'HOST',
      'API_BASE_URL',
      'CORS_ORIGIN'
    ];
  }

  /**
   * 驗證所有必要的環境變數
   * @throws {Error} 當缺少必要環境變數時
   */
  validateRequired() {
    const missing = this.requiredEnvVars.filter(key => !process.env[key] || process.env[key].trim() === '');
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}\nPlease check your .env file.`);
    }
  }

  /**
   * 獲取並驗證 PORT 配置
   * @returns {number} 驗證後的端口號
   */
  getValidatedPort() {
    const portStr = process.env.PORT || '3002';
    const port = parseInt(portStr, 10);
    
    if (isNaN(port)) {
      throw new Error(`PORT must be a number, got: ${portStr}`);
    }
    
    if (port < 1024 || port > 65535) {
      throw new Error(`PORT must be between 1024 and 65535, got: ${port}`);
    }
    
    return port;
  }

  /**
   * 獲取並驗證 Notion Token
   * @returns {string} 驗證後的 Token
   */
  getValidatedNotionToken() {
    const token = process.env.NOTION_TOKEN;
    
    if (!token.startsWith('ntn_')) {
      throw new Error('NOTION_TOKEN must start with "ntn_"');
    }
    
    if (token.length < 40) {
      throw new Error('NOTION_TOKEN appears to be invalid (too short)');
    }
    
    return token;
  }

  /**
   * 獲取並驗證 Gemini API Keys
   * @returns {string[]} 驗證後的 API Keys 陣列
   */
  getValidatedGeminiKeys() {
    const keys = [];
    
    // 主要 API Key (必須)
    const primaryKey = process.env.GEMINI_API_KEY;
    if (!primaryKey.startsWith('AIzaSy')) {
      throw new Error('GEMINI_API_KEY must start with "AIzaSy"');
    }
    keys.push(primaryKey);
    
    // 備用 API Keys (可選)
    [2, 3].forEach(num => {
      const key = process.env[`GEMINI_API_KEY_${num}`];
      if (key) {
        if (!key.startsWith('AIzaSy')) {
          throw new Error(`GEMINI_API_KEY_${num} must start with "AIzaSy"`);
        }
        keys.push(key);
      }
    });
    
    return keys;
  }

  /**
   * 獲取並驗證 HOST 配置
   * @returns {string} 驗證後的主機地址
   */
  getValidatedHost() {
    const host = process.env.HOST || 'localhost';
    
    // 基本 HOST 格式驗證
    const validHostPattern = /^(localhost|[\d\.]+|[\w\.-]+)$/;
    if (!validHostPattern.test(host)) {
      throw new Error(`Invalid HOST format: ${host}`);
    }
    
    return host;
  }

  /**
   * 獲取 API Base URL
   * @returns {string} API 基礎 URL
   */
  getAPIBaseURL() {
    // 如果有自定義 API_BASE_URL，直接使用
    if (process.env.API_BASE_URL) {
      const url = process.env.API_BASE_URL;
      try {
        new URL(url); // 驗證 URL 格式
        return url;
      } catch (error) {
        throw new Error(`Invalid API_BASE_URL format: ${url}`);
      }
    }
    
    // 否則根據 HOST 和 PORT 構建
    const host = this.getValidatedHost();
    const port = this.getValidatedPort();
    const protocol = process.env.NODE_ENV === 'production' && host !== 'localhost' ? 'https' : 'http';
    
    return `${protocol}://${host}:${port}`;
  }

  /**
   * 獲取 CORS 配置
   * @returns {string|boolean} CORS 來源配置
   */
  getCORSOrigin() {
    const origin = process.env.CORS_ORIGIN;
    
    if (!origin) {
      // 開發環境預設允許所有 localhost
      return process.env.NODE_ENV === 'development' ? true : false;
    }
    
    // 支援多個來源，用逗號分隔
    if (origin.includes(',')) {
      return origin.split(',').map(o => o.trim());
    }
    
    return origin;
  }

  /**
   * 執行完整的配置驗證
   * @returns {Object} 驗證後的配置物件
   */
  validate() {
    try {
      this.validateRequired();
      
      return {
        port: this.getValidatedPort(),
        host: this.getValidatedHost(),
        apiBaseUrl: this.getAPIBaseURL(),
        corsOrigin: this.getCORSOrigin(),
        notionToken: this.getValidatedNotionToken(),
        geminiKeys: this.getValidatedGeminiKeys(),
        nodeEnv: process.env.NODE_ENV || 'development'
      };
    } catch (error) {
      console.error('❌ Configuration validation failed:');
      console.error(error.message);
      console.error('\n💡 Please check your .env file and restart the application.');
      process.exit(1);
    }
  }
}

module.exports = new ConfigValidator();