const express = require('express');
const cors = require('cors');
const { Client } = require('@notionhq/client');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// 中介軟體
app.use(cors());
app.use(express.json());

// 初始化 API 客戶端
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// 存儲最近的搜尋結果（簡單的會話記憶）
let lastSearchResults = [];

// 使用 Gemini 智能分析用戶意圖和搜尋需求
async function analyzeUserIntentWithGemini(message) {
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
- 「幫我找安全相關筆記」→ {"needSearch": true, "intentType": "search", "searchKeywords": ["安全", "資安", "security", "防護", "漏洞"]}
- 「有沒有關於 Python 的資料」→ {"needSearch": true, "intentType": "search", "searchKeywords": ["Python", "程式", "編程", "代碼", "script"]}

只回覆 JSON，不要其他文字。
`;

    const result = await model.generateContent(intentPrompt);
    const response = await result.response;
    const responseText = response.text().trim();
    
    console.log('Gemini 意圖分析原始回覆:', responseText);
    
    // 嘗試解析 JSON
    try {
      const intentData = JSON.parse(responseText);
      console.log('解析後的意圖資料:', intentData);
      return intentData;
    } catch (parseError) {
      console.error('JSON 解析錯誤:', parseError);
      // 降級處理：簡單的關鍵字匹配
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
  
  const greetingKeywords = ['你好', 'hi', 'hello', '哈囉'];
  const searchKeywords = ['找', '搜尋', '查', '有沒有', '幫我找', '資料', '筆記', '文件'];
  
  if (greetingKeywords.some(keyword => msg.includes(keyword))) {
    return { needSearch: false, intentType: 'greeting' };
  }
  
  if (searchKeywords.some(keyword => msg.includes(keyword))) {
    return { needSearch: true, intentType: 'search', searchKeywords: [message] };
  }
  
  return { needSearch: false, intentType: 'chat' };
}

// 聊天端點
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: '請提供訊息內容' });
    }

    console.log(`收到訊息: ${message}`);
    
    // 使用 Gemini 分析用戶意圖
    const intent = await analyzeUserIntentWithGemini(message);
    console.log(`用戶意圖分析結果:`, intent);
    
    let response;
    
    if (intent.intentType === 'greeting') {
      // 問候回應
      response = '您好！我是您的 Notion 智能助手。我可以幫您搜尋筆記、回答問題，或進行一般對話。請隨時告訴我您需要什麼協助！';
      res.json({
        success: true,
        response: response,
        intent: intent.intentType
      });
      
    } else if (intent.needSearch && intent.searchKeywords && intent.searchKeywords.length > 0) {
      // 需要搜尋 Notion
      console.log(`執行智能搜尋，關鍵詞: ${intent.searchKeywords.join(', ')}`);
      
      // 1. 多關鍵詞搜尋 Notion
      const searchResults = await searchNotionPagesWithMultipleKeywords(intent.searchKeywords);
      console.log(`搜尋結果: ${searchResults.length} 個頁面`);
      
      if (searchResults.length === 0) {
        response = `抱歉，我在您的 Notion 工作區中沒有找到與「${message}」相關的筆記。您可能需要：\n\n1. 檢查 Notion Integration 是否有正確的頁面存取權限\n2. 確認相關內容確實存在於您的工作區中\n3. 嘗試使用不同的關鍵詞描述`;
        
        res.json({
          success: true,
          response: response,
          intent: intent.intentType,
          searchResults: [],
          searchKeywords: intent.searchKeywords
        });
      } else {
        // 2. 批量取得頁面內容
        const pageContents = await batchGetNotionPageContents(searchResults);
        console.log(`成功取得 ${pageContents.length} 個頁面的內容`);
        
        // 更新最近的搜尋結果
        lastSearchResults = searchResults;
        
        if (pageContents.length === 0) {
          // 有搜尋結果但無法讀取內容
          response = await generateResponseWithGemini(message, searchResults);
        } else {
          // 3. 生成整合精煉回覆
          response = await generateIntegratedResponseWithGemini(message, pageContents);
        }
        
        res.json({
          success: true,
          response: response,
          intent: intent.intentType,
          searchResults: searchResults,
          searchKeywords: intent.searchKeywords,
          contentCount: pageContents.length
        });
      }
      
    } else {
      // 一般對話，不需要搜尋 Notion
      console.log('執行一般對話模式');
      
      const chatPrompt = `用戶說：「${message}」

請以友善、有幫助的方式用繁體中文回覆。你是一個智能助手，可以回答各種問題、提供建議或進行對話。如果用戶之後想要搜尋 Notion 筆記，你也可以協助他們。`;
      
      try {
        const result = await model.generateContent(chatPrompt);
        const chatResponse = await result.response;
        response = chatResponse.text();
      } catch (error) {
        console.error('一般對話 Gemini 錯誤:', error);
        response = '抱歉，我現在無法正常回應。請稍後再試，或者告訴我您想要搜尋什麼 Notion 內容。';
      }
      
      res.json({
        success: true,
        response: response,
        intent: intent.intentType
      });
    }

  } catch (error) {
    console.error('處理聊天請求時發生錯誤:', error);
    res.status(500).json({
      error: '伺服器內部錯誤',
      details: error.message
    });
  }
});

// 多關鍵詞搜尋 Notion 頁面
async function searchNotionPagesWithMultipleKeywords(keywords) {
  try {
    console.log(`開始多關鍵詞搜尋 Notion: ${keywords.join(', ')}`);
    
    const allResults = new Map(); // 使用 Map 去重複
    
    // 對每個關鍵詞進行搜尋
    for (const keyword of keywords) {
      console.log(`搜尋關鍵詞: "${keyword}"`);
      
      const response = await notion.search({
        query: keyword,
        page_size: 10,
      });
      
      console.log(`關鍵詞 "${keyword}" 找到 ${response.results.length} 個結果`);
      
      // 將結果加入到總結果中（使用頁面 ID 去重複）
      response.results.forEach(page => {
        if (!allResults.has(page.id)) {
          let title = 'Untitled';
          
          // 取得頁面標題
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
          
          allResults.set(page.id, {
            id: page.id,
            title: title,
            url: page.url,
            created_time: page.created_time,
            last_edited_time: page.last_edited_time,
            matchedKeyword: keyword // 記錄匹配的關鍵詞
          });
        }
      });
    }
    
    const finalResults = Array.from(allResults.values());
    console.log(`總共找到 ${finalResults.length} 個不重複的頁面`);
    
    return finalResults;
    
  } catch (error) {
    console.error('多關鍵詞搜尋錯誤:', error);
    return [];
  }
}

// 搜尋 Notion 頁面（單一關鍵詞，保留向後相容）
async function searchNotionPages(query) {
  try {
    console.log(`開始搜尋 Notion: "${query}"`);
    
    const response = await notion.search({
      query: query,
      page_size: 10,
    });

    console.log(`Notion 搜尋結果: 找到 ${response.results.length} 個項目`);
    
    if (response.results.length === 0) {
      console.log('沒有找到任何結果 - 可能的原因:');
      console.log('1. Integration 沒有分享到包含此內容的頁面');
      console.log('2. 搜尋關鍵字不匹配');
      console.log('3. 工作區中沒有相關內容');
    }

    const results = response.results.map(page => {
      let title = 'Untitled';
      
      // 取得頁面標題 - 改善標題提取邏輯
      if (page.properties) {
        const titleProperty = Object.values(page.properties).find(
          prop => prop.type === 'title'
        );
        if (titleProperty && titleProperty.title && titleProperty.title.length > 0) {
          title = titleProperty.title.map(t => t.plain_text).join('');
        }
      }
      
      // 如果還是沒有標題，嘗試從其他地方取得
      if (title === 'Untitled' && page.title) {
        title = page.title;
      }
      
      console.log(`找到頁面: ${title} (${page.id})`);

      return {
        id: page.id,
        title: title,
        url: page.url,
        created_time: page.created_time,
        last_edited_time: page.last_edited_time
      };
    });

    return results;

  } catch (error) {
    console.error('Notion API 搜尋錯誤:', error);
    console.error('錯誤詳細資訊:', {
      message: error.message,
      code: error.code,
      status: error.status
    });
    return [];
  }
}

// 批量取得頁面內容
async function batchGetNotionPageContents(pages, maxPages = 5) {
  try {
    console.log(`開始批量取得 ${Math.min(pages.length, maxPages)} 個頁面的內容`);
    
    const pagesToProcess = pages.slice(0, maxPages);
    const pageContents = [];
    
    for (const page of pagesToProcess) {
      console.log(`取得頁面內容: ${page.title} (${page.id})`);
      
      try {
        const content = await getNotionPageContent(page.id);
        if (content && content.trim()) {
          pageContents.push({
            ...page,
            content: content,
            contentLength: content.length
          });
        } else {
          console.log(`頁面 "${page.title}" 內容為空或無法讀取`);
        }
      } catch (error) {
        console.error(`取得頁面 "${page.title}" 內容失敗:`, error.message);
      }
    }
    
    console.log(`成功取得 ${pageContents.length} 個頁面的內容`);
    return pageContents;
    
  } catch (error) {
    console.error('批量取得頁面內容錯誤:', error);
    return [];
  }
}

// 整合多個頁面內容並生成精煉回覆
async function generateIntegratedResponseWithGemini(userMessage, pageContents) {
  try {
    if (pageContents.length === 0) {
      return '抱歉，沒有找到相關的筆記內容。';
    }
    
    console.log(`開始整合 ${pageContents.length} 個頁面的內容`);
    
    // 構建整合內容
    let aggregatedContent = `用戶問題：「${userMessage}」\n\n找到以下相關資料：\n\n`;
    
    pageContents.forEach((page, index) => {
      aggregatedContent += `=== 資料 ${index + 1}：${page.title} ===\n`;
      aggregatedContent += `匹配關鍵詞：${page.matchedKeyword || '直接搜尋'}\n`;
      aggregatedContent += `網址：${page.url}\n`;
      aggregatedContent += `內容：\n${page.content.substring(0, 3000)}${page.content.length > 3000 ? '...' : ''}\n\n`;
    });
    
    const integrationPrompt = `
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

    const result = await model.generateContent(integrationPrompt);
    const response = await result.response;
    
    console.log('整合回覆生成完成');
    return response.text();
    
  } catch (error) {
    console.error('生成整合回覆錯誤:', error);
    
    // 降級處理：提供基本資訊
    let fallbackResponse = `找到 ${pageContents.length} 筆相關資料：\n\n`;
    
    pageContents.forEach((page, index) => {
      fallbackResponse += `${index + 1}. **${page.title}**\n`;
      fallbackResponse += `   網址：${page.url}\n`;
      if (page.matchedKeyword) {
        fallbackResponse += `   匹配關鍵詞：${page.matchedKeyword}\n`;
      }
      fallbackResponse += `   內容預覽：${page.content.substring(0, 200)}...\n\n`;
    });
    
    return fallbackResponse;
  }
}

