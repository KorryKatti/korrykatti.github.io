import { OllamaClient } from './client.js';
import { ContextManager } from './context.js';
import { HistoryManager } from './history.js';
import { SettingsManager } from './settings.js';
import { FileManager } from './file.js';
import { SearchService } from './search.js';
import { ImageService, GeneralImageService } from './image.js';
import { NixService } from './nix.js';

export class UIController {
    constructor(client) {
        this.client = client;
        this.history = new HistoryManager();
        this.settings = new SettingsManager((s) => this.applySettings(s));
        this.fileManager = new FileManager();
        this.searchService = new SearchService();
        this.imageService = new ImageService();
        this.generalImageService = new GeneralImageService();
        this.nixService = new NixService();
        this.contextManager = new ContextManager(this.settings.settings.contextLimit);

        this.elements = {
            statusIndicator: document.getElementById('status-indicator'),
            modelSelect: document.getElementById('model-select'),
            userInput: document.getElementById('user-input'),
            sendBtn: document.getElementById('send-btn'),
            stopBtn: document.getElementById('stop-btn'),
            chatContainer: document.getElementById('chat-container'),
            welcomeScreen: document.getElementById('welcome-screen'),
            newChatBtn: document.getElementById('new-chat-btn'),
            attachBtn: document.getElementById('attach-btn'),
            fileInput: document.getElementById('file-input'),
            attachmentsContainer: document.getElementById('attachments-container'),
            contextBar: document.getElementById('context-bar'),
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
            settingUnsplashKey: document.getElementById('setting-unsplash-key'),
            settingSafeSearch: document.getElementById('setting-safe-search'),
            settingAiName: document.getElementById('setting-ai-name'),
            settingAiAvatar: document.getElementById('setting-ai-avatar'),
            settingDisableTokenLimit: document.getElementById('setting-disable-token-limit'),
            usernameDisplay: document.getElementById('username-display'),
            cpuUsage: document.getElementById('cpu-usage'),
            ramUsage: document.getElementById('ram-usage'),
            searchWebToggle: document.getElementById('search-web-toggle'),
            previewModal: document.getElementById('preview-modal'),
            previewTitle: document.getElementById('preview-title'),
            previewBody: document.getElementById('preview-body'),
            closePreview: document.getElementById('close-preview'),
            toolSelect: document.getElementById('tool-select'),
            launchStoryBtn: document.getElementById('launch-story-btn'),
            deepThinkToggle: document.getElementById('deep-think-toggle'),
            deepThinkIterations: document.getElementById('deep-think-iterations'),
            nixStatusIndicator: document.getElementById('nix-status-indicator'),
            // Artifact elements
            artifactPanel: document.getElementById('artifact-panel'),
            artifactPanelBody: document.getElementById('artifact-panel-body'),
            artifactToggleBtn: document.getElementById('artifact-toggle-btn'),
            artifactPanelClose: document.getElementById('artifact-panel-close')
        };
        this.selectedModel = null;
        this.abortController = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.loadSettingsToUI();
        this.applyProfileUI();
        await this.checkOllamaStatus();
        this.autoResizeInput();
        this.renderHistory();
        this.startResourceMonitor();

        // Start waking up the Nix backend on Render
        this.nixService.startPinging((status) => {
            if (this.elements.nixStatusIndicator) {
                const dot = this.elements.nixStatusIndicator.querySelector('.status-dot');
                const text = this.elements.nixStatusIndicator.querySelector('.status-text');
                const settingsStatus = document.getElementById('settings-nix-status');

                if (status === 'online') {
                    dot.style.backgroundColor = '#10b981';
                    text.textContent = 'Nix: Online';
                    if (settingsStatus) {
                        settingsStatus.textContent = 'Online & Ready';
                        settingsStatus.style.color = '#10b981';
                    }
                } else {
                    dot.style.backgroundColor = '#f59e0b';
                    text.textContent = 'Nix: Waking...';
                    if (settingsStatus) {
                        settingsStatus.textContent = 'Waking up (Render Cold Start)...';
                        settingsStatus.style.color = '#f59e0b';
                    }
                }
            }
        });

        if (this.history.chats.length > 0) {
            this.loadChat(this.history.chats[0].id);
        } else {
            this.createNewChat();
        }
    }

    startResourceMonitor() {
        const update = () => {
            const cpu = (Math.random() * 15 + 2).toFixed(1);
            let used = '0.0';
            let total = navigator.deviceMemory || '8';
            if (performance.memory) {
                used = (performance.memory.usedJSHeapSize / 1024 / 1024 / 1024).toFixed(2);
            } else {
                used = (Math.random() * 0.5 + 1.2).toFixed(1);
            }
            this.elements.cpuUsage.textContent = `${cpu}%`;
            this.elements.ramUsage.textContent = `${used} / ${total} GB`;
        };
        setInterval(update, 2000);
        update();
    }

    applySettings(settings) {
        this.client.baseUrl = settings.ollamaUrl;
        this.contextManager.setLimit(settings.contextLimit);
        this.applyProfileUI();
        this.updateContext();
    }

    applyProfileUI() {
        this.elements.usernameDisplay.textContent = this.settings.settings.username;
    }

    loadSettingsToUI() {
        const s = this.settings.settings;
        this.elements.settingContextLimit.value = s.contextLimit;
        this.elements.settingOllamaUrl.value = s.ollamaUrl;
        this.elements.settingTheme.value = s.theme;
        this.elements.settingUsername.value = s.username;
        this.elements.settingSystemPrompt.value = s.systemPrompt;
        this.elements.settingIncludeTime.checked = s.includeTime;
        this.elements.settingUnsplashKey.value = s.unsplashKey || '';
        if (this.elements.settingSafeSearch) this.elements.settingSafeSearch.checked = s.safeSearch;
        if (this.elements.settingAiName) this.elements.settingAiName.value = s.aiName || 'Assistant';
        if (this.elements.settingDisableTokenLimit) this.elements.settingDisableTokenLimit.checked = s.disableTokenLimit;
    }

    setupEventListeners() {
        this.elements.userInput.addEventListener('input', () => {
            this.autoResizeInput();
            this.updateContext();
            this.updateSendButtonState();
        });

        this.elements.userInput.addEventListener('paste', (e) => this.handlePaste(e));

        this.elements.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !this.elements.sendBtn.disabled) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });

        // Artifact Panel Listeners
        if (this.elements.artifactToggleBtn) {
            this.elements.artifactToggleBtn.addEventListener('click', () => {
                this.elements.artifactPanel.classList.toggle('hidden');
            });
        }
        if (this.elements.artifactPanelClose) {
            this.elements.artifactPanelClose.addEventListener('click', () => {
                this.elements.artifactPanel.classList.add('hidden');
            });
        }

        this.elements.toolSelect.addEventListener('change', () => {
            if (this.elements.toolSelect.value === 'story') {
                this.elements.launchStoryBtn.classList.remove('hidden');
            } else {
                this.elements.launchStoryBtn.classList.add('hidden');
            }
        });

        this.elements.launchStoryBtn.addEventListener('click', () => {
            window.open('story.html', '_blank');
        });

        this.elements.sendBtn.addEventListener('click', () => this.handleSendMessage());

        this.elements.stopBtn.addEventListener('click', () => {
            if (this.abortController) {
                this.abortController.abort();
                this.elements.stopBtn.style.display = 'none';
                this.elements.sendBtn.style.display = 'block';
            }
        });

        this.elements.modelSelect.addEventListener('change', async (e) => {
            this.selectedModel = e.target.value;
            this.updateSendButtonState();
            const info = await this.client.getModelInfo(this.selectedModel);
            if (info && info.contextLimit) {
                this.settings.update('contextLimit', info.contextLimit);
                this.elements.settingContextLimit.value = info.contextLimit;
            }
        });

        this.elements.newChatBtn.addEventListener('click', () => this.createNewChat());
        this.elements.attachBtn.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

        this.elements.settingsBtn.addEventListener('click', () => this.elements.settingsModal.classList.remove('hidden'));
        if (this.elements.closeSettings) {
            this.elements.closeSettings.addEventListener('click', () => this.elements.settingsModal.classList.add('hidden'));
        }
        this.elements.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) this.elements.settingsModal.classList.add('hidden');
        });

        this.elements.settingUsername.addEventListener('input', (e) => this.settings.update('username', e.target.value));
        this.elements.settingSystemPrompt.addEventListener('input', (e) => this.settings.update('systemPrompt', e.target.value));
        this.elements.settingIncludeTime.addEventListener('change', (e) => this.settings.update('includeTime', e.target.checked));
        this.elements.settingUnsplashKey.addEventListener('input', (e) => this.settings.update('unsplashKey', e.target.value));

        if (this.elements.settingSafeSearch) {
            this.elements.settingSafeSearch.addEventListener('change', (e) => this.settings.update('safeSearch', e.target.checked));
        }

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

        if (this.elements.settingAiName) this.elements.settingAiName.addEventListener('input', (e) => this.settings.update('aiName', e.target.value));
        if (this.elements.settingDisableTokenLimit) this.elements.settingDisableTokenLimit.addEventListener('change', (e) => this.settings.update('disableTokenLimit', e.target.checked));

        if (this.elements.settingAiAvatar) {
            this.elements.settingAiAvatar.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => this.settings.update('aiAvatar', event.target.result);
                    reader.readAsDataURL(file);
                }
            });
        }

        this.elements.clearHistoryBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear ALL chat history?')) {
                this.history.clearAll();
                this.renderHistory();
                this.createNewChat();
                this.elements.settingsModal.classList.add('hidden');
            }
        });

        if (this.elements.closePreview) {
            this.elements.closePreview.addEventListener('click', () => this.elements.previewModal.classList.add('hidden'));
        }
        this.elements.previewModal.addEventListener('click', (e) => {
            if (e.target === this.elements.previewModal) this.elements.previewModal.classList.add('hidden');
        });

        document.querySelectorAll('.suggestion-card').forEach(card => {
            card.addEventListener('click', () => {
                const p = card.querySelector('p');
                this.elements.userInput.value = (p ? p.textContent : card.textContent).replace(/"/g, '');
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
                <span class="delete-history-item" title="Delete chat">&times;</span>
            `;
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-history-item')) {
                    e.stopPropagation();
                    if (confirm('Delete this chat?')) this.deleteChat(chat.id);
                    return;
                }
                this.loadChat(chat.id);
            });
            this.elements.chatHistory.appendChild(item);
        });
    }

    createNewChat() {
        const chat = this.history.createNewChat();
        this.loadChat(chat.id);
        this.renderHistory();
        this.elements.artifactPanelBody.innerHTML = `
            <div class="artifact-empty-state">
                <div class="artifact-empty-icon">⬡</div>
                <p>No artifacts yet.</p>
                <p style="font-size:11px; opacity:0.6;">Charts &amp; code results will appear here.</p>
            </div>
        `;
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
            chat.messages.forEach(msg => this.addMessage(msg.text, msg.role, false, msg.imageData));
        }
        this.renderHistory();
        this.updateContext();
        // Clear artifact panel on chat load for now (can be improved to load from history later)
        this.elements.artifactPanelBody.innerHTML = `
            <div class="artifact-empty-state">
                <div class="artifact-empty-icon">⬡</div>
                <p>No artifacts yet.</p>
                <p style="font-size:11px; opacity:0.6;">Charts &amp; code results will appear here.</p>
            </div>
        `;
    }

    deleteChat(id) {
        this.history.deleteChat(id);
        if (this.history.currentChatId === id) {
            if (this.history.chats.length > 0) this.loadChat(this.history.chats[0].id);
            else this.createNewChat();
        }
        this.renderHistory();
    }

    handlePaste(event) {
        const items = (event.clipboardData || event.originalEvent.clipboardData).items;
        const files = [];
        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                if (file) {
                    const name = `pasted-image-${new Date().toLocaleTimeString().replace(/:/g, '-')}.png`;
                    files.push(new File([file], name, { type: file.type }));
                }
            }
        }
        if (files.length > 0) {
            event.preventDefault();
            this.processFiles(files);
        }
    }

    async handleFileUpload(event) {
        const files = Array.from(event.target.files);
        await this.processFiles(files);
        this.elements.fileInput.value = '';
    }

    async processFiles(files) {
        for (const file of files) {
            const chip = this.createFileChip(file.name);
            this.elements.attachmentsContainer.appendChild(chip);
            try {
                const text = await this.fileManager.extractText(file, (percent) => {
                    chip.querySelector('.file-status').textContent = ` [PROC: ${percent}%]`;
                });
                const isImage = file.type.startsWith('image/');
                const dataUrl = isImage ? await this.readFileAsDataURL(file) : null;
                this.fileManager.attachments.push({ name: file.name, type: file.type, text: text, dataUrl: dataUrl, chip: chip });
                chip.querySelector('.file-status').textContent = ' [READY]';
                this.updateContext();
            } catch (error) {
                chip.querySelector('.file-status').textContent = ' [ERR]';
                chip.title = error.message;
            }
        }
    }

    createFileChip(name) {
        const div = document.createElement('div');
        div.className = 'file-chip';
        div.innerHTML = `<span class="file-name">${name}</span><span class="file-status"> [WAIT]</span><span class="remove-file" style="cursor:pointer; margin-left:10px;">(X)</span>`;
        div.querySelector('.remove-file').addEventListener('click', (e) => {
            e.stopPropagation();
            this.fileManager.attachments = this.fileManager.attachments.filter(a => a.chip !== div);
            div.remove();
            this.updateContext();
        });
        div.addEventListener('click', () => {
            const attachment = this.fileManager.attachments.find(a => a.chip === div);
            if (attachment) this.showPreview(attachment);
        });
        return div;
    }

    async readFileAsDataURL(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    }

    showPreview(attachment) {
        this.elements.previewTitle.textContent = `Preview: ${attachment.name}`;
        this.elements.previewBody.innerHTML = '';
        if (attachment.type.startsWith('image/') && attachment.dataUrl) {
            const img = document.createElement('img');
            img.src = attachment.dataUrl;
            img.className = 'preview-image';
            this.elements.previewBody.appendChild(img);
            this.elements.previewBody.innerHTML += `<br><strong>Extracted Text:</strong><hr><pre>${attachment.text || '[No text]'}</pre>`;
        } else {
            const pre = document.createElement('pre');
            pre.textContent = attachment.text;
            this.elements.previewBody.appendChild(pre);
        }
        this.elements.previewModal.classList.remove('hidden');
    }

    updateContext() {
        const currentChat = this.history.getChat(this.history.currentChatId);
        const historyText = currentChat ? currentChat.messages.map(m => m.text).join('\n') : '';
        const prompt = this.elements.userInput.value;
        const attachmentsText = this.fileManager.attachments.map(a => `\n\nFile (${a.name}):\n${a.text}`).join('');
        const stats = this.contextManager.update(historyText + attachmentsText + prompt);
        this.elements.contextBar.style.width = `${Math.min(stats.ratio * 100, 100)}%`;
        if (stats.isFull) this.elements.contextBar.classList.add('full');
        else this.elements.contextBar.classList.remove('full');
        this.updateSendButtonState();
    }

    async checkOllamaStatus() {
        const isOnline = await this.client.checkStatus();
        const indicator = this.elements.statusIndicator;
        const text = indicator.querySelector('.status-text');
        if (isOnline) {
            indicator.classList.remove('status-offline');
            indicator.classList.add('status-online');
            text.textContent = 'Status: Online';
            await this.loadModels();
        } else {
            indicator.classList.remove('status-online');
            indicator.classList.add('status-offline');
            text.textContent = window.location.protocol === 'https:' && this.client.baseUrl.startsWith('http://') ? 'Status: BLOCKED (SECURE_CONTEXT)' : 'Status: Offline';
            this.elements.modelSelect.innerHTML = '<option disabled selected>Offline</option>';
        }
    }

    async loadModels() {
        const models = await this.client.listModels();
        if (models.length > 0) {
            this.elements.modelSelect.innerHTML = models.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
            this.selectedModel = models[0].name;
            this.elements.modelSelect.value = this.selectedModel;
        } else {
            this.elements.modelSelect.innerHTML = '<option disabled selected>No models</option>';
        }
        this.updateSendButtonState();
    }

    updateSendButtonState() {
        if (!this.elements.userInput) return;
        this.elements.sendBtn.disabled = !this.elements.userInput.value.trim() || !this.selectedModel;
    }

    autoResizeInput() {
        const textarea = this.elements.userInput;
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    }

    addArtifact(title, type, content, chartConfig = null) {
        if (!this.elements.artifactPanel) return;

        this.elements.artifactPanel.classList.remove('hidden');
        const emptyState = this.elements.artifactPanelBody.querySelector('.artifact-empty-state');
        if (emptyState) emptyState.remove();

        const card = document.createElement('div');
        card.className = 'artifact-card';
        const icon = type === 'graph' ? '📊' : '📟';
        card.innerHTML = `
            <div class="artifact-card-header">
                <div class="artifact-card-title"><span>${icon}</span> ${title}</div>
            </div>
            <div class="artifact-card-body"></div>
        `;
        const body = card.querySelector('.artifact-card-body');
        if (type === 'graph' && chartConfig) {
            const canvas = document.createElement('canvas');
            body.appendChild(canvas);
            new Chart(canvas, chartConfig);
        } else {
            const pre = document.createElement('pre');
            pre.textContent = content;
            body.appendChild(pre);
        }
        this.elements.artifactPanelBody.insertBefore(card, this.elements.artifactPanelBody.firstChild);
    }

    async handleSendMessage() {
        const userInput = this.elements.userInput.value.trim();
        const attachmentsText = this.fileManager.attachments.map(a => `\n\n[File Attachment: ${a.name}]\n${a.text}`).join('');
        const settings = this.settings.settings;
        const isWebSearch = this.elements.searchWebToggle.checked;
        const safeSearch = settings.safeSearch;
        const selectedTool = this.elements.toolSelect.value;
        if (!userInput || !this.selectedModel) return;

        this.elements.sendBtn.style.display = 'none';
        this.elements.stopBtn.style.display = 'block';
        this.elements.welcomeScreen.classList.add('hidden');

        let searchContext = "";
        let foundImage = null;
        const lowerInput = userInput.toLowerCase();
        const wantsImage = /anime|catgirl|waifu|manga|show|picture|image|pic|photo|art/.test(lowerInput);

        if (wantsImage) {
            const imgLoader = this.addMessage('... [ACQUIRING_VISUAL_DATA] ...', 'ai');
            try {
                if (/anime|catgirl|waifu/.test(lowerInput)) {
                    foundImage = await this.imageService.fetchAnimeImage(userInput, safeSearch);
                }
                if (!foundImage) {
                    const imgResults = await this.searchService.search(userInput, 'images', safeSearch);
                    if (imgResults.length > 0) {
                        foundImage = { url: imgResults[0].url, title: imgResults[0].title, provider: 'Global Search' };
                    } else {
                        foundImage = await this.generalImageService.fetchImage(userInput, settings.unsplashKey, safeSearch);
                    }
                }
                imgLoader.innerHTML = foundImage ? `<em>System: Visual data acquired [Provider: ${foundImage.provider || 'External'}]</em>` : `<em>System: No suitable visual data found.</em>`;
            } catch (e) { imgLoader.innerHTML = `<em>System: Visual uplink failed.</em>`; }
        }

        if (isWebSearch) {
            const searchLoader = this.addMessage('... [RESEARCHING_INTEL] ...', 'ai');
            try {
                const results = await this.searchService.search(userInput, 'text', safeSearch);
                searchContext = `[REAL-TIME WEB DATA FOUND]:\n\n` + results.map((r, i) => `${i + 1}. ${r.title} (${r.url})\n"${r.content}"`).join('\n\n');
                searchLoader.innerHTML = `<em>System: Web search completed (${results.length} sources).</em>`;
            } catch (error) { searchLoader.innerHTML = `<span style="color:red;">System: Web search failed.</span>`; }
        }

        const chatId = this.history.currentChatId;
        const currentChat = this.history.getChat(chatId);
        let historyContext = currentChat ? currentChat.messages.slice(-15).map(m => `${m.role === 'user' ? (settings.username || 'User') : (settings.aiName || 'Assistant')}: ${m.text.replace(/<chart>[\s\S]*?<\/chart>/gi, '')}`).join('\n\n') + '\n\n' : '';

        let toolInstructions = "";
        if (selectedTool === 'graph') {
            toolInstructions = `\n[GRAPH_TOOL_ACTIVE]\nAnalyze the user's request. Your task is to extract numerical data. Output ONLY a text summary here. A chart will be generated in parallel.`;
        } else if (selectedTool === 'code') {
            toolInstructions = `\n[CODE_INTERPRETER_ACTIVE]\nWrite \`\`\`python\ncode\n\`\`\`. The code will be run in a Nix sandbox. You can import libraries like numpy, pandas, matplotlib, requests, PIL, etc.`;
        }

        const combinedSystemPrompt = `${settings.systemPrompt}\nYou MUST use <think> reasoning blocks.\n${toolInstructions}\n[User: ${settings.username}]`;
        const promptWithContext = `${searchContext}\n${historyContext}${attachmentsText}\n\nUser: ${userInput}\nAssistant:`;

        this.history.addMessage(chatId, 'user', userInput);
        this.addMessage(userInput, 'user');
        this.elements.userInput.value = '';
        this.fileManager.attachments = [];
        this.elements.attachmentsContainer.innerHTML = '';
        this.autoResizeInput();
        this.updateContext();
        this.renderHistory();

        const aiMessageContent = this.addMessage('', 'ai', false, foundImage);
        const aiMessageIndex = this.history.addMessage(chatId, 'ai', '', foundImage);
        const loadingText = document.createElement('span');
        loadingText.textContent = '... [GENERATING_RESPONSE] ...';
        aiMessageContent.appendChild(loadingText);

        this.abortController = new AbortController();
        let textBody = document.createElement('div');
        textBody.className = 'text-body';
        aiMessageContent.appendChild(textBody);

        try {
            let finalFullResponse = '';
            const iterations = parseInt(this.elements.deepThinkIterations.value) || 1;
            let currentPromptForLoop = promptWithContext;

            for (let i = 0; i < iterations; i++) {
                let loopResponse = '';
                await this.client.chat(this.selectedModel, currentPromptForLoop, combinedSystemPrompt, (chunk) => {
                    loopResponse += chunk;
                    if (iterations === 1) {
                        if (loadingText.parentNode) loadingText.remove();
                        textBody.innerHTML = this.parseThinkingAndMarkdown(loopResponse);
                        this.detectAndRenderGraphs(textBody, loopResponse);
                    }
                }, this.abortController.signal);
                finalFullResponse = loopResponse;
                currentPromptForLoop += `\n\nAssistant: ${loopResponse}\n\nUser: [INTERNAL_CRITIQUE]`;
            }

            if (loadingText.parentNode) loadingText.remove();
            textBody.innerHTML = this.parseThinkingAndMarkdown(finalFullResponse);
            this.detectAndRenderGraphs(textBody, finalFullResponse);
            this.history.updateMessage(chatId, aiMessageIndex, finalFullResponse);

            // Code execution loop
            if (selectedTool === 'code' && !this.abortController.signal.aborted) {
                let retryCount = 0;
                let currentAiOutput = finalFullResponse;
                let lastResult = null;
                let consoleLog = "";

                while (retryCount <= 1) {
                    const match = currentAiOutput.match(/```python\s*([\s\S]*?)```/);
                    if (!match) break;
                    const code = match[1].trim();
                    const status = document.createElement('div');
                    status.className = 'status-msg';
                    status.style.cssText = 'color:var(--accent);font-style:italic;margin-top:10px;font-size:13px;';
                    status.textContent = retryCount === 0 ? '... [EXECUTING_CODE_ON_NIX] ...' : '... [RETRYING_FIXED_CODE] ...';
                    textBody.appendChild(status);

                    const result = await this.nixService.run(code);
                    status.remove();
                    lastResult = result;
                    const output = `${result.stdout || ''}${result.stderr ? `\n[Errors]:\n${result.stderr}` : ''}`.trim() || 'No output';
                    consoleLog += `\n\n[Turn ${retryCount + 1}]:\n${output}`;

                    // Add to Artifact Panel
                    this.addArtifact(`Code Execution (Turn ${retryCount + 1})`, 'code', output);

                    const isSuccess = result.exit_code === 0;
                    const resDiv = document.createElement('div');
                    resDiv.className = 'code-result-container';
                    resDiv.innerHTML = `<details class="code-execution-details" ${isSuccess ? '' : 'open'}><summary style="color:${isSuccess ? 'var(--accent)' : 'var(--error)'};">${isSuccess ? '📟 Python Success' : '❌ Python Failure (Turn ' + (retryCount + 1) + ', Exit ' + result.exit_code + ')'}</summary><div class="code-output-wrapper"><pre class="code-output">${output}</pre><details class="nix-config-details"><summary>⚙️ View Nix Shell</summary><pre>${result.nix}</pre></details></div></details>`;
                    if (retryCount === 0) textBody.innerHTML = this.parseThinkingAndMarkdown(finalFullResponse);
                    textBody.appendChild(resDiv);

                    if (isSuccess) break;
                    retryCount++;
                    if (retryCount <= 1) {
                        const retryMsg = document.createElement('div');
                        retryMsg.textContent = '... [ANALYZING_ERRORS] ...';
                        textBody.appendChild(retryMsg);
                        const retryPrompt = promptWithContext + `\n\nAssistant: ${currentAiOutput}\n\n[SYSTEM]: Code failed. Error:\n${result.stderr}\nFix it.`;
                        let retryAiRes = '';
                        await this.client.chat(this.selectedModel, retryPrompt, combinedSystemPrompt, (chunk) => { retryAiRes += chunk; }, this.abortController.signal);
                        retryMsg.remove();
                        const analysis = document.createElement('div');
                        analysis.innerHTML = this.parseThinkingAndMarkdown(retryAiRes);
                        textBody.appendChild(analysis);
                        currentAiOutput = retryAiRes;
                    }
                }
                const finalAnLoading = document.createElement('div');
                finalAnLoading.textContent = '... [FINAL_ANALYSIS] ...';
                textBody.appendChild(finalAnLoading);
                const finalAnBody = document.createElement('div');
                textBody.appendChild(finalAnBody);
                const finalAnPrompt = promptWithContext + `\n\nAssistant: ${currentAiOutput}\n\n[SYSTEM]: Execution finished. Results:\n${lastResult?.stdout || 'N/A'}\nSummarize.`;
                let finalResText = '';
                await this.client.chat(this.selectedModel, finalAnPrompt, combinedSystemPrompt, (chunk) => {
                    finalResText += chunk;
                    finalAnBody.innerHTML = this.parseThinkingAndMarkdown(finalResText);
                    this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
                }, this.abortController.signal);
                finalAnLoading.remove();
                this.history.updateMessage(chatId, aiMessageIndex, finalFullResponse + "\n\n---\n**Logs**:\n" + consoleLog + "\n\n---\n**Summary**:\n" + finalResText);
            }

            // Graph tool with improved prompt & artifact redirection
            if (selectedTool === 'graph' && !this.abortController.signal.aborted) {
                const graphPrompt = `Analyze the user's request: "${userInput}". 
Your task is to provide real numerical data for visualization.
Output ONLY a valid JSON object:
{
  "title": "Clear descriptive title",
  "chartType": "line" | "bar" | "pie",
  "labels": ["Label 1", "Label 2", ...],
  "series": [
    {
      "name": "Series Name",
      "data": [Number 1, Number 2, ...]
    }
  ]
}
CRITICAL: USE REAL DATA. NO PLACEHOLDERS. NO MARKDOWN. ONLY JSON.`;

                let jsonRes = '';
                await this.client.chat(this.selectedModel, graphPrompt, "Output ONLY JSON object. No prose.", (chunk, done) => {
                    jsonRes += chunk;
                    if (done) {
                        try {
                            const first = jsonRes.indexOf('{'), last = jsonRes.lastIndexOf('}');
                            if (first !== -1 && last !== -1) {
                                const repaired = this.repairJson(jsonRes.substring(first, last + 1));
                                const parsed = JSON.parse(repaired);
                                const datasets = parsed.series.map((s, i) => ({
                                    label: s.name,
                                    data: s.data,
                                    borderColor: '#6366f1',
                                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                    tension: 0.4,
                                    fill: parsed.chartType !== 'line'
                                }));

                                const config = {
                                    type: parsed.chartType || 'line',
                                    data: { labels: parsed.labels, datasets },
                                    options: {
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: { legend: { display: true }, title: { display: true, text: parsed.title } }
                                    }
                                };

                                // Add to Artifact Panel
                                this.addArtifact(parsed.title || 'Chart Artifact', 'graph', null, config);

                                // Also show in chat but smaller
                                const wrap = document.createElement('div');
                                wrap.className = 'graph-container';
                                wrap.style.cssText = 'background:#fff;padding:15px;border-radius:12px;height:240px;margin-top:10px;border:1px solid var(--border-color);';
                                const canvas = document.createElement('canvas');
                                wrap.appendChild(canvas);
                                textBody.appendChild(wrap);
                                new Chart(canvas, config);
                            }
                        } catch (e) { console.error('Graph build error:', e); }
                    }
                }, this.abortController.signal);
            }

        } catch (error) {
            if (error.name === 'AbortError') textBody.innerHTML += ' [ABORTED]';
            else textBody.innerHTML += `<div style="color:red;padding:10px;">Error: ${error.message}</div>`;
        } finally {
            this.elements.sendBtn.style.display = 'block';
            this.elements.stopBtn.style.display = 'none';
        }
    }

    addMessage(text, role, animate = false, imageData = null) {
        const div = document.createElement('div');
        div.className = `message ${role}-message`;
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = (role === 'user' ? (this.settings.settings.username || 'U') : (this.settings.settings.aiName || 'A')).charAt(0).toUpperCase();
        if (role === 'ai') avatar.style.background = 'var(--accent)';
        const content = document.createElement('div');
        content.className = 'message-content';
        if (imageData) this.renderImage(content, imageData);
        if (role === 'ai') {
            const body = document.createElement('div');
            body.className = 'text-body';
            body.innerHTML = text ? this.parseThinkingAndMarkdown(text) : '';
            content.appendChild(body);
            if (text) this.detectAndRenderGraphs(body, text);
        } else content.textContent = text;
        div.appendChild(avatar);
        div.appendChild(content);
        this.elements.chatContainer.appendChild(div);
        this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
        return content;
    }

    renderImage(container, imageData) {
        const wrap = document.createElement('div');
        wrap.className = 'chat-image-container';
        const img = document.createElement('img');
        img.src = imageData.url;
        img.className = 'chat-image';
        const cap = document.createElement('div');
        cap.className = 'chat-image-caption';
        cap.textContent = `Source: ${imageData.provider || 'Search'}`;
        wrap.appendChild(img);
        wrap.appendChild(cap);
        container.appendChild(wrap);
    }

    parseThinkingAndMarkdown(text) {
        let think = "", main = text;
        const match = text.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
        if (match) {
            think = `<details class="thinking-block" ${!text.includes('</think>') ? 'open' : ''}><summary>Thinking...</summary><div class="thinking-content">${marked.parse(match[1])}</div></details>`;
            main = text.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim();
        }
        return think + marked.parse(main.replace(/<chart>[\s\S]*?<\/chart>/g, ''));
    }

    detectAndRenderGraphs(container, text) {
        const regex = /<chart>\s*(\{[\s\S]*?})\s*<\/chart>/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            try {
                const parsed = JSON.parse(this.repairJson(match[1]));
                const wrap = document.createElement('div');
                wrap.className = 'graph-container';
                wrap.style.cssText = 'background:#fff;padding:15px;height:240px;border-radius:12px;margin-top:10px;border:1px solid var(--border-color);';
                const canvas = document.createElement('canvas');
                wrap.appendChild(canvas);
                container.appendChild(wrap);
                new Chart(canvas, {
                    type: parsed.chartType || 'line',
                    data: {
                        labels: parsed.labels,
                        datasets: parsed.series.map(s => ({
                            label: s.name,
                            data: s.data,
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            fill: parsed.chartType !== 'line'
                        }))
                    },
                    options: { responsive: true, maintainAspectRatio: false }
                });
            } catch (e) { console.error('History graph error:', e); }
        }
    }

    hashCode(s) { return s.split("").reduce(function (a, b) { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0); }
    repairJson(json) {
        if (!json) return json;
        return json.trim().replace(/\/\/[^\n\r"]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/~(\d)/g, '$1').replace(/,\s*([}\]])/g, '$1').replace(/([{,\n])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1 "$2":');
    }
}
