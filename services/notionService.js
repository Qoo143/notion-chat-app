// Notion 服務
const { Client } = require('@notionhq/client');
const config = require('../config');
const logger = require('../utils/logger');

class NotionService {
  constructor() {
    this.client = new Client({
      auth: process.env.NOTION_TOKEN,
    });
    this.rateLimitDelayMs = config.notion.content.rateLimitDelay;
  }

  /**
   * 基本搜索功能
   */
  async performBasicSearch(keywords, apiCounter) {
    const allResults = new Map();

    for (const keyword of keywords) {
      logger.debug(`🔍 搜索關鍵詞: "${keyword}"`);

      try {
        await this.rateLimitDelay();
        const response = await this.client.search({
          query: keyword,
          page_size: config.notion.search.pageSize,
        });

        apiCounter.incrementNotion();

        response.results.forEach(page => {
          if (!allResults.has(page.id)) {
            const pageInfo = this.extractPageInfo(page);
            pageInfo.matchedKeyword = keyword;
            allResults.set(page.id, pageInfo);
          }
        });
      } catch (error) {
        logger.error(`搜索關鍵詞 "${keyword}" 失敗:`, error.message);
      }
    }

    return Array.from(allResults.values());
  }

  /**
   * 批次獲取所選頁面的內容
   */
  async batchGetSelectedPageContents(selectedPages, apiCounter) {
    const pageContents = [];

    for (const selectedPage of selectedPages) {
      try {
        await this.rateLimitDelay();
        const pageContent = await this.getPageContent(selectedPage.pageId, apiCounter);
        if (pageContent) {
          pageContents.push(pageContent);
        }
      } catch (error) {
        logger.error(`讀取頁面 ${selectedPage.title} 失敗:`, error.message);
      }
    }

    return pageContents;
  }

  /**
   * 獲取頁面內容
   */
  async getPageContent(pageId, apiCounter) {
    try {
      // 獲取頁面資訊
      const page = await this.client.pages.retrieve({ page_id: pageId });
      apiCounter.incrementNotion();

      let title = '';
      if (page.properties && page.properties.title) {
        title = page.properties.title.title?.[0]?.plain_text || '未命名頁面';
      } else {
        title = '未命名頁面';
      }

      // 獲取頁面內容區塊
      const blocks = await this.client.blocks.children.list({
        block_id: pageId,
        page_size: config.notion.content.maxBlocksPerPage,
      });
      apiCounter.incrementNotion();

      // 遞歸提取所有區塊內容
      const content = await this.extractAllBlocksContent(blocks.results, apiCounter);

      return {
        pageId,
        title,
        content,
        url: page.url
      };
    } catch (error) {
      logger.error(`獲取頁面內容失敗:`, error.message);
      return null;
    }
  }

  /**
   * 遞歸擷取所有區塊內容
   * @method extractAllBlocksContent
   * @async
   * @param {Array<Object>} blocks - Notion 區塊陣列
   * @param {Object} apiCounter - API 調用計數器
   * @param {number} [currentDepth=0] - 目前遞歸深度
   * @returns {Promise<string>} 擷取的文字內容
   * @description 遞歸處理所有區塊及其子區塊，有最大深度限制
   */
  async extractAllBlocksContent(blocks, apiCounter, currentDepth = 0) {
    let content = '';
    const maxDepth = config.notion.content.maxRecursiveDepth;

    for (const block of blocks) {
      const blockText = this.extractBlockText(block, currentDepth);
      if (blockText) {
        content += blockText + '\n';
      }

      // 遞歸處理子區塊（但有深度限制）
      if (block.has_children && currentDepth < maxDepth) {
        try {
          await this.rateLimitDelay();
          const childBlocks = await this.client.blocks.children.list({
            block_id: block.id,
          });
          apiCounter.incrementNotion();

          const childContent = await this.extractAllBlocksContent(
            childBlocks.results,
            apiCounter,
            currentDepth + 1
          );
          if (childContent) {
            content += childContent;
          }
        } catch (error) {
          logger.error(`讀取子區塊失敗:`, error.message);
        }
      }
    }

    return content;
  }

