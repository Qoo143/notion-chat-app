class ChatApp {
    constructor() {
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatMessages = document.getElementById('chatMessages');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.searchModeSelect = document.getElementById('searchModeSelect');
        this.costIndicator = document.getElementById('costIndicator');
        
        this.config = {
            apiBaseUrl: '',  // 使用相對路徑，因為前後端同域
            isDevelopment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        };
        
        this.init();
    }

    async init() {
        
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


    async checkServerStatus() {
        this.updateStatus('connecting', '檢查連線...');
        
        try {
            const healthUrl = `${this.config.apiBaseUrl}/api/health`;
            if (this.config.isDevelopment) {
                console.log('檢查伺服器狀態:', healthUrl);
            }
            const response = await fetch(healthUrl);
            if (response.ok) {
                this.updateStatus('ready', '已連線');
            } else {
                throw new Error('伺服器回應異常');
            }
        } catch (error) {
            this.updateStatus('error', '伺服器離線');
            if (this.config.isDevelopment) {
                console.error('伺服器連線檢查失敗:', error);
            }
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
            const response = await axios.post(`${this.config.apiBaseUrl}/api/chat`, { 
                message, 
                maxRounds 
            }, {
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
            
            // 移除載入訊息
            this.removeMessage(loadingMessage);
            
            // axios 回應的 response.data 就是後端回應本體
            const data = response.data;
            
            if (data && data.success) {
                // 顯示回覆
                let messageContent = data.response;
                
                // 如果有API統計資訊，添加到回覆末尾
                if (data.apiStats) {
                    const stats = data.apiStats;
                    messageContent += `📊 **API 調用統計**\n`;
                    messageContent += `• Notion API: ${stats.notionCalls} 次\n`;
                    messageContent += `• Gemini AI: ${stats.geminiCalls} 次\n`;
                    messageContent += `• 總調用次數: ${stats.totalCalls} 次\n`;
                    messageContent += `• 處理時間: ${stats.duration} 秒`;
                    
                    // 如果有輪數資訊，也顯示
                    if (data.rounds && Array.isArray(data.rounds)) {
                        const maxRounds = data.maxRounds || '未知';
                        const actualRounds = data.actualRounds || data.rounds.length;
                        messageContent += `\n• 搜索設定: ${maxRounds} 輪最大`;
                        messageContent += `\n• 實際執行: ${actualRounds} 輪`;
                    }
                }
                
                this.addMessage(messageContent, 'bot');
                this.updateStatus('ready', '已連線');
            } else {
                // 處理非成功回應 - 顯示搜尋失敗的詳細訊息
                const failureMessage = data?.response || data?.error || '未知錯誤';
                this.addMessage(failureMessage, 'bot');
                this.updateStatus('ready', '搜尋完成（無合適結果）');
            }
            
        } catch (error) {
            // 移除載入訊息並顯示錯誤
            this.removeMessage(loadingMessage);
            
            let errorMessage = '發送訊息時發生錯誤';
            if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            this.addMessage(`錯誤：${errorMessage}`, 'bot', true);
            this.updateStatus('error', '連線錯誤');
            if (this.config.isDevelopment) {
                console.error('發送訊息錯誤:', error);
            }
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
            正在搜尋
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
        
        if (this.config.isDevelopment) {
            console.log('🔍 [DEBUG] 原始內容:', text);
            console.log('🔍 [DEBUG] 原始內容長度:', text.length);
        }
        
        // 1. 先轉義HTML特殊字符，避免被瀏覽器錯誤解析
        processed = processed.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // 2. 轉換換行符號為 <br>
        processed = processed.replace(/\n/g, '<br>');
        if (this.config.isDevelopment) {
            console.log('🔍 [DEBUG] 步驟2 - 換行處理後:', processed.substring(0, 200) + (processed.length > 200 ? '...' : ''));
        }

        // 3. 處理 Markdown 語法
        // 先處理內聯程式碼 `code` (要在粗體前處理，避免衝突)
        processed = processed.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        
        // 處理粗體 **text**
        processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // 處理斜體 *text* (要在粗體後處理，避免衝突，但避免處理程式碼中的單一星號)
        processed = processed.replace(/\*([^*<>`]+)\*/g, '<em>$1</em>');
        
        if (this.config.isDevelopment) {
            console.log('🔍 [DEBUG] 步驟3 - Markdown 語法處理後:', processed.substring(0, 200) + (processed.length > 200 ? '...' : ''));
        }
        
        // 4. 處理項目符號列表 (修復正規表達式，避免貪婪匹配)
        processed = processed.replace(/^•\s([^\r\n]+)$/gm, '<div class="bullet-item">• $1</div>');
        if (this.config.isDevelopment) {
            console.log('🔍 [DEBUG] 步驟4a - 項目符號處理後:', processed.substring(0, 200) + (processed.length > 200 ? '...' : ''));
        }
        
        processed = processed.replace(/^\d+\.\s([^\r\n]+)$/gm, '<div class="numbered-item">$1</div>');
        if (this.config.isDevelopment) {
            console.log('🔍 [DEBUG] 步驟4b - 數字列表處理後:', processed.substring(0, 200) + (processed.length > 200 ? '...' : ''));
        }
        
        // 5. 處理標題 (修復正規表達式，避免貪婪匹配導致內容截斷)
        processed = processed.replace(/^###\s([^\r\n]+)$/gm, '<h3 class="message-h3">$1</h3>');
        processed = processed.replace(/^##\s([^\r\n]+)$/gm, '<h2 class="message-h2">$1</h2>');
        processed = processed.replace(/^#\s([^\r\n]+)$/gm, '<h1 class="message-h1">$1</h1>');
        if (this.config.isDevelopment) {
            console.log('🔍 [DEBUG] 步驟5 - 標題處理後:', processed.substring(0, 200) + (processed.length > 200 ? '...' : ''));
        }
        
        // 6. 處理分隔線
        processed = processed.replace(/^[═─━]{3,}$/gm, '<hr class="message-separator">');
        if (this.config.isDevelopment) {
            console.log('🔍 [DEBUG] 步驟6 - 分隔線處理後:', processed.substring(0, 200) + (processed.length > 200 ? '...' : ''));
        }
        
        // 7. 處理 emoji 開頭的重要區塊
        processed = processed.replace(/^(📚|📄|🔗|📝|💬|🖼️|🎥|📎|🔖)\s\*\*(.*?)\*\*：?$/gm, 
            '<div class="info-block"><span class="emoji">$1</span> <strong>$2</strong></div>');
        if (this.config.isDevelopment) {
            console.log('🔍 [DEBUG] 步驟7 - Emoji 區塊處理後:', processed.substring(0, 200) + (processed.length > 200 ? '...' : ''));
        }
        
        // 8. 處理縮排內容 (修復正規表達式，避免貪婪匹配)
        processed = processed.replace(/^    ([^\r\n]+)$/gm, '<div class="indented-content">$1</div>');
        if (this.config.isDevelopment) {
            console.log('🔍 [DEBUG] 步驟8 - 縮排處理後:', processed.substring(0, 200) + (processed.length > 200 ? '...' : ''));
        }
        
        // 9. 將 URL 轉換為可點擊的連結（放在最後以避免干擾其他格式）
        const urlRegex = /(https?:\/\/[^\s<>\)）]+)/g;
        processed = processed.replace(urlRegex, (url) => {
            const cleanUrl = url.replace(/[.,;!?)\)）]+$/, '');
            return `<a href="${cleanUrl}" class="notion-link" target="_blank">${cleanUrl}</a>`;
        });
        if (this.config.isDevelopment) {
            console.log('🔍 [DEBUG] 步驟9 - URL 處理後:', processed.substring(0, 200) + (processed.length > 200 ? '...' : ''));
        }
        
        // 10. 處理參考資料區塊
        processed = processed.replace(
            /📚\s\*\*參考資料：\*\*/g, 
            '<div class="reference-section"><strong>📚 參考資料：</strong></div>'
        );
        if (this.config.isDevelopment) {
            console.log('🔍 [DEBUG] 步驟10 - 參考資料處理後:', processed.substring(0, 200) + (processed.length > 200 ? '...' : ''));
            console.log('🔍 [DEBUG] 最終處理結果:', processed);
            console.log('🔍 [DEBUG] 最終內容長度:', processed.length);
        }
        
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