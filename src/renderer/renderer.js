// 透過 preload 腳本安全地存取 Electron API

class ChatApp {
    constructor() {
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatMessages = document.getElementById('chatMessages');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.searchModeSelect = document.getElementById('searchModeSelect');
        this.costIndicator = document.getElementById('costIndicator');
        
        // 配置會在 init 中載入
        this.config = null;
        
        this.init();
    }

    async init() {
        // 載入配置
        await this.loadConfig();
        
        // 設置歡迎訊息時間
        document.getElementById('welcomeTime').textContent = this.formatTime(new Date());
        
        // 綁定事件監聽器
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // 自動聚焦到輸入框
        this.messageInput.focus();
        
        // 初始化搜尋模式選擇器
        this.initSearchModeSelector();
        
        // 檢查伺服器狀態
        this.checkServerStatus();
    }

    async loadConfig() {
        try {
            this.config = await window.electronAPI.getConfig();
            console.log('配置載入成功:', this.config);
        } catch (error) {
            console.error('配置載入失敗:', error);
            // 使用預設配置
            this.config = { apiBaseUrl: 'http://localhost:3002' };
        }
    }

    async checkServerStatus() {
        this.updateStatus('connecting', '檢查連線...');
        
        try {
            const healthUrl = `${this.config.apiBaseUrl}/health`;
            console.log('檢查伺服器狀態:', healthUrl);
            const response = await fetch(healthUrl);
            if (response.ok) {
                this.updateStatus('ready', '已連線');
            } else {
                throw new Error('伺服器回應異常');
            }
        } catch (error) {
            this.updateStatus('error', '伺服器離線');
            console.error('伺服器連線檢查失敗:', error);
        }
    }

    initSearchModeSelector() {
        // 監聽搜尋模式變更
        this.searchModeSelect.addEventListener('change', () => {
            this.updateCostIndicator();
        });
        
        // 初始化成本指示器
        this.updateCostIndicator();
    }
    
    updateCostIndicator() {
        const mode = parseInt(this.searchModeSelect.value);
        const costMap = {
            1: { text: '🟢 低成本', class: 'cost-low' },
            2: { text: '🟡 中成本', class: 'cost-medium' },
            3: { text: '🔴 高成本', class: 'cost-high' }
        };
        
        const costInfo = costMap[mode];
        this.costIndicator.textContent = costInfo.text;
        this.costIndicator.className = `cost-indicator ${costInfo.class}`;
    }

    updateStatus(status, text) {
        const dot = this.statusIndicator.querySelector('.status-dot');
        
        // 移除所有狀態類別
        dot.classList.remove('connecting', 'error');
        
        // 添加新的狀態類別
        if (status !== 'ready') {
            dot.classList.add(status);
        }
        
        this.statusText.textContent = text;
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        // 清空輸入框並禁用按鈕
        this.messageInput.value = '';
        this.toggleInputs(false);
        
        // 顯示用戶訊息
        this.addMessage(message, 'user');
        
        // 顯示載入中訊息
        const loadingMessage = this.addLoadingMessage();
        
        // 更新狀態
        this.updateStatus('connecting', '處理中...');

        try {
            // 獲取當前搜尋模式
            const maxRounds = parseInt(this.searchModeSelect.value);
            
            // 發送到後端（包含搜尋模式參數）
            const result = await window.electronAPI.sendMessage({ message, maxRounds });
            
            // 移除載入訊息
            this.removeMessage(loadingMessage);
            
            if (result.success) {
                // 顯示回覆
                let messageContent = result.data.response;
                
                // 如果有API統計資訊，添加到回覆末尾
                if (result.data.apiStats) {
                    const stats = result.data.apiStats;
                    messageContent += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                    messageContent += `📊 **API 調用統計**\n`;
                    messageContent += `• Notion API: ${stats.notionCalls} 次\n`;
                    messageContent += `• Gemini AI: ${stats.geminiCalls} 次\n`;
                    messageContent += `• 總調用次數: ${stats.totalCalls} 次\n`;
                    messageContent += `• 處理時間: ${stats.duration} 秒`;
                    
                    // 如果有輪數資訊，也顯示
                    if (result.data.rounds && Array.isArray(result.data.rounds)) {
                        const maxRounds = result.data.maxRounds || '未知';
                        const actualRounds = result.data.actualRounds || result.data.rounds.length;
                        messageContent += `\n• 搜索設定: ${maxRounds} 輪最大`;
                        messageContent += `\n• 實際執行: ${actualRounds} 輪`;
                    }
                }
                
                this.addMessage(messageContent, 'bot');
                this.updateStatus('ready', '已連線');
            } else {
                // 顯示錯誤
                this.addMessage(`錯誤：${result.error}`, 'bot', true);
                this.updateStatus('error', '請求失敗');
            }
            
        } catch (error) {
            // 移除載入訊息並顯示錯誤
            this.removeMessage(loadingMessage);
            this.addMessage('發送訊息時發生錯誤，請檢查網路連線', 'bot', true);
            this.updateStatus('error', '連線錯誤');
            console.error('發送訊息錯誤:', error);
        }
        
        // 重新啟用輸入
        this.toggleInputs(true);
        this.messageInput.focus();
    }

