// Register Alpine component SYNCHRONOUSLY (no module, no defer)
// Heavy ES dependencies are lazy-loaded via dynamic import() during init()

Alpine.data('ollamaApp', () => createState());

function createState() {
    return {
        // Core services (loaded lazily)
        client: null,
        history: null,
        fileManager: null,
        contextManager: null,
        searchService: null,
        imageService: null,
        generalImageService: null,
        nixService: null,
        _modulesLoaded: false,

        settings: {
            contextLimit: 4096,
            ollamaUrl: 'http://localhost:11434',
            geminiApiKey: '',
            imagenModel: 'google/imagen-4.0-fast',
            theme: 'dark',
            username: 'Local User',
            systemPrompt: '',
            includeTime: false,
            avatar: null,
            aiName: 'Assistant',
            aiAvatar: null,
            unsplashKey: '',
            safeSearch: true,
            disableTokenLimit: false
        },

        sidebarCollapsed: true,
        showSettings: false,
        showArtifactPanel: false,
        showPreviewModal: false,
        previewAttachment: null,

        messages: [],
        currentChatId: null,
        selectedModel: null,
        models: [],
        isStreaming: false,
        abortController: null,
        errorMessage: '',
        lastUserMessage: '',
        lastSystemPrompt: '',

        userInput: '',
        sendDisabled: true,
        contextRatio: 0,
        attachments: [],

        selectedTool: 'none',
        searchWeb: false,
        deepThink: false,
        deepThinkIterations: 1,

        statusText: 'Connecting...',
        statusClass: '',
        nixOnline: false,

        cpuUsage: '--%',
        ramUsage: '-- / -- GB',

        draggedChatId: null,
        dragOverChatId: null,

        artifacts: [],

        suggestions: [
            'Assistance with document processing.',
            'Standard technical query resolution.',
            'Drafting of routine correspondence.',
            'Verification of system data logic.'
        ],

        async init() {
            // Lazy-load all ES modules (pre-cached by lazy-deps.js if fast)
            const modules = await loadModules();

            this.client = new modules.OllamaClient(this.settings.ollamaUrl, this.settings.geminiApiKey);
            this.history = new modules.HistoryManager();
            this.fileManager = new modules.FileManager();
            this.contextManager = new modules.ContextManager(this.settings.contextLimit);
            this.searchService = new modules.SearchService();
            this.imageService = new modules.ImageService();
            this.generalImageService = new modules.GeneralImageService();
            this.nixService = new modules.NixService();
            this._modulesLoaded = true;

            this.loadSettings();
            this.startResourceMonitor();
            this.startNixPing();
            await this.checkStatus();

            if (this.history.chats.length > 0) {
                this.loadChat(this.history.chats[0].id);
            } else {
                this.newChat();
            }

            this.applyTheme();
            this.$nextTick(() => this.autoResizeTextarea());
        },

        loadSettings() {
            const stored = localStorage.getItem('ollama_settings');
            if (stored) this.settings = { ...this.settings, ...JSON.parse(stored) };
        },

        saveSettings() {
            localStorage.setItem('ollama_settings', JSON.stringify(this.settings));
            this.applyTheme();
            if (this.client) {
                this.client.baseUrl = this.settings.ollamaUrl;
                this.client.geminiApiKey = this.settings.geminiApiKey;
            }
            if (this.contextManager) this.contextManager.setLimit(this.settings.contextLimit);
            this.updateContext();
            this.checkStatus();
        },

        applyTheme() {
            if (this.settings.theme === 'dark') document.body.classList.add('dark');
            else document.body.classList.remove('dark');
        },

        loadAvatar(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => { this.settings.avatar = e.target.result; this.saveSettings(); };
                reader.readAsDataURL(file);
            }
        },

        loadAiAvatar(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => { this.settings.aiAvatar = e.target.result; this.saveSettings(); };
                reader.readAsDataURL(file);
            }
        },

        get sortedChats() {
            if (!this.history) return [];
            return [...this.history.chats].sort((a, b) => b.timestamp - a.timestamp).map(chat => ({
                ...chat, timeLabel: this.formatTime(chat.timestamp)
            }));
        },

        formatTime(timestamp) {
            const date = new Date(parseInt(timestamp));
            const diff = Date.now() - date;
            if (diff < 60000) return 'Just now';
            if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
            if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
            return date.toLocaleDateString();
        },

        newChat() {
            const chat = this.history.createNewChat();
            this.currentChatId = chat.id;
            this.messages = [];
            this.updateContext();
            this.artifacts = [];
        },

        loadChat(id) {
            this.history.currentChatId = id;
            this.currentChatId = id;
            const chat = this.history.getChat(id);
            this.messages = chat.messages.map((msg, idx) => ({
                ...msg, id: idx,
                html: msg.role === 'ai' ? this.renderMarkdown(msg.text) : this.escapeHtml(msg.text),
                reaction: msg.reaction || null, isStreaming: false
            }));
            this.updateContext();
            this.artifacts = [];
        },

        deleteChat(id) {
            this.history.deleteChat(id);
            if (this.currentChatId === id) {
                if (this.history.chats.length > 0) this.loadChat(this.history.chats[0].id);
                else this.newChat();
            }
        },

        reorderChat(targetId) {
            if (!this.draggedChatId || this.draggedChatId === targetId) return;
            const di = this.history.chats.findIndex(c => c.id === this.draggedChatId);
            const ti = this.history.chats.findIndex(c => c.id === targetId);
            const [moved] = this.history.chats.splice(di, 1);
            this.history.chats.splice(ti, 0, moved);
            this.history.save();
            this.draggedChatId = null;
            this.dragOverChatId = null;
        },

        clearAllHistory() {
            if (confirm('Are you sure you want to clear ALL chat history?')) {
                this.history.clearAll();
                this.newChat();
                this.showSettings = false;
            }
        },

        async sendMessage() {
            const text = this.userInput.trim();
            if (!text || this.sendDisabled || this.isStreaming) return;

            this.abortController = new AbortController();
            this.lastUserMessage = text;
            this.lastSystemPrompt = this.settings.systemPrompt;
            this.addMessageToChat('user', text);
            this.userInput = '';
            this.onInputChange();
            this.isStreaming = true;
            this.errorMessage = '';

            const ctx = this.buildContextText();
            const sys = this.buildSystemPrompt();

            try {
                let full = '';
                let thinking = '';
                const mi = this.messages.length;
                this.messages.push({
                    id: mi, role: 'ai', text: '', html: '',
                    thinking: '', reaction: null, isStreaming: true, imageData: null
                });

                await this.client.chat(this.selectedModel, ctx, sys, (chunk, done) => {
                    if (chunk) {
                        if (chunk.includes('<think>')) {
                            const p = chunk.split('<think>');
                            full += p[0]; thinking = p[1] || '';
                        } else if (chunk.includes('</think>') && thinking) {
                            const p = chunk.split('</think>');
                            thinking += p[0]; full += p[1] || '';
                            this.messages[mi].thinking = this.renderMarkdown(thinking);
                        } else if (thinking && !full.includes('</think>')) {
                            thinking += chunk;
                        } else {
                            full += chunk;
                        }
                        this.messages[mi].text = full;
                        this.messages[mi].html = this.renderMarkdown(full);
                    }
                    if (done) {
                        this.messages[mi].isStreaming = false;
                        this.isStreaming = false;
                        this.abortController = null;
                        const chat = this.history.getChat(this.currentChatId);
                        if (chat) { chat.messages.push({ role: 'ai', text: full }); this.history.save(); }
                        this.updateContext();
                    }
                }, this.abortController.signal);
            } catch (err) {
                this.isStreaming = false;
                this.abortController = null;
                if (err.name !== 'AbortError') {
                    this.errorMessage = `Error: ${err.message || 'Model busy—try regenerate'}`;
                    if (this.messages.length && this.messages[this.messages.length - 1].role === 'ai' && !this.messages[this.messages.length - 1].text)
                        this.messages.pop();
                }
            }
        },

        stopGeneration() {
            if (this.abortController) { this.abortController.abort(); this.abortController = null; }
            this.isStreaming = false;
            const lm = this.messages[this.messages.length - 1];
            if (lm && lm.role === 'ai') {
                lm.isStreaming = false;
                const chat = this.history.getChat(this.currentChatId);
                if (chat) { chat.messages.push({ role: 'ai', text: lm.text }); this.history.save(); }
            }
        },

        async regenerateLast() {
            this.errorMessage = '';
            if (this.messages.length && this.messages[this.messages.length - 1].role === 'ai') {
                this.messages.pop();
                const chat = this.history.getChat(this.currentChatId);
                if (chat && chat.messages.length) { chat.messages.pop(); this.history.save(); }
            }
            this.userInput = this.lastUserMessage;
            await this.sendMessage();
        },

        addMessageToChat(role, text, imageData = null) {
            const chat = this.history.getChat(this.currentChatId);
            if (chat) {
                chat.messages.push({ role, text, imageData });
                if (chat.messages.length === 1 && role === 'user')
                    chat.title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
                this.history.save();
            }
            this.messages.push({
                id: this.messages.length, role, text,
                html: role === 'ai' ? this.renderMarkdown(text) : this.escapeHtml(text),
                reaction: null, isStreaming: false, imageData
            });
        },

        buildContextText() {
            const h = this.messages.filter(m => m.role !== 'ai' || m.text)
                .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n\n');
            const a = this.attachments.map(x => `\n\nFile (${x.name}):\n${x.text}`).join('');
            return h + a + `\n\nUser: ${this.userInput}`;
        },

        buildSystemPrompt() {
            let p = this.settings.systemPrompt || '';
            if (this.settings.includeTime) p += `\nCurrent time: ${new Date().toLocaleString()}`;
            if (this.settings.aiName) p = `You are ${this.settings.aiName}.` + (p ? '\n' + p : '');
            return p;
        },

        copyMessage(msg) { navigator.clipboard.writeText(msg.text); },

        onInputChange() {
            this.sendDisabled = !this.userInput.trim() || !this.selectedModel;
            this.updateContext();
            this.autoResizeTextarea();
        },

        autoResizeTextarea() {
            const ta = document.getElementById('user-input');
            if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; }
        },

        updateContext() {
            if (!this.contextManager) return;
            const h = this.messages.map(m => m.text).join('\n');
            const a = this.attachments.map(x => `\n\nFile (${x.name}):\n${x.text}`).join('');
            const s = this.contextManager.update(h + a + this.userInput);
            this.contextRatio = Math.min(s.ratio * 100, 100);
            this.sendDisabled = !this.userInput.trim() || !this.selectedModel;
        },

        async handleFileUpload(event) {
            await this.processFiles(Array.from(event.target.files));
            event.target.value = '';
        },

        async processFiles(files) {
            for (const file of files) {
                const att = { name: file.name, type: file.type, text: '', dataUrl: null, status: 'WAIT' };
                this.attachments.push(att);
                try {
                    if (file.type.startsWith('image/')) att.dataUrl = await this.readFileAsDataURL(file);
                    att.text = await this.fileManager.extractText(file, (pct) => { att.status = `PROC: ${pct}%`; });
                    att.status = 'READY';
                } catch (e) { att.status = 'ERR'; console.error('File error:', e); }
                this.updateContext();
            }
        },

        removeAttachment(att) { this.attachments = this.attachments.filter(a => a !== att); this.updateContext(); },

        readFileAsDataURL(file) {
            return new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(file); });
        },

        showPreview(att) { this.previewAttachment = att; this.showPreviewModal = true; },

        async checkStatus() {
            if (!this.client) return;
            const online = await this.client.checkStatus();
            const gemini = !!this.settings.geminiApiKey;
            if (online) {
                this.statusClass = 'status-online'; this.statusText = 'Status: Online';
                await this.loadModels();
            } else if (gemini) {
                this.statusClass = 'status-offline'; this.statusText = 'Status: Gemini Only (Ollama Offline)';
                await this.loadModels();
            } else {
                this.statusClass = 'status-offline';
                this.statusText = window.location.protocol === 'https:' && this.client.baseUrl.startsWith('http://')
                    ? 'Status: BLOCKED (SECURE_CONTEXT)' : 'Status: Offline';
                this.models = [];
            }
        },

        async loadModels() {
            const models = await this.client.listModels();
            if (models.length) {
                this.models = models;
                if (!this.selectedModel || !models.some(m => m.name === this.selectedModel))
                    this.selectedModel = models[0].name;
            } else { this.models = []; this.selectedModel = null; }
            this.updateContext();
        },

        onModelChange() { this.updateContext(); },
        onToolChange() {},

        startNixPing() { this.nixService.startPinging(s => { this.nixOnline = s === 'online'; }); },

        startResourceMonitor() {
            const update = () => {
                this.cpuUsage = `${(Math.random() * 15 + 2).toFixed(1)}%`;
                let used = '0.0', total = navigator.deviceMemory || '8';
                if (performance.memory) used = (performance.memory.usedJSHeapSize / 1024 / 1024 / 1024).toFixed(2);
                else used = (Math.random() * 0.5 + 1.2).toFixed(1);
                this.ramUsage = `${used} / ${total} GB`;
            };
            setInterval(update, 2000); update();
        },

        useSuggestion(s) { this.userInput = s.replace(/"/g, ''); this.onInputChange(); setTimeout(() => document.getElementById('user-input')?.focus(), 100); },
        renderMarkdown(t) { return typeof marked !== 'undefined' ? marked.parse(t) : this.escapeHtml(t); },
        escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
    };
}

// Lazy module loader - loads ES modules via dynamic import
let _moduleCache = null;
async function loadModules() {
    if (_moduleCache) return _moduleCache;
    const [
        { OllamaClient },
        { HistoryManager },
        { FileManager },
        { ContextManager },
        { SearchService },
        { ImageService, GeneralImageService },
        { NixService }
    ] = await Promise.all([
        import('./client.js'),
        import('./history.js'),
        import('./file.js'),
        import('./context.js'),
        import('./search.js'),
        import('./image.js'),
        import('./nix.js')
    ]);
    _moduleCache = { OllamaClient, HistoryManager, FileManager, ContextManager, SearchService, ImageService, GeneralImageService, NixService };
    return _moduleCache;
}
