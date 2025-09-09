// 使用者介面配置
module.exports = {
  // 訊息設定
  messages: {
    greeting: '您好！我是您的 Notion 智能助手。我可以幫您搜尋筆記、回答問題，或進行一般對話。請隨時告訴我您需要什麼協助！',
    
    // 錯誤訊息
    errors: {
      serverConnection: '無法連接到伺服器',
      notionPermission: '權限不足：Integration 需要 "Read content" 權限，請檢查 Notion Integration 設定',
      pageNotFound: '頁面不存在或 Integration 沒有存取權限',
      contentReadError: '無法讀取頁面內容',
      aiProcessingError: '抱歉，我現在無法正常回應。請稍後再試，或者告訴我您想要搜尋什麼 Notion 內容。'
    },
    
    // 搜尋失敗建議
    searchFailureSuggestions: [
      '檢查 Notion Integration 是否有正確的頁面存取權限',
      '確認相關內容確實存在於您的工作區中',
      '嘗試使用不同的關鍵詞或描述方式',
      '確保要查找的資料已經儲存在 Notion 中'
    ]
  },
  
  // 格式化設定
  formatting: {
    // 分隔線設定
    dividers: {
      major: '═'.repeat(60),      // 主要標題分隔線
      medium: '='.repeat(40),     // 次要標題分隔線
      minor: '-'.repeat(30),      // 三級標題分隔線
      section: '━'.repeat(80),    // 區段分隔線
      code: '`'.repeat(50)        // 程式碼區塊分隔線
    },
    
    // 表情符號設定
    icons: {
      page: '📖',
      database: '🗄️',
      image: '🖼️',
      video: '🎥',
      file: '📎',
      pdf: '📄',
      bookmark: '🔖',
      link: '🔗',
      code: '💻',
      quote: '💬',
      callout: '📝',
      toggle: '🔽',
      table: '📊',
      todo: {
        checked: '☑️',
        unchecked: '☐'
      }
    }
  }
};