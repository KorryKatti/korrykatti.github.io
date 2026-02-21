class OllamaClient {
    constructor(baseUrl = 'http://localhost:11434') {
        this.baseUrl = baseUrl;
    }

    async checkStatus() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async listModels() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            const data = await response.json();
            return data.models || [];
        } catch (error) {
            console.error('Error listing models:', error);
            return [];
        }
    }

    async getModelInfo(modelName) {
        try {
            const response = await fetch(`${this.baseUrl}/api/show`, {
                method: 'POST',
                body: JSON.stringify({ name: modelName })
            });
            const data = await response.json();

            // Try to find context limit in parameter string
            let contextLimit = null;
            if (data.parameters) {
                const match = data.parameters.match(/num_ctx\s+(\d+)/);
                if (match) contextLimit = parseInt(match[1]);
            }
            return { ...data, contextLimit };
        } catch (error) {
            console.error('Error fetching model info:', error);
            return null;
        }
    }

    async chat(model, prompt, systemPrompt, onChunk) {
        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                body: JSON.stringify({
                    model: model,
                    prompt: prompt,
                    system: systemPrompt,
                    stream: true
                })
            });

            if (!response.ok) throw new Error('Failed to start chat');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const json = JSON.parse(line);
                        onChunk(json.response, json.done);
                    } catch (e) {
                        // Partial JSON
                    }
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
            throw error;
        }
    }
}

class ContextManager {
    constructor(limit = 4096) {
        this.limit = limit;
        this.currentSize = 0;
    }

    setLimit(limit) {
        this.limit = limit || 4096;
    }

    estimateTokens(text) {
        // Rough estimation: 4 characters per token
        return Math.ceil(text.length / 4);
    }

    update(text) {
        this.currentSize = this.estimateTokens(text);
        return {
            size: this.currentSize,
            ratio: (this.currentSize / this.limit),
            isFull: this.currentSize >= this.limit,
            isNear: this.currentSize >= this.limit * 0.8
        };
    }
}

class HistoryManager {
    constructor() {
        this.storageKey = 'ollama_chat_history';
        this.chats = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        this.currentChatId = null;
    }

    save() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.chats));
    }

    createNewChat() {
        const id = Date.now().toString();
        const newChat = {
            id: id,
            title: 'New Chat',
            messages: [],
            timestamp: id
        };
        this.chats.unshift(newChat);
        this.currentChatId = id;
        this.save();
        return newChat;
    }

    addMessage(id, role, text) {
        const chat = this.chats.find(c => c.id === id);
        if (chat) {
            chat.messages.push({ role, text });
            if (chat.messages.length === 1 && role === 'user') {
                chat.title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
            }
            this.save();
        }
    }

    deleteChat(id) {
        this.chats = this.chats.filter(c => c.id !== id);
        this.save();
    }

    clearAll() {
        this.chats = [];
        this.save();
    }

    getChat(id) {
        return this.chats.find(c => c.id === id);
    }
}

class SettingsManager {
    constructor(onUpdate) {
        this.storageKey = 'ollama_settings';
        this.onUpdate = onUpdate;
        this.defaults = {
            contextLimit: 4096,
            ollamaUrl: 'http://localhost:11434',
            theme: 'dark',
            username: 'Local User',
            systemPrompt: '',
            includeTime: false,
            avatar: null
        };
        this.settings = { ...this.defaults, ...JSON.parse(localStorage.getItem(this.storageKey) || '{}') };
        this.applyTheme();
    }

    save() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
        this.applyTheme();
        if (this.onUpdate) this.onUpdate(this.settings);
    }

    update(key, value) {
        this.settings[key] = value;
        this.save();
    }

    applyTheme() {
        document.body.className = `${this.settings.theme}-theme`;
    }
}

class FileManager {
    constructor() {
        this.attachments = [];
    }