    addMessage(content, sender, isError = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        if (isError) {
            contentDiv.classList.add('error-message');
        }
        
        // 處理文本，將 URL 轉換為可點擊的連結
        const processedContent = this.processLinks(content);
        contentDiv.innerHTML = processedContent;
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = this.formatTime(new Date());
        
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timeDiv);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        
        return messageDiv;
    }

    addLoadingMessage() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content loading-message';
        contentDiv.innerHTML = `
            正在搜尋...
            <div class="loading-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        
        messageDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        
        return messageDiv;
    }

    removeMessage(messageElement) {
        if (messageElement && messageElement.parentNode) {
            messageElement.parentNode.removeChild(messageElement);
        }
    }

    processLinks(text) {
        let processed = text;
        
        // 1. 轉換換行符號為 <br>
        processed = processed.replace(/\n/g, '<br>');
        
        // 2. 處理 Markdown 粗體 **text**
        processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // 3. 處理項目符號列表
        processed = processed.replace(/^•\s(.+)$/gm, '<div class="bullet-item">• $1</div>');
        processed = processed.replace(/^\d+\.\s(.+)$/gm, '<div class="numbered-item">$1</div>');
        
        // 4. 處理標題
        processed = processed.replace(/^###\s(.+)$/gm, '<h3 class="message-h3">$1</h3>');
        processed = processed.replace(/^##\s(.+)$/gm, '<h2 class="message-h2">$1</h2>');
        processed = processed.replace(/^#\s(.+)$/gm, '<h1 class="message-h1">$1</h1>');
        
        // 5. 處理分隔線
        processed = processed.replace(/^[═─━]{3,}$/gm, '<hr class="message-separator">');
        
        // 6. 處理 emoji 開頭的重要區塊
        processed = processed.replace(/^(📚|📄|🔗|📝|💬|🖼️|🎥|📎|🔖)\s\*\*(.*?)\*\*：?$/gm, 
            '<div class="info-block"><span class="emoji">$1</span> <strong>$2</strong></div>');
        
        // 7. 處理縮排內容
        processed = processed.replace(/^    (.+)$/gm, '<div class="indented-content">$1</div>');
        
        // 8. 將 URL 轉換為可點擊的連結（放在最後以避免干擾其他格式）
        const urlRegex = /(https?:\/\/[^\s<>\)]+)/g;
        processed = processed.replace(urlRegex, (url) => {
            const cleanUrl = url.replace(/[.,;!?)]+$/, '');
            return `<a href="${cleanUrl}" class="notion-link" target="_blank">${cleanUrl}</a>`;
        });
        
        // 9. 處理參考資料區塊
        processed = processed.replace(
            /📚\s\*\*參考資料：\*\*/g, 
            '<div class="reference-section"><strong>📚 參考資料：</strong></div>'
        );
        
        return processed;
    }

    toggleInputs(enabled) {
        this.messageInput.disabled = !enabled;
        this.sendButton.disabled = !enabled;
        this.searchModeSelect.disabled = !enabled;
    }

    formatTime(date) {
        return date.toLocaleTimeString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }
}

// 當 DOM 載入完成時初始化應用
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});