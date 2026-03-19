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
            nixStatusIndicator: document.getElementById('nix-status-indicator')
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
                if (status === 'online') {
                    dot.style.backgroundColor = '#10b981';
                    text.textContent = 'Nix: Online';
                } else {
                    dot.style.backgroundColor = '#f59e0b';
                    text.textContent = 'Nix: Waking...';
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
            // Simulated CPU (Browser cannot see system CPU)
            const cpu = (Math.random() * 15 + 2).toFixed(1);

            // RAM usage (Try performance.memory if available, else simulate)
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
        if (this.elements.settingSafeSearch) {
            this.elements.settingSafeSearch.checked = s.safeSearch;
        }
        if (this.elements.settingAiName) {
            this.elements.settingAiName.value = s.aiName || 'Assistant';
        }
        if (this.elements.settingDisableTokenLimit) {
            this.elements.settingDisableTokenLimit.checked = s.disableTokenLimit;
        }
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

        // File upload events
        this.elements.attachBtn.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

        // Settings events
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

        if (this.elements.settingAiName) {
            this.elements.settingAiName.addEventListener('input', (e) => this.settings.update('aiName', e.target.value));
        }

        if (this.elements.settingDisableTokenLimit) {
            this.elements.settingDisableTokenLimit.addEventListener('change', (e) => this.settings.update('disableTokenLimit', e.target.checked));
        }

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

        // Preview modal
        if (this.elements.closePreview) {
            this.elements.closePreview.addEventListener('click', () => this.elements.previewModal.classList.add('hidden'));
        }
        this.elements.previewModal.addEventListener('click', (e) => {
            if (e.target === this.elements.previewModal) this.elements.previewModal.classList.add('hidden');
        });

        // Suggestion cards
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

    handlePaste(event) {
        const items = (event.clipboardData || event.originalEvent.clipboardData).items;
        const files = [];
        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                if (file) {
                    const name = `pasted-image-${new Date().toLocaleTimeString().replace(/:/g, '-')}.png`;
                    const renamedFile = new File([file], name, { type: file.type });
                    files.push(renamedFile);
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

                this.fileManager.attachments.push({
                    name: file.name,
                    type: file.type,
                    text: text,
                    dataUrl: dataUrl,
                    chip: chip
                });
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
        div.innerHTML = `
            <span class="file-name">${name}</span>
            <span class="file-status"> [WAIT]</span>
            <span class="remove-file" style="cursor:pointer; margin-left:10px;">(X)</span>
        `;
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

            const textHeader = document.createElement('div');
            textHeader.innerHTML = `<br><strong>Extracted Text (OCR):</strong><hr>`;
            this.elements.previewBody.appendChild(textHeader);

            const pre = document.createElement('pre');
            pre.textContent = attachment.text || '[No text extracted]';
            this.elements.previewBody.appendChild(pre);
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
        const fullText = historyText + attachmentsText + prompt;

        const stats = this.contextManager.update(fullText);

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

            // Helpful diagnostic for hosted/CORS environments
            if (window.location.protocol === 'https:' && this.client.baseUrl.startsWith('http://')) {
                text.textContent = 'Status: BLOCKED (SECURE_CONTEXT)';
            } else {
                text.textContent = 'Status: Offline';
            }

            this.elements.modelSelect.innerHTML = '<option disabled selected>Offline</option>';
        }
    }

    async loadModels() {
        const models = await this.client.listModels();
        if (models.length > 0) {
            this.elements.modelSelect.innerHTML = models.map(m =>
                `<option value="${m.name}">${m.name}</option>`
            ).join('');
            this.selectedModel = models[0].name;
            this.elements.modelSelect.value = this.selectedModel;
        } else {
            this.elements.modelSelect.innerHTML = '<option disabled selected>No models</option>';
        }
        this.updateSendButtonState();
    }

    updateSendButtonState() {
        if (!this.elements.userInput) return;
        const hasInput = this.elements.userInput.value.trim().length > 0;
        this.elements.sendBtn.disabled = !hasInput || !this.selectedModel;
    }

    autoResizeInput() {
        const textarea = this.elements.userInput;
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    }

    async handleSendMessage() {
        const userInput = this.elements.userInput.value.trim();
        const attachmentsText = this.fileManager.attachments.map(a => `\n\n[File Attachment: ${a.name}]\n${a.text}`).join('');
        const settings = this.settings.settings;
        const isWebSearch = this.elements.searchWebToggle.checked;
        const safeSearch = settings.safeSearch;
        const selectedTool = this.elements.toolSelect.value;

        if (!userInput || !this.selectedModel) return;

        // Visual feedback for processing
        this.elements.sendBtn.style.display = 'none';
        this.elements.stopBtn.style.display = 'block';
        this.elements.welcomeScreen.classList.add('hidden');

        // Real Web Search if enabled
        let searchContext = "";
        let foundImage = null;

        // Analysis of intent
        const lowerInput = userInput.toLowerCase();
        // Broader regex to catch more anime-related terms for Nekosia
        const animeRegex = /\banime\b|\bcatgirl\b|\bwaifu\b|\bmanga\b|\bfoxgirl\b|\bwolfgirl\b|\bmaid\b|\bvtuber\b|\bheadphones\b/i;
        const imageRegex = /\bshow\b|\bpicture\b|\bimage\b|\bpic\b|\bphoto\b|\bart\b|\blook like\b/i;

        const isAnime = animeRegex.test(lowerInput);
        const wantsImage = isAnime || imageRegex.test(lowerInput);

        console.log(`[UIController] Message intent - isAnime: ${isAnime}, wantsImage: ${wantsImage}, Safe Search: ${safeSearch}`);

        // 1. Automatic Image Fetching (Independent of Web Search Toggle)
        if (wantsImage) {
            console.log('[UIController] Triggering automatic image acquisition...');
            const imgLoader = this.addMessage('... [ACQUIRING_VISUAL_DATA] ...', 'ai');
            try {
                if (isAnime) {
                    foundImage = await this.imageService.fetchAnimeImage(userInput, safeSearch);
                }

                // Fallback to general image search if no anime image or not anime intent
                if (!foundImage) {
                    console.log('[UIController] Attempting general search via primary service');
                    const imgResults = await this.searchService.search(userInput, 'images', safeSearch);
                    if (imgResults.length > 0) {
                        foundImage = {
                            url: imgResults[0].url,
                            title: imgResults[0].title,
                            artist: null,
                            provider: 'Global Search'
                        };
                    } else {
                        // High-quality fallback if key is present
                        console.log('[UIController] Falling back to high-quality general image service');
                        foundImage = await this.generalImageService.fetchImage(userInput, settings.unsplashKey, safeSearch);
                    }
                }

                if (foundImage) {
                    console.log('[UIController] Image acquisition successful:', foundImage);
                    imgLoader.innerHTML = `<em>System: Visual data acquired and displayed. [Provider: ${foundImage.provider || 'External'}]</em>`;
                } else {
                    console.warn('[UIController] No image found after all attempts.');
                    imgLoader.innerHTML = `<em>System: No suitable visual data found in records.</em>`;
                }
            } catch (e) {
                console.error('[UIController] Error during image acquisition:', e);
                imgLoader.innerHTML = `<span style="color:var(--text-secondary);">System: Visual uplink failed.</span>`;
            }
        }

        // 2. Real Web Search (If toggled)
        if (isWebSearch) {
            const searchLoader = this.addMessage('... [RESEARCHING_INTEL] ...', 'ai');
            try {
                const results = await this.searchService.search(userInput, 'text', safeSearch);
                searchContext = `[REAL-TIME WEB DATA FOUND]:\n\n`;
                results.forEach((r, i) => {
                    searchContext += `${i + 1}. ${r.title} (${r.url})\n"${r.content}"\n\n`;
                });
                searchLoader.innerHTML = `<em>System: Web search completed. ${results.length} sources integrated.</em>`;
            } catch (error) {
                searchLoader.innerHTML = `<span style="color:red;">System: Web search failed. Proceeding with offline data.</span>`;
            }
        }

        const chatId = this.history.currentChatId;
        const currentChat = this.history.getChat(chatId);

        // Build conversation context from history
        let historyContext = "";
        if (currentChat && currentChat.messages.length > 0) {
            // Respect the 'Disable History Limit' setting
            const messagesToInclude = settings.disableTokenLimit ?
                currentChat.messages :
                currentChat.messages.slice(-15); // Default focus window

            historyContext = messagesToInclude.map(m => {
                const label = m.role === 'user' ? (settings.username || 'User') : (settings.aiName || 'Assistant');
                // Clean up text by removing internal tags for context
                const cleanText = m.text.replace(/<chart>[\s\S]*?<\/chart>/gi, '').trim();
                return `${label}: ${cleanText}`;
            }).join('\n\n') + '\n\n';
        }

        // Persona and Time details
        let identityContext = `[User Identity: ${settings.username}]\n`;
        if (settings.includeTime) {
            const now = new Date();
            identityContext += `[Current Time: ${now.toLocaleTimeString()} ${now.toLocaleDateString()}]\n`;
        }

        // Final combined prompt for the AI
        let systemNote = "";
        if (foundImage) {
            systemNote = `\n[CRITICAL_SYSTEM_NOTE: An image result has already been displayed to the user: ${foundImage.url}. Briefly acknowledge that you are showing them the image they requested. DO NOT hallucinate or summarize unrelated websites unless specifically instructed.]\n`;
        }

        let toolInstructions = "";
        if (selectedTool === 'graph') {
            toolInstructions = `\n[GRAPH_TOOL_ACTIVE]\nA chart will be automatically rendered from data for the user. Your job in this response is ONLY to provide a brief 2-3 sentence text summary of the data/answer. DO NOT write any code (no Python, no JavaScript, no pseudocode). DO NOT suggest how to plot anything. DO NOT show implementation steps. The graph is handled automatically.`;
        } else if (selectedTool === 'code') {
            toolInstructions = `\n[CODE_INTERPRETER_ACTIVE]\nYou have access to a Python execution environment (Nix-based). 
If you need to calculate something or run logic, write a Python code block: \`\`\`python\nprint(2+2)\n\`\`\`. 
The system will capture your code, execute it, and provide the output in a follow-up turn. 
IMPORTANT: Your first response should ONLY contain the code block you want to run. After you get the output, you can provide the final analysis.`;
        }

        const thinkingInstruction = `
[INSTRUCTION: INTERNAL_MONOLOGUE]
You MUST start your response with a <think> block containing your step-by-step reasoning.
Your actual response to the user must follow the closing </think> tag.`;

        const combinedSystemPrompt = `${settings.systemPrompt}\n${thinkingInstruction}\n${toolInstructions}\n[User Context: Identity=${settings.username}]`.trim();

        // 3. Deep Thinking / Multi-Step Reasoning
        const isDeepThink = this.elements.deepThinkToggle.checked;
        const iterations = parseInt(this.elements.deepThinkIterations.value) || 1;

        const promptWithContext = `${searchContext}${systemNote}${identityContext}\n${historyContext}${attachmentsText}\n\nUser: ${userInput}\nAssistant:`;

        // Update UI and History state
        this.history.addMessage(chatId, 'user', userInput);

        this.elements.userInput.value = '';
        this.fileManager.attachments = [];
        this.elements.attachmentsContainer.innerHTML = '';
        this.autoResizeInput();
        this.updateContext();
        this.renderHistory();

        this.addMessage(userInput + (attachmentsText ? `\n\n(Attachments processed: ${this.fileManager.attachments.length})` : ''), 'user');

        const aiMessageContent = this.addMessage('', 'ai', false, foundImage);
        const aiMessageIndex = this.history.addMessage(chatId, 'ai', '', foundImage);

        const loadingText = document.createElement('span');
        loadingText.textContent = '... [GENERATING_RESPONSE] ...';
        aiMessageContent.appendChild(loadingText);

        this.abortController = new AbortController();

        try {
            let fullResponse = '';
            // Create or find a text body for the streaming response so it doesn't wipe media
            let textBody = aiMessageContent.querySelector('.text-body');
            if (!textBody) {
                textBody = document.createElement('div');
                textBody.className = 'text-body';
                aiMessageContent.appendChild(textBody);
            }

            let currentPrompt = promptWithContext;
            let finalFullResponse = '';

            for (let i = 0; i < iterations; i++) {
                let loopResponse = '';
                const iterLabel = iterations > 1 ? ` [ITERATION ${i + 1}/${iterations}]` : '';
                loadingText.textContent = `... [GENERATING_RESPONSE${iterLabel}] ...`;

                await this.client.chat(this.selectedModel, currentPrompt, combinedSystemPrompt, (chunk, done) => {
                    loopResponse += chunk;

                    // In multi-step, we only show intermediate results in thinking blocks or as a preview
                    if (iterations === 1) {
                        if (loadingText.parentNode) loadingText.remove();
                        const processedContent = this.parseThinkingAndMarkdown(loopResponse);
                        textBody.innerHTML = processedContent;
                        this.detectAndRenderGraphs(textBody, loopResponse);
                    }

                    this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
                }, this.abortController.signal);

                if (iterations > 1) {
                    // Update context for next iteration: Original Prompt + Previous Response + Self-Critique Instruction
                    currentPrompt += `\n\nAssistant: ${loopResponse}\n\nUser: [INTERNAL_CRITIQUE: Consider your previous response. Refine it, check for errors, and provide a ${i === iterations - 1 ? 'FINAL' : 'BETTER'} answer.]\nAssistant:`;
                    finalFullResponse = loopResponse; // The last one is the "best" one
                } else {
                    finalFullResponse = loopResponse;
                }
            }

            if (loadingText.parentNode) loadingText.remove();
            const finalProcessed = this.parseThinkingAndMarkdown(finalFullResponse);
            textBody.innerHTML = finalProcessed;
            this.detectAndRenderGraphs(textBody, finalFullResponse);

            this.history.updateMessage(chatId, aiMessageIndex, finalFullResponse);

            // 4. Code Execution Tool
            if (selectedTool === 'code' && !this.abortController.signal.aborted) {
                const codeMatch = finalFullResponse.match(/```python\s*([\s\S]*?)```/);
                if (codeMatch) {
                    const code = codeMatch[1].trim();
                    const loadingMsg = document.createElement('div');
                    loadingMsg.className = 'status-msg';
                    loadingMsg.style.cssText = 'color: var(--accent); font-style: italic; margin-top: 10px; font-size: 13px; font-family: Outfit;';
                    loadingMsg.textContent = '... [EXECUTING_CODE_ON_NIX] ...';
                    textBody.appendChild(loadingMsg);

                    try {
                        const result = await this.nixService.run(code);
                        loadingMsg.remove();
                        const outputMsg = `\n\n[Python Console]:\n${result.stdout || 'No stdout output'}${result.stderr ? `\n\n[Errors]:\n${result.stderr}` : ''}\n\n[System]: Exit Code ${result.exit_code}`;

                        // Display the output clearly
                        const outputDisplay = document.createElement('div');
                        outputDisplay.style.cssText = 'background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; border-left: 3px solid var(--accent); margin-top: 15px; font-family: monospace; white-space: pre-wrap; font-size: 13px;';
                        outputDisplay.textContent = outputMsg;
                        textBody.appendChild(outputDisplay);

                        // Capture combined state
                        let combinedForHistory = finalFullResponse + outputMsg;

                        // Second turn for analysis
                        const analysisLoading = document.createElement('div');
                        analysisLoading.className = 'status-msg';
                        analysisLoading.style.cssText = 'color: var(--accent); font-style: italic; margin-top: 10px; font-size: 13px; font-family: Outfit;';
                        analysisLoading.textContent = '... [INTERPRETING_RESULTS] ...';
                        textBody.appendChild(analysisLoading);

                        const finalPrompt = currentPrompt + `\n\nAssistant: ${finalFullResponse}\n\nUser: [RESULTS_FROM_PYTHON_EXECUTION]\n${outputMsg}\n\nAssistant: [FINAL_ANALYSIS]`;

                        let finalAnalysis = '';
                        await this.client.chat(this.selectedModel, finalPrompt, combinedSystemPrompt, (chunk, done) => {
                            finalAnalysis += chunk;
                            // Prepend everything because we want to see the thinking of the final analysis too if it exists
                            const currentFull = finalFullResponse + "\n\n--- Code Execution ---\n" + outputMsg + "\n\n--- Final Analysis ---\n" + finalAnalysis;
                            textBody.innerHTML = this.parseThinkingAndMarkdown(currentFull);
                            this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
                        }, this.abortController.signal);

                        if (analysisLoading.parentNode) analysisLoading.remove();
                        finalFullResponse = finalFullResponse + "\n\n--- Code Execution Results ---\n" + outputMsg + "\n\n--- Final Analysis ---\n" + finalAnalysis;
                        this.history.updateMessage(chatId, aiMessageIndex, finalFullResponse);
                    } catch (e) {
                        if (loadingMsg.parentNode) loadingMsg.remove();
                        textBody.innerHTML += `<div style="color:var(--error); margin-top:10px;">Execution Failed: ${e.message}</div>`;
                    }
                }
            }

            // 4. Separate Tool Call for Graphs — ask for SIMPLE data, build Chart.js config ourselves
            if (selectedTool === 'graph' && !this.abortController.signal.aborted) {
                loadingText.textContent = `... [GENERATING_GRAPH_DATA] ...`;
                aiMessageContent.appendChild(loadingText);

                const graphSystem = `You are a data serializer. Output ONLY a single-line compact valid JSON object. Absolutely forbidden: // comments, /* comments */, ~ tilde, ... ellipsis, placeholder text like "L1" or "Series1", markdown, prose, code blocks. Every number in every data array must be a real numeric value.`;

                const graphPrompt = `For the question: "${userInput}"

Output a single compact JSON object using this EXACT schema (replace values with real data):
{"title":"India vs China Population","chartType":"line","labels":["2019","2020","2021","2022","2023"],"series":[{"name":"India","data":[1366,1380,1393,1406,1428]},{"name":"China","data":[1402,1411,1412,1412,1409]}]}

STRICT RULES — violating any of these will break the app:
- NO // comments inside JSON
- NO ~ before numbers (forbidden: ~15, use 15)
- NO ... or placeholder values (every array element must be a real number)
- NO markdown, no code fences, no prose
- "labels" and every "data" array MUST have the same length
- "name" values must be real names (e.g. "India", "GDP", "Temperature") NOT "Series1"
- "chartType" must be exactly: line, bar, or pie
- Output ONLY the JSON, starting with { and ending with }`;


                const COLORS = [
                    { border: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
                    { border: '#f43f5e', bg: 'rgba(244,63,94,0.12)' },
                    { border: '#10b981', bg: 'rgba(16,185,129,0.12)' },
                    { border: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
                    { border: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
                ];

                let graphJsonPart = '';
                await this.client.chat(this.selectedModel, graphPrompt, graphSystem, (chunk, done) => {
                    graphJsonPart += chunk;
                    if (done) {
                        console.log('[UIController] Raw graph response:', graphJsonPart);
                        try {
                            // Strip <think> blocks, code fences, and surrounding prose
                            let jsonStr = graphJsonPart.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                            const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                            if (fence) jsonStr = fence[1];
                            const first = jsonStr.indexOf('{');
                            const last = jsonStr.lastIndexOf('}');
                            if (first !== -1 && last !== -1) jsonStr = jsonStr.substring(first, last + 1);
                            jsonStr = this.repairJson(jsonStr);

                            const parsed = JSON.parse(jsonStr);
                            if (!parsed.labels || !parsed.series) throw new Error('Missing labels or series');

                            const datasets = (parsed.series || []).map((s, i) => ({
                                label: s.name || `Series ${i + 1}`,
                                data: s.data,
                                borderColor: COLORS[i % COLORS.length].border,
                                backgroundColor: COLORS[i % COLORS.length].bg,
                                fill: (parsed.chartType === 'line') ? false : true,
                                tension: 0.4,
                                borderWidth: 2.5,
                                pointRadius: 5,
                                pointHoverRadius: 8,
                            }));

                            const chartConfig = {
                                type: parsed.chartType || 'line',
                                data: { labels: parsed.labels, datasets },
                                options: {
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: { position: 'top', labels: { font: { family: 'Inter, sans-serif' } } },
                                        title: { display: true, text: parsed.title || userInput, font: { size: 15, family: 'Inter, sans-serif' } },
                                    },
                                    scales: parsed.chartType === 'pie' ? undefined : {
                                        y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,0.06)' } },
                                        x: { grid: { display: false } },
                                    },
                                },
                            };

                            const jsonHash = this.hashCode(jsonStr);
                            if (!textBody.querySelector(`[data-graph-hash="${jsonHash}"]`)) {
                                const wrap = document.createElement('div');
                                wrap.className = 'graph-container';
                                wrap.style.cssText = 'background:#fff;padding:24px;border-radius:16px;margin:20px 0;height:340px;box-shadow:0 4px 20px rgba(0,0,0,.1);';
                                wrap.setAttribute('data-graph-hash', jsonHash);
                                const canvas = document.createElement('canvas');
                                wrap.appendChild(canvas);
                                textBody.appendChild(wrap);
                                new Chart(canvas, chartConfig);
                                console.log('[UIController] ✅ Chart rendered!');
                            }

                            if (loadingText.parentNode) loadingText.remove();
                            const persistentResponse = finalFullResponse + `\n\n<chart>${jsonStr}</chart>`;
                            this.history.updateMessage(chatId, aiMessageIndex, persistentResponse);

                        } catch (e) {
                            console.error('[UIController] Graph build failed:', e, 'Raw:', graphJsonPart);
                            if (loadingText.parentNode) loadingText.remove();
                        }
                    }
                }, this.abortController.signal);
            }


            this.elements.sendBtn.style.display = 'block';
            this.elements.stopBtn.style.display = 'none';

        } catch (error) {
            if (loadingText.parentNode) loadingText.remove();
            this.elements.sendBtn.style.display = 'block';
            this.elements.stopBtn.style.display = 'none';

            if (error.name === 'AbortError') {
                const finalStopText = fullResponse + ' [USER_INTERRUPTED]';
                this.history.updateMessage(chatId, aiMessageIndex, finalStopText);

                let textBody = aiMessageContent.querySelector('.text-body');
                if (textBody) textBody.innerHTML = marked.parse(finalStopText);
            } else {
                let textBody = aiMessageContent.querySelector('.text-body');
                if (textBody) {
                    textBody.innerHTML += `
                        <div style="color:red; border:1px solid red; padding:10px; margin-top:10px;">
                            CONNECTION_ERROR: UNABLE TO REACH OLLAMA.
                        </div>
                    `;
                }
            }
        }
    }

    addMessage(text, role, animate = false, imageData = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;

        // Staggered entry for that institutional scan-line feel
        if (animate) messageDiv.style.opacity = '0';

        // Add Avatar
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';

        if (role === 'user') {
            const avatar = this.settings.settings.avatar;
            if (avatar) {
                avatarDiv.innerHTML = `<img src="${avatar}" alt="User">`;
            } else {
                avatarDiv.textContent = (this.settings.settings.username || 'U').charAt(0).toUpperCase();
            }
        } else {
            const aiAvatar = this.settings.settings.aiAvatar;
            if (aiAvatar) {
                avatarDiv.innerHTML = `<img src="${aiAvatar}" alt="${this.settings.settings.aiName}">`;
            } else {
                avatarDiv.textContent = (this.settings.settings.aiName || 'A').charAt(0).toUpperCase();
                avatarDiv.style.background = 'var(--accent)';
                avatarDiv.style.color = '#fff';
            }
        }

        const content = document.createElement('div');
        content.className = 'message-content';

        // If we have image data, render it first
        if (imageData) {
            this.renderImage(content, imageData);
        }

        if (role === 'ai') {
            const textBody = document.createElement('div');
            textBody.className = 'text-body';
            textBody.innerHTML = text ? this.parseThinkingAndMarkdown(text) : '';
            content.appendChild(textBody);

            // Trigger graph detection for history/loaded messages
            if (text) this.detectAndRenderGraphs(textBody, text);
        } else {
            content.textContent = text;
        }

        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(content);
        this.elements.chatContainer.appendChild(messageDiv);
        this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;

        return content;
    }

    renderImage(container, imageData) {
        console.log('[UIController] renderImage called with:', imageData);
        if (!imageData || !imageData.url) {
            console.error('[UIController] Invalid imageData passed to renderImage');
            return;
        }
        const imgContainer = document.createElement('div');
        imgContainer.className = 'chat-image-container';

        const img = document.createElement('img');
        img.src = imageData.url;
        img.className = 'chat-image';
        img.title = 'Click to expand';
        img.addEventListener('click', () => this.showPreview({
            name: imageData.title || 'Image Result',
            type: 'image/png',
            dataUrl: imageData.url,
            text: `Resource provided by: ${imageData.provider || 'Global Search'}`
        }));

        const caption = document.createElement('div');
        caption.className = 'chat-image-caption';

        let captionText = `Source: ${imageData.provider || 'Global Search'}`;
        if (imageData.artist && imageData.artist !== 'Unknown') {
            captionText += ` (Artist: ${imageData.artist})`;
        }
        caption.textContent = captionText;

        imgContainer.appendChild(img);
        imgContainer.appendChild(caption);
        container.appendChild(imgContainer);
    }

    resetChat() {
        this.elements.chatContainer.innerHTML = '';
        this.elements.chatContainer.appendChild(this.elements.welcomeScreen);
        this.elements.welcomeScreen.classList.remove('hidden');
        this.elements.userInput.value = '';
        this.autoResizeInput();
        this.updateSendButtonState();
    }

    parseThinkingAndMarkdown(text) {
        let thinkingHtml = "";
        let mainContent = text;

        // Extract <think> content
        const thinkMatch = text.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
        if (thinkMatch) {
            const thinkingText = thinkMatch[1].trim();
            if (thinkingText) {
                thinkingHtml = `
                    <details class="thinking-block" ${!text.includes('</think>') ? 'open' : ''}>
                        <summary>Thinking Process...</summary>
                        <div class="thinking-content">${marked.parse(thinkingText)}</div>
                    </details>
                `;
            }
            mainContent = text.replace(/<think>[\s\S]*?(?:<\/think>|$)/, '').trim();
        }

        // Remove <chart> tags and legacy chart JSON blocks from the rendered text
        mainContent = mainContent.replace(/<chart>[\s\S]*?<\/chart>/g, '');
        mainContent = mainContent.replace(/```json\s*\{[\s\S]*?"type"\s*:\s*"chart"[\s\S]*?\}\s*```/g, '');

        return thinkingHtml + marked.parse(mainContent);
    }

    detectAndRenderGraphs(container, text) {
        if (!window.Chart) {
            console.error('[UIController] Chart.js not loaded!');
            return;
        }

        const COLORS = [
            { border: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
            { border: '#f43f5e', bg: 'rgba(244,63,94,0.12)' },
            { border: '#10b981', bg: 'rgba(16,185,129,0.12)' },
            { border: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
            { border: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
        ];

        const regex = /<chart>\s*(\{[\s\S]*?})\s*<\/chart>/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            try {
                const repairedJson = this.repairJson(match[1]);
                const parsed = JSON.parse(repairedJson);
                const jsonHash = this.hashCode(repairedJson);

                if (container.querySelector(`[data-graph-hash="${jsonHash}"]`)) continue;

                let chartConfig;

                if (parsed.series && parsed.labels) {
                    // NEW simple schema: {title, chartType, labels, series:[{name,data}]}
                    const datasets = parsed.series.map((s, i) => ({
                        label: s.name || `Series ${i + 1}`,
                        data: s.data,
                        borderColor: COLORS[i % COLORS.length].border,
                        backgroundColor: COLORS[i % COLORS.length].bg,
                        fill: parsed.chartType === 'line' ? false : true,
                        tension: 0.4,
                        borderWidth: 2.5,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                    }));
                    chartConfig = {
                        type: parsed.chartType || 'line',
                        data: { labels: parsed.labels, datasets },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { position: 'top', labels: { font: { family: 'Inter, sans-serif' } } },
                                title: { display: true, text: parsed.title || '', font: { size: 15, family: 'Inter, sans-serif' } },
                            },
                            scales: parsed.chartType === 'pie' ? undefined : {
                                y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,0.06)' } },
                                x: { grid: { display: false } },
                            },
                        },
                    };
                } else if (parsed.config) {
                    // LEGACY schema: {type:"chart", config:{...chartjs config}}
                    chartConfig = parsed.config;
                    if (!chartConfig.options) chartConfig.options = {};
                    chartConfig.options.responsive = true;
                    chartConfig.options.maintainAspectRatio = false;
                } else {
                    console.warn('[UIController] Unrecognised graph schema:', parsed);
                    continue;
                }

                const wrap = document.createElement('div');
                wrap.className = 'graph-container';
                wrap.style.cssText = 'background:#fff;padding:24px;border-radius:16px;margin:20px 0;height:340px;box-shadow:0 4px 20px rgba(0,0,0,.1);';
                wrap.setAttribute('data-graph-hash', jsonHash);
                const canvas = document.createElement('canvas');
                wrap.appendChild(canvas);
                container.appendChild(wrap);
                new Chart(canvas, chartConfig);
                console.log('[UIController] ✅ Chart rendered from history (schema:', parsed.series ? 'simple' : 'legacy', ')');

            } catch (e) {
                console.error('[UIController] Graph render error:', e);
            }
        }
    }


    hashCode(s) {
        return s.split("").reduce(function (a, b) { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
    }

    repairJson(json) {
        if (!json) return json;
        let r = json.trim();

        // 1. Strip JS/C++ style single-line comments (// ...)
        r = r.replace(/\/\/[^\n\r"]*/g, '');

        // 2. Strip JS block comments (/* ... */)
        r = r.replace(/\/\*[\s\S]*?\*\//g, '');

        // 3. Remove tilde ~ approximation prefix on numbers: ~15 -> 15
        r = r.replace(/~(\d)/g, '$1');

        // 4. Remove ellipsis placeholders: [..., ...] or "..." values
        // Remove bare ... tokens in arrays/values
        r = r.replace(/,\s*\.\.\.\s*/g, '');
        r = r.replace(/\.\.\.\s*,/g, '');
        r = r.replace(/:\s*\.\.\./g, ': null');

        // 5. Remove trailing commas before ] or }
        r = r.replace(/,\s*([}\]])/g, '$1');

        // 6. Fix unquoted keys: { key: "val" } -> { "key": "val" }
        r = r.replace(/([{,\n])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1 "$2":');

        // 7. Fix single-quoted keys: { 'key': } -> { "key": }
        r = r.replace(/([{,\n])\s*'([a-zA-Z0-9_]+)'\s*:/g, '$1 "$2":');

        // 8. Remove any lines that become empty objects from comment stripping
        r = r.replace(/,\s*,/g, ',');

        return r;
    }
}