    async extractText(file) {
        const type = file.type;
        if (type === 'text/plain') {
            return await file.text();
        } else if (type === 'application/pdf') {
            return await this.extractPdfText(file);
        } else if (type.startsWith('image/')) {
            return await this.extractImageText(file);
        }
        return '';
    }

    async extractPdfText(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            // Using a dynamic import for PDF.js to handle the ESM module correctly
            const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                fullText += content.items.map(item => item.str).join(' ') + '\n';
            }
            return fullText;
        } catch (e) {
            console.error('PDF extraction error:', e);
            throw new Error('Failed to extract text from PDF.');
        }
    }

    async extractImageText(file) {
        try {
            const result = await Tesseract.recognize(file, 'eng');
            return result.data.text;
        } catch (e) {
            console.error('OCR error:', e);
            throw new Error('Failed to perform OCR on image.');
        }
    }
}

class UIController {
    constructor(client) {
        this.client = client;
        this.history = new HistoryManager();
        this.settings = new SettingsManager((s) => this.applySettings(s));
        this.fileManager = new FileManager();
        this.contextManager = new ContextManager(this.settings.settings.contextLimit);

        this.elements = {
            statusIndicator: document.getElementById('status-indicator'),
            modelSelect: document.getElementById('model-select'),
            userInput: document.getElementById('user-input'),
            sendBtn: document.getElementById('send-btn'),
            chatContainer: document.getElementById('chat-container'),
            welcomeScreen: document.getElementById('welcome-screen'),
            activeModelName: document.getElementById('active-model-name'),
            newChatBtn: document.getElementById('new-chat-btn'),
            attachBtn: document.getElementById('attach-btn'),
            fileInput: document.getElementById('file-input'),
            attachmentsContainer: document.getElementById('attachments-container'),
            contextBar: document.getElementById('context-bar'),
            contextText: document.getElementById('context-text'),
            contextInfo: document.getElementById('context-info'),
            chatHistory: document.getElementById('chat-history'),
            settingsBtn: document.getElementById('settings-btn'),
            settingsModal: document.getElementById('settings-modal'),
            closeSettings: document.getElementById('close-settings'),
            clearHistoryBtn: document.getElementById('clear-history-btn'),
            settingContextLimit: document.getElementById('setting-context-limit'),
            settingOllamaUrl: document.getElementById('setting-ollama-url'),
            settingTheme: document.getElementById('setting-theme'),
            settingUsername: document.getElementById('setting-username'),
            settingAvatar: document.getElementById('setting-avatar'),
            settingSystemPrompt: document.getElementById('setting-system-prompt'),
            settingIncludeTime: document.getElementById('setting-include-time'),
            userAvatarDisplay: document.getElementById('user-avatar-display'),
            usernameDisplay: document.getElementById('username-display')
        };
        this.selectedModel = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.loadSettingsToUI();
        this.applyProfileUI();
        await this.checkOllamaStatus();
        this.autoResizeInput();
        this.renderHistory();

        // Load latest chat if exists
        if (this.history.chats.length > 0) {
            this.loadChat(this.history.chats[0].id);
        } else {
            this.createNewChat();
        }
    }

    applySettings(settings) {
        this.client.baseUrl = settings.ollamaUrl;
        this.contextManager.setLimit(settings.contextLimit);
        this.applyProfileUI();
        this.updateContext();
    }

    applyProfileUI() {
        this.elements.usernameDisplay.textContent = this.settings.settings.username;
        if (this.settings.settings.avatar) {
            this.elements.userAvatarDisplay.innerHTML = `<img src="${this.settings.settings.avatar}">`;
        } else {
            this.elements.userAvatarDisplay.textContent = this.settings.settings.username.charAt(0).toUpperCase();
        }
    }

    loadSettingsToUI() {
        const s = this.settings.settings;
        this.elements.settingContextLimit.value = s.contextLimit;
        this.elements.settingOllamaUrl.value = s.ollamaUrl;
        this.elements.settingTheme.value = s.theme;
        this.elements.settingUsername.value = s.username;
        this.elements.settingSystemPrompt.value = s.systemPrompt;
        this.elements.settingIncludeTime.checked = s.includeTime;
    }