  /**
   * 提取區塊文字內容
   */
  extractBlockText(block, depth = 0) {
    const indent = '  '.repeat(depth);

    try {
      switch (block.type) {
        case 'paragraph':
          if (block.paragraph?.rich_text) {
            return indent + this.extractRichText(block.paragraph.rich_text);
          }
          break;

        case 'heading_1':
          if (block.heading_1?.rich_text) {
            return indent + '# ' + this.extractRichText(block.heading_1.rich_text);
          }
          break;

        case 'heading_2':
          if (block.heading_2?.rich_text) {
            return indent + '## ' + this.extractRichText(block.heading_2.rich_text);
          }
          break;

        case 'heading_3':
          if (block.heading_3?.rich_text) {
            return indent + '### ' + this.extractRichText(block.heading_3.rich_text);
          }
          break;

        case 'bulleted_list_item':
          if (block.bulleted_list_item?.rich_text) {
            return indent + '• ' + this.extractRichText(block.bulleted_list_item.rich_text);
          }
          break;

        case 'numbered_list_item':
          if (block.numbered_list_item?.rich_text) {
            return indent + '1. ' + this.extractRichText(block.numbered_list_item.rich_text);
          }
          break;

        case 'to_do':
          if (block.to_do?.rich_text) {
            const checked = block.to_do.checked ? '✓' : '○';
            return indent + `${checked} ` + this.extractRichText(block.to_do.rich_text);
          }
          break;

        case 'toggle':
          if (block.toggle?.rich_text) {
            return indent + '▶ ' + this.extractRichText(block.toggle.rich_text);
          }
          break;

        case 'quote':
          if (block.quote?.rich_text) {
            return indent + '> ' + this.extractRichText(block.quote.rich_text);
          }
          break;

        case 'callout':
          if (block.callout?.rich_text) {
            const icon = block.callout.icon?.emoji || '💡';
            return indent + `${icon} ` + this.extractRichText(block.callout.rich_text);
          }
          break;

        case 'code':
          if (block.code?.rich_text) {
            const language = block.code.language || '';
            const code = this.extractRichText(block.code.rich_text);
            return indent + `\`\`\`${language}\n${code}\n\`\`\``;
          }
          break;

        case 'divider':
          return indent + '---';

        case 'table':
          return indent + '[表格內容]';

        case 'image':
          const imageUrl = block.image?.external?.url || block.image?.file?.url;
          return indent + `![圖片](${imageUrl})`;

        case 'video':
          const videoUrl = block.video?.external?.url || block.video?.file?.url;
          return indent + `[影片：${videoUrl}]`;

        case 'file':
          const fileUrl = block.file?.external?.url || block.file?.file?.url;
          const fileName = block.file?.name || '檔案';
          return indent + `[檔案：${fileName}](${fileUrl})`;

        case 'bookmark':
          const bookmarkUrl = block.bookmark?.url;
          return indent + `[書籤：${bookmarkUrl}](${bookmarkUrl})`;

        case 'link_preview':
          const linkUrl = block.link_preview?.url;
          return indent + `[連結預覽：${linkUrl}]`;

        default:
          return '';
      }
    } catch (error) {
      logger.error(`提取區塊內容錯誤:`, error.message);
      return '';
    }

    return '';
  }

  /**
   * 提取富文本內容
   */
  extractRichText(richTextArray) {
    if (!Array.isArray(richTextArray)) return '';
    
    return richTextArray
      .map(text => text.plain_text || '')
      .join('')
      .trim();
  }

  /**
   * 提取頁面基本資訊
   */
  extractPageInfo(page) {
    let title = '未命名頁面';
    
    if (page.properties) {
      // 尋找標題屬性
      const titleProperty = Object.values(page.properties).find(
        prop => prop.type === 'title'
      );
      
      if (titleProperty?.title?.[0]?.plain_text) {
        title = titleProperty.title[0].plain_text;
      }
    }

    return {
      pageId: page.id,
      title: title,
      url: page.url,
      lastEdited: page.last_edited_time,
      createdTime: page.created_time
    };
  }

  /**
   * 速率限制延遲
   * @method rateLimitDelay
   * @async
   * @returns {Promise<void>} 延遲 Promise
   * @description 根據配置的延遲時間進行等待，避免 Notion API 速率限制
   */
  async rateLimitDelay() {
    return new Promise(resolve => setTimeout(resolve, this.rateLimitDelayMs));
  }
}

module.exports = new NotionService();