// 使用 Gemini 生成回覆（保留向後相容）
async function generateResponseWithGemini(userMessage, notionResults) {
  try {
    const prompt = `
用戶詢問：「${userMessage}」

我在 Notion 中找到以下相關結果：
${JSON.stringify(notionResults, null, 2)}

請根據搜尋結果，用自然、友善的中文回覆用戶。如果有找到相關筆記，請列出標題和連結。如果沒有找到相關結果，請禮貌地告知用戶。

回覆格式範例：
找到 2 筆相關筆記：
1. Python 入門教學 (https://notion.so/xxx)
2. Python 資料處理技巧 (https://notion.so/yyy)
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error('Gemini API 錯誤:', error);
    
    // 如果 Gemini 失敗，提供基本回覆
    if (notionResults.length > 0) {
      let basicResponse = `找到 ${notionResults.length} 筆相關筆記：\n`;
      notionResults.forEach((item, index) => {
        basicResponse += `${index + 1}. ${item.title} (${item.url})\n`;
      });
      return basicResponse;
    } else {
      return '抱歉，沒有找到相關的筆記。';
    }
  }
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
        throw new Error('權限不足：Integration 需要 "Read content" 權限，請檢查 Notion Integration 設定');
      } else if (pageError.status === 404) {
        throw new Error('頁面不存在或 Integration 沒有存取權限');
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
async function extractAllBlocksRecursively(blockId, depth = 0, maxDepth = 3) {
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
    
    const result = await model.generateContent(analysisPrompt);
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
      gemini_key: process.env.GEMINI_API_KEY ? 'Set' : 'Missing'
    }
  });
});

app.listen(PORT, () => {
  console.log(`伺服器運行在 http://localhost:${PORT}`);
});