    setupEventListeners() {
        this.elements.userInput.addEventListener('input', () => {
            this.autoResizeInput();
            this.updateContext();
            this.updateSendButtonState();
        });

        this.elements.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !this.elements.sendBtn.disabled) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });

        this.elements.sendBtn.addEventListener('click', () => this.handleSendMessage());

        this.elements.modelSelect.addEventListener('change', async (e) => {
            this.selectedModel = e.target.value;
            this.elements.activeModelName.textContent = this.selectedModel;
            this.updateSendButtonState();

            // Try to fetch context limit for this model
            const info = await this.client.getModelInfo(this.selectedModel);
            if (info && info.contextLimit) {
                this.settings.update('contextLimit', info.contextLimit);
                this.elements.settingContextLimit.value = info.contextLimit;
            }
        });

        this.elements.newChatBtn.addEventListener('click', () => this.createNewChat());

        // File upload events
        this.elements.attachBtn.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

        // Settings events
        this.elements.settingsBtn.addEventListener('click', () => this.elements.settingsModal.classList.remove('hidden'));
        this.elements.closeSettings.addEventListener('click', () => this.elements.settingsModal.classList.add('hidden'));
        this.elements.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) this.elements.settingsModal.classList.add('hidden');
        });

        this.elements.settingUsername.addEventListener('input', (e) => this.settings.update('username', e.target.value));
        this.elements.settingSystemPrompt.addEventListener('input', (e) => this.settings.update('systemPrompt', e.target.value));
        this.elements.settingIncludeTime.addEventListener('change', (e) => this.settings.update('includeTime', e.target.checked));

        this.elements.settingAvatar.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => this.settings.update('avatar', event.target.result);
                reader.readAsDataURL(file);
            }
        });

        this.elements.settingContextLimit.addEventListener('change', (e) => this.settings.update('contextLimit', parseInt(e.target.value)));
        this.elements.settingOllamaUrl.addEventListener('change', (e) => this.settings.update('ollamaUrl', e.target.value));
        this.elements.settingTheme.addEventListener('change', (e) => this.settings.update('theme', e.target.value));
        this.elements.clearHistoryBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear ALL chat history?')) {
                this.history.clearAll();
                this.renderHistory();
                this.createNewChat();
                this.elements.settingsModal.classList.add('hidden');
            }
        });

        // Suggestion cards
        document.querySelectorAll('.suggestion-card').forEach(card => {
            card.addEventListener('click', () => {
                this.elements.userInput.value = card.textContent.replace(/"/g, '');
                this.autoResizeInput();
                this.updateContext();
                this.updateSendButtonState();
                this.elements.userInput.focus();
            });
        });
    }

    renderHistory() {
        this.elements.chatHistory.innerHTML = '';
        this.history.chats.forEach(chat => {
            const item = document.createElement('div');
            item.className = `history-item ${chat.id === this.history.currentChatId ? 'active' : ''}`;
            item.innerHTML = `
                <span class="chat-title">${chat.title}</span>
                <span class="delete-history-item" data-id="${chat.id}">&times;</span>
            `;
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-history-item')) return;
                this.loadChat(chat.id);
            });
            item.querySelector('.delete-history-item').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteChat(chat.id);
            });
            this.elements.chatHistory.appendChild(item);
        });
    }

    createNewChat() {
        const chat = this.history.createNewChat();
        this.loadChat(chat.id);
        this.renderHistory();
    }

    loadChat(id) {
        this.history.currentChatId = id;
        const chat = this.history.getChat(id);
        this.elements.chatContainer.innerHTML = '';

        if (chat.messages.length === 0) {
            this.elements.chatContainer.appendChild(this.elements.welcomeScreen);
            this.elements.welcomeScreen.classList.remove('hidden');
        } else {
            this.elements.welcomeScreen.classList.add('hidden');
            chat.messages.forEach(msg => this.addMessage(msg.text, msg.role, false));
        }

        this.renderHistory();
        this.updateContext();
    }

    deleteChat(id) {
        this.history.deleteChat(id);
        if (this.history.currentChatId === id) {
            if (this.history.chats.length > 0) {
                this.loadChat(this.history.chats[0].id);
            } else {
                this.createNewChat();
            }
        }
        this.renderHistory();
    }

    async handleFileUpload(event) {
        const files = Array.from(event.target.files);
        for (const file of files) {
            const chip = this.createFileChip(file.name);
            this.elements.attachmentsContainer.appendChild(chip);

            try {
                const text = await this.fileManager.extractText(file);
                this.fileManager.attachments.push({ name: file.name, text: text, chip: chip });
                chip.querySelector('.file-status').textContent = '✓';
                this.updateContext();
            } catch (error) {
                chip.querySelector('.file-status').textContent = '⚠';
                chip.title = error.message;
            }
        }
        this.elements.fileInput.value = '';
    }

    createFileChip(name) {
        const div = document.createElement('div');
        div.className = 'file-chip';
        div.innerHTML = `
            <span class="file-status">...</span>
            <span class="file-name">${name}</span>
            <span class="remove-file">×</span>
        `;
        div.querySelector('.remove-file').addEventListener('click', () => {
            this.fileManager.attachments = this.fileManager.attachments.filter(a => a.chip !== div);
            div.remove();
            this.updateContext();
        });
        return div;
    }

    updateContext() {
        const currentChat = this.history.getChat(this.history.currentChatId);
        const historyText = currentChat ? currentChat.messages.map(m => m.text).join('\n') : '';
        const prompt = this.elements.userInput.value;
        const attachmentsText = this.fileManager.attachments.map(a => `\n\nFile (${a.name}):\n${a.text}`).join('');
        const fullText = historyText + attachmentsText + prompt;

        const stats = this.contextManager.update(fullText);

        this.elements.contextBar.style.width = `${Math.min(stats.ratio * 100, 100)}%`;
        this.elements.contextText.textContent = `Context: ${stats.size} / ${this.contextManager.limit} tokens`;

        this.elements.contextInfo.classList.remove('context-warning', 'context-danger');
        if (stats.isFull) this.elements.contextInfo.classList.add('context-danger');
        else if (stats.isNear) this.elements.contextInfo.classList.add('context-warning');

        this.updateSendButtonState();
    }

    async checkOllamaStatus() {
        const isOnline = await this.client.checkStatus();
        const indicator = this.elements.statusIndicator;
        const text = indicator.querySelector('.status-text');

        if (isOnline) {
            indicator.classList.remove('status-offline');
            indicator.classList.add('status-online');
            text.textContent = 'Ollama is Online';
            await this.loadModels();
        } else {
            indicator.classList.remove('status-online');
            indicator.classList.add('status-offline');
            text.textContent = 'Ollama is Offline';
            this.elements.modelSelect.innerHTML = '<option disabled selected>Run Ollama to see models</option>';
        }
    }

    async loadModels() {
        const models = await this.client.listModels();
        if (models.length > 0) {
            this.elements.modelSelect.innerHTML = models.map(m =>
                `<option value="${m.name}">${m.name} (${(m.size / 1024 / 1024 / 1024).toFixed(1)} GB)</option>`
            ).join('');
            this.selectedModel = models[0].name;
            this.elements.modelSelect.value = this.selectedModel;
            this.elements.activeModelName.textContent = this.selectedModel;
        } else {
            this.elements.modelSelect.innerHTML = '<option disabled selected>No models found</option>';
        }
        this.updateSendButtonState();
    }

    updateSendButtonState() {
        const hasInput = this.elements.userInput.value.trim().length > 0;
        const stats = this.contextManager.update(this.elements.userInput.value + this.fileManager.attachments.map(a => a.text).join(''));
        this.elements.sendBtn.disabled = !hasInput || !this.selectedModel || stats.isFull;
    }

    autoResizeInput() {
        const textarea = this.elements.userInput;
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    }

    async handleSendMessage() {
        const userInput = this.elements.userInput.value.trim();
        const attachmentsText = this.fileManager.attachments.map(a => `\n\n[File: ${a.name}]\n${a.text}`).join('');

        let prompt = attachmentsText + userInput;

        // Inject time if setting is on
        if (this.settings.settings.includeTime) {
            const now = new Date();
            prompt = `[Current Time: ${now.toLocaleTimeString()} ${now.toLocaleDateString()}]\n\n` + prompt;
        }

        if (!userInput || !this.selectedModel) return;

        const chatId = this.history.currentChatId;
        this.history.addMessage(chatId, 'user', prompt);

        this.elements.userInput.value = '';
        this.fileManager.attachments = [];
        this.elements.attachmentsContainer.innerHTML = '';
        this.autoResizeInput();
        this.updateContext();
        this.updateSendButtonState();
        this.elements.welcomeScreen.classList.add('hidden');
        this.renderHistory();

        // Add user message to UI (just the input, not the whole context)
        this.addMessage(userInput + (attachmentsText ? `\n\n*(Sent ${this.fileManager.attachments.length} attachments)*` : ''), 'user');

        // Add AI message placeholder
        const aiMessageContent = this.addMessage('', 'ai');
        const loadingDots = this.showLoading(aiMessageContent);

        try {
            let fullResponse = '';
            await this.client.chat(this.selectedModel, prompt, this.settings.settings.systemPrompt, (chunk, done) => {
                loadingDots.remove();
                fullResponse += chunk;
                aiMessageContent.innerHTML = marked.parse(fullResponse);
                this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
                if (done) {
                    this.history.addMessage(chatId, 'ai', fullResponse);
                }
            });
        } catch (error) {
            loadingDots.remove();
            aiMessageContent.innerHTML = `
                <div class="error-box">
                    <strong>Connection Error</strong><br>
                    Could not connect to Ollama. Ensure it's running and CORS is enabled.<br><br>
                    <code>OLLAMA_ORIGINS="*" ollama serve</code>
                </div>
            `;
        }
    }

    addMessage(text, role, animate = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        if (animate) messageDiv.style.animation = 'fadeIn 0.3s ease-out';

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';

        if (role === 'user') {
            if (this.settings.settings.avatar) {
                avatar.innerHTML = `<img src="${this.settings.settings.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            } else {
                avatar.textContent = this.settings.settings.username.charAt(0).toUpperCase();
                avatar.style.background = '#8ab4f8';
            }
        } else {
            avatar.innerHTML = '○';
            avatar.style.background = '#3c4043';
        }

        avatar.style.display = 'flex';
        avatar.style.alignItems = 'center';
        avatar.style.justifyContent = 'center';
        avatar.style.flexShrink = '0';

        const content = document.createElement('div');
        content.className = 'message-content';
        if (role === 'ai') {
            content.innerHTML = marked.parse(text);
        } else {
            content.textContent = text;
        }

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        this.elements.chatContainer.appendChild(messageDiv);
        this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;

        return content;
    }

    showLoading(container) {
        const dots = document.createElement('div');
        dots.className = 'typing';
        dots.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
        container.appendChild(dots);
        return dots;
    }

    resetChat() {
        this.elements.chatContainer.innerHTML = '';
        this.elements.chatContainer.appendChild(this.elements.welcomeScreen);
        this.elements.welcomeScreen.classList.remove('hidden');
        this.elements.userInput.value = '';
        this.autoResizeInput();
        this.updateSendButtonState();
    }
}

// Initialize
const settingsManager = new SettingsManager();
const ollamaClient = new OllamaClient(settingsManager.settings.ollamaUrl);
const uiController = new UIController(ollamaClient);
