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
            contextLimit: 8192,
            ollamaUrl: 'http://localhost:11434',
            geminiApiKey: '',
            imagenModel: 'google/imagen-4.0-fast',
            imagineService: 'a1111',
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

        // Thinking toggle — disabled by default (DeepSeek R1, Qwen 3, etc.)
        thinkEnabled: false,

        statusText: 'Connecting...',
        statusClass: '',
        nixOnline: false,
        backendUrl: 'https://ollamas-ahh.onrender.com',

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

            // Fetch config.json for backend URL
            try {
                const configRes = await fetch('config.json');
                if (configRes.ok) {
                    const config = await configRes.json();
                    if (config.backendUrl) this.backendUrl = config.backendUrl;
                }
            } catch (e) {
                console.warn('Could not load config.json, using default backend:', e);
            }

            this.client = new modules.OllamaClient(this.settings.ollamaUrl, this.settings.geminiApiKey);
            this.history = new modules.HistoryManager();
            this.fileManager = new modules.FileManager();
            this.contextManager = new modules.ContextManager(this.settings.contextLimit);
            this.searchService = new modules.SearchService(this.backendUrl);
            this.imageService = new modules.ImageService();
            this.generalImageService = new modules.GeneralImageService();
            this.nixService = new modules.NixService(this.backendUrl);
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
            this.$nextTick(() => this.scrollToBottom());
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
            // Render any charts that were saved in message history
            this.$nextTick(() => {
                setTimeout(() => this._renderSavedCharts(), 200);
            });
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
            const selectedTool = this.selectedTool;
            const isWebSearch = this.searchWeb;
            const safeSearch = this.settings.safeSearch;

            this.addMessageToChat('user', text);
            this.userInput = '';
            this.onInputChange();
            this.isStreaming = true;
            this.errorMessage = '';
            this.$nextTick(() => this.scrollToBottom());

            let searchContext = "";
            if (isWebSearch) {
                const searchMsgIdx = this.messages.length;
                this.messages.push({
                    id: searchMsgIdx, role: 'ai', text: '... [REFINING_SEARCH_QUERY] ...', html: '<em>... [REFINING_SEARCH_QUERY] ...</em>',
                    thinking: '', reaction: null, isStreaming: false, imageData: null
                });
                this.$nextTick(() => this.scrollToBottom());

                try {
                    // Step 1: Build conversation context for search refinement
                    const conversationContext = this.messages
                        .filter(m => m.role !== 'ai' || m.text)
                        .filter(m => !(m.role === 'ai' && m.text.includes('[REFINING_SEARCH_QUERY]')))
                        .slice(-10) // Last 10 messages for context window
                        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
                        .join('\n\n');

                    // Step 2: Refine the user's prompt into a search query WITH full conversation context
                    const refinementPrompt = `You are a search query optimizer. Your job is to create the most effective search query based on the user's current request AND the ongoing conversation context.

**Conversation so far:**
${conversationContext}

**Current user request:** "${text}"

Your task:
1. Understand what the user is asking NOW in the context of what was already discussed
2. If they're building on a previous topic, include relevant context from earlier messages
3. If they changed topics, focus only on the new request
4. Output ONLY the search query string — no explanations, no quotes, no markdown

Rules:
- Keep it concise (5-15 words ideal)
- Include key entities, concepts, and relationships from the conversation
- If the user says "more about that" or "what else", reference the earlier topic
- Output ONLY the raw search query`;
                    let refinedQuery = "";
                    await this.client.chat(this.selectedModel, refinementPrompt, "You are a search query optimizer. Output ONLY the search query string.", (chunk) => {
                        refinedQuery += chunk;
                    }, this.abortController.signal);

                    refinedQuery = refinedQuery.trim().replace(/^"(.*)"$/, '$1'); // Remove wrapping quotes if AI adds them
                    this.messages[searchMsgIdx].text = `... [SEARCHING: "${refinedQuery}"] ...`;
                    this.messages[searchMsgIdx].html = `<em>... [SEARCHING: "${refinedQuery}"] ...</em>`;
                    this.$nextTick(() => this.scrollToBottom());

                    // Step 2: Perform the actual search with the refined query
                    const results = await this.searchService.search(refinedQuery, 'text', safeSearch);

                    // Build contextual wrapper for search results — tells the AI what the user was discussing
                    const searchContextSummary = this.messages
                        .filter(m => m.role === 'user' && m.text !== text)
                        .slice(-3)
                        .map(m => m.text.substring(0, 100))
                        .join(' | ');

                    searchContext = `[REAL-TIME WEB SEARCH — CONTEXT-AWARE RESULTS]\n` +
                        `[Search query: "${refinedQuery}" (refined from user request: "${text}")]\n` +
                        `[Conversation topic: ${searchContextSummary || 'New topic'}]\n\n` +
                        `Use these web results to answer the user's question in the context of your ongoing conversation:\n\n` +
                        results.map((r, i) => `${i + 1}. ${r.title} (${r.url})\n"${r.content}"`).join('\n\n') +
                        `\n\n[END OF WEB RESULTS — Use conversation context above to maintain continuity when answering.]`;

                    this.messages[searchMsgIdx].text = `System: Web search completed for "${refinedQuery}" (${results.length} sources).`;
                    this.messages[searchMsgIdx].html = `<em>System: Web search completed for "${refinedQuery}" (${results.length} sources).</em>`;
                } catch (error) {
                    console.error('Search error:', error);
                    this.messages[searchMsgIdx].text = 'System: Web search failed.';
                    this.messages[searchMsgIdx].html = `<span style="color:red;">System: Web search failed.</span>`;
                }
                this.$nextTick(() => this.scrollToBottom());
            }

            const ctx = this.buildContextText(searchContext);
            const sys = this.buildSystemPrompt();

            const mi = this.messages.length;
            this.messages.push({
                id: mi, role: 'ai', text: '', html: '',
                thinking: '', reaction: null, isStreaming: true, imageData: null
            });

            try {
                let full = '';
                let thinking = '';
                const iterations = this.deepThink ? (this.deepThinkIterations || 1) : 1;
                let currentCtx = ctx;

                for (let i = 0; i < iterations; i++) {
                    full = '';
                    thinking = '';
                    if (i > 0) {
                        this.messages[mi].text += `\n\n--- [Deep Think Iteration ${i+1}] ---\n\n`;
                        currentCtx += `\n\nAssistant: ${this.messages[mi].text}\n\nUser: [INTERNAL_CRITIQUE: Analyze the previous response for accuracy and depth, then provide an improved final answer.]\n\nAssistant:`;
                    }

                    await this.client.chat(this.selectedModel, currentCtx, sys, (chunk, done, thinkingContent) => {
                        if (thinkingContent && thinkingContent !== thinking) {
                            thinking = thinkingContent;
                            this.messages[mi].thinking = this.renderMarkdown(thinking);
                        }
                        if (chunk && !thinkingContent && chunk.includes('<think>')) {
                            const p = chunk.split('<think>');
                            full += p[0]; thinking = p[1] || '';
                        } else if (chunk && !thinkingContent && chunk.includes('</think>') && thinking) {
                            const p = chunk.split('</think>');
                            thinking += p[0]; full += p[1] || '';
                            this.messages[mi].thinking = this.renderMarkdown(thinking);
                        } else if (chunk) {
                            full += chunk;
                        }
                        if (chunk || thinkingContent) {
                            // In iterations, we might want to append or replace. 
                            // For simplicity, we'll replace the text of the CURRENT iteration part.
                            // But here we'll just update the whole message text for the final iteration.
                            if (iterations === 1) {
                                this.messages[mi].text = full;
                            } else {
                                // For multi-iteration, we show progress
                                // In a real "Deep Think", you usually only show the FINAL result, 
                                // but showing iterations is cooler for a "Power User" UI.
                                const base = this.messages[mi].text.split(`--- [Deep Think Iteration`)[0];
                                let prevIters = "";
                                for(let j=1; j<i+1; j++) {
                                     // This is getting complex, let's just keep it simple: 
                                     // concatenate if it's not the first one.
                                }
                                this.messages[mi].text = (i === 0 ? full : this.messages[mi].text.split(`--- [Deep Think Iteration ${i+1}] ---`)[0] + `--- [Deep Think Iteration ${i+1}] ---\n\n` + full);
                            }
                            this.messages[mi].html = this.renderMarkdown(this.messages[mi].text);
                            this.$nextTick(() => this.scrollToBottom());
                        }
                        if (done && i === iterations - 1) {
                            this.messages[mi].isStreaming = false;
                            this.isStreaming = false;
                            this.updateContext();
                            this.$nextTick(() => this.scrollToBottom());
                        }
                    }, this.abortController.signal, this.thinkEnabled);
                }

                // Chat done — keep isStreaming=true during tool execution
                // so stop button remains active

                if (selectedTool === 'graph') {
                    await this.executeGraph(text, mi, full);
                } else if (selectedTool === 'code') {
                    await this.executeCode(text, ctx, sys, mi, full);
                } else if (selectedTool === 'image-gen') {
                    await this.executeImageGen(text, mi, full);
                } else if (selectedTool === 'imagine-gen') {
                    await this.executeImagineGen(text, mi, full);
                }

                // Save FINAL enriched message (with tool results) to history
                this._saveAiMessage(mi);

                // All done
                this.isStreaming = false;
                this.abortController = null;
                this.$nextTick(() => this.scrollToBottom());

            } catch (err) {
                this.isStreaming = false;
                this.abortController = null;
                if (err.name !== 'AbortError') {
                    this.errorMessage = `Error: ${err.message || 'Model busy—try regenerate'}`;
                    if (this.messages.length && this.messages[this.messages.length - 1].role === 'ai' && !this.messages[this.messages.length - 1].text)
                        this.messages.pop();
                }
                this.$nextTick(() => this.scrollToBottom());
            }
        },

        // Save AI message to history — idempotent, updates existing if found
        _saveAiMessage(mi) {
            const chat = this.history.getChat(this.currentChatId);
            if (!chat) return;
            const msg = this.messages[mi];
            if (!msg) return;

            // Find if we already saved an AI message for this turn (by matching index)
            // We use a marker: store the message index in the history entry
            // For simplicity: find the LAST AI message in this chat
            const aiMsgs = [];
            chat.messages.forEach((m, i) => {
                if (m.role === 'ai') aiMsgs.push(i);
            });

            // If there's an AI message at the expected position, update it
            if (aiMsgs.length > 0) {
                const lastAiIdx = aiMsgs[aiMsgs.length - 1];
                // Only update if the last AI message text matches what we streamed
                // (to avoid overwriting an older chat's message)
                const expectedUserMsg = mi > 0 ? this.messages[mi - 1]?.text : '';
                const userMsgsBefore = chat.messages.filter(m => m.role === 'user');
                if (userMsgsBefore.length > 0) {
                    // Find the last user message position
                    let lastUserIdx = -1;
                    for (let i = chat.messages.length - 1; i >= 0; i--) {
                        if (chat.messages[i].role === 'user') { lastUserIdx = i; break; }
                    }
                    // The AI message should be right after the last user message
                    if (lastAiIdx === lastUserIdx + 1 || lastAiIdx >= lastUserIdx) {
                        chat.messages[lastAiIdx].text = msg.text;
                        if (msg.imageData) chat.messages[lastAiIdx].imageData = msg.imageData;
                    } else {
                        // Position mismatch, push new
                        const entry = { role: 'ai', text: msg.text };
                        if (msg.imageData) entry.imageData = msg.imageData;
                        chat.messages.push(entry);
                    }
                }
            } else {
                // No AI message yet, push
                const entry = { role: 'ai', text: msg.text };
                if (msg.imageData) entry.imageData = msg.imageData;
                chat.messages.push(entry);
            }

            // Update chat title from first user message
            if (chat.messages.length > 0 && chat.title === 'New Chat') {
                const firstUser = chat.messages.find(m => m.role === 'user');
                if (firstUser) {
                    chat.title = firstUser.text.substring(0, 30) + (firstUser.text.length > 30 ? '...' : '');
                }
            }

            this.history.save();
        },

        // ===== GRAPH TOOL — Chart.js =====
        async executeGraph(userInput, mi, response) {
            const graphPrompt = `The user asked: "${userInput}"

You analyzed this in the conversation. Here is your full response:

---
${response}
---

Now extract the NUMERICAL DATA from YOUR OWN RESPONSE above and output ONLY a JSON chart config. Use the SAME labels and data that appear in your analysis.

JSON format:
{"title":"describe what the data shows","chartType":"line","labels":["label1","label2"],"series":[{"name":"metric","data":[1,2,3]}]}

If your response discusses temperature vs time, use those axes. If it discusses something else, use that data. Match exactly what you wrote above.`;

            let jsonRes = '';
            await this.client.chat(this.selectedModel, graphPrompt, 'Output ONLY JSON. No markdown, no tables, no backticks. Just the JSON object.', (chunk) => {
                jsonRes += chunk;
            }, this.abortController?.signal || new AbortController().signal);

            try {
                let raw = jsonRes.trim();
                raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
                raw = raw.replace(/\|[\s\S]*?\|/g, '');
                const first = raw.indexOf('{'), last = raw.lastIndexOf('}');
                if (first === -1 || last === -1) throw new Error('No JSON found');
                const parsed = JSON.parse(this.repairJson(raw.substring(first, last + 1)));
                if (!parsed.series || !parsed.labels) throw new Error('Missing fields');

                const datasets = parsed.series.map(s => ({
                    label: s.name, data: s.data,
                    borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4, fill: parsed.chartType !== 'line'
                }));

                const chartConfig = {
                    type: parsed.chartType || 'line',
                    data: { labels: parsed.labels, datasets },
                    options: {
                        responsive: true, maintainAspectRatio: true,
                        plugins: { legend: { display: true }, title: { display: true, text: parsed.title } }
                    }
                };

                // Embed config as data attribute so it survives reload
                const chartHtml = `\n\n<div class="graph-wrapper" id="chart-${mi}" data-chart='${JSON.stringify(chartConfig).replace(/'/g, "&#39;")}'}><canvas id="chart-${mi}-canvas"></canvas></div>`;
                this.messages[mi].text += chartHtml;
                this.messages[mi].html = this.renderMarkdown(this.messages[mi].text);

                // Add to artifacts (replace previous graph)
                this.artifacts = this.artifacts.filter(a => a.type !== 'graph');
                this.artifacts.push({
                    type: 'graph', title: parsed.title || 'Chart',
                    html: `<div class="artifact-chart-wrap"><canvas id="achart-${this.artifacts.length}-canvas"></canvas></div>`
                });

                // Render charts after DOM update
                this.$nextTick(() => {
                    setTimeout(() => {
                        const cc = document.getElementById(`chart-${mi}-canvas`);
                        if (cc) {
                            cc.style.maxHeight = '240px';
                            new Chart(cc, chartConfig);
                        }
                        const ac = document.getElementById(`achart-${this.artifacts.length - 1}-canvas`);
                        if (ac) new Chart(ac, chartConfig);
                    }, 150);
                });
            } catch (e) {
                console.error('Graph error:', e);
                this.messages[mi].text += `\n\n<details class="tool-error"><summary>📊 Chart failed</summary><pre>${this.escapeHtml(e.message)}\n\nRaw response:\n${this.escapeHtml(jsonRes)}</pre></details>`;
                this.messages[mi].html = this.renderMarkdown(this.messages[mi].text);
            }
        },

        // ===== CODE TOOL — Nix execution =====
        async executeCode(userInput, ctx, sys, mi, response) {
            let currentOutput = response;
            let lastResult = null;
            let consoleLog = '';
            let exitCode = null;

            for (let retry = 0; retry <= 1; retry++) {
                // Try multiple extraction strategies
                let code = null;

                // Strategy 1: Code in ```python or ```py or ``` blocks
                const blockMatch = currentOutput.match(/```(?:python|py)?\s*\n?([\s\S]*?)```/);
                if (blockMatch) {
                    code = blockMatch[1].trim();
                } else {
                    // Strategy 2: Detect raw Python lines in the response
                    const lines = currentOutput.split('\n');
                    const pythonLines = lines.filter(l => {
                        const t = l.trim();
                        if (!t) return false;
                        if (/^[A-Z].*?:\s*[a-z]/.test(t) && t.length > 40) return false;
                        return /^(import |from |def |class |print\(|for |if |while |return |#|[\w]+\s*=\s*|try:|except|else:|elif )/.test(t);
                    });
                    if (pythonLines.length >= 2) {
                        code = pythonLines.join('\n');
                    }
                }

                if (!code) {
                    if (retry === 0) {
                        this.messages[mi].text += '\n\n📟 *No Python code found in response.*';
                        this.messages[mi].html = this.renderMarkdown(this.messages[mi].text);
                    }
                    return;
                }

                this.messages[mi].text += `\n\n📟 *${retry === 0 ? 'Executing' : 'Retrying'} code...*`;
                this.messages[mi].html = this.renderMarkdown(this.messages[mi].text);
                this.$nextTick(() => this.scrollToBottom());

                try {
                    const result = await this.nixService.run(code);
                    const output = `${result.stdout || ''}${result.stderr ? `\n[Errors]:\n${result.stderr}` : ''}`.trim() || 'No output';
                    consoleLog += `\n[Turn ${retry + 1}] Exit: ${result.exit_code}\n${output}\n`;
                    lastResult = result;
                    exitCode = result.exit_code;

                    this.artifacts = this.artifacts.filter(a => a.type !== 'code');
                    this.artifacts.push({
                        type: 'code', title: `Code — Exit: ${result.exit_code}`,
                        html: `<details class="artifact-code-details"><summary>📟 Execution Output</summary><pre class="artifact-code-output">${this.escapeHtml(output)}</pre>${result.nix ? `<details class="artifact-nix"><summary>Nix config</summary><pre>${this.escapeHtml(result.nix)}</pre></details>` : ''}</details>`
                    });

                    this.messages[mi].text = this.messages[mi].text.replace(/📟 \*Executing.*\*\s*/s, '').replace(/📟 \*Retrying.*\*\s*/s, '');
                    this.messages[mi].text += `\n\n📟 **Exit: ${result.exit_code}**`;
                    this.messages[mi].html = this.renderMarkdown(this.messages[mi].text);
                    this.$nextTick(() => this.scrollToBottom());

                    if (result.exit_code === 0) break;

                    // Retry: send ONLY the failing code and error
                    this.messages[mi].text += ' ❌ *Retrying with fix...*';
                    this.messages[mi].html = this.renderMarkdown(this.messages[mi].text);
                    const fixPrompt = `Your code failed:\n\n\`\`\`python\n${code}\n\`\`\`\n\nError:\n${result.stderr || result.stdout}\n\nFix and respond with ONLY the corrected Python code. No explanations.`;
                    let fixedResponse = '';
                    await this.client.chat(this.selectedModel, fixPrompt, 'You are a code fixer. Respond with ONLY corrected Python code.', (chunk) => {
                        fixedResponse += chunk;
                    }, this.abortController?.signal || new AbortController().signal);
                    currentOutput = fixedResponse;
                    this.messages[mi].text = this.messages[mi].text.replace(/❌ \*Retrying with fix\.\.\.\*\s*/s, '');
                } catch (e) {
                    this.messages[mi].text = this.messages[mi].text.replace(/📟 \*Executing.*\*\s*/s, '').replace(/📟 \*Retrying.*\*\s*/s, '');
                    this.messages[mi].text += `\n\n<details class="tool-error"><summary>📟 Execution failed</summary><pre>${this.escapeHtml(e.message)}</pre></details>`;
                    this.messages[mi].html = this.renderMarkdown(this.messages[mi].text);
                    return;
                }
            }

            if (lastResult) {
                this.messages[mi].text += `\n\n<details class="tool-log"><summary>📋 Console Log</summary><pre>${this.escapeHtml(consoleLog)}</pre></details>`;
                this.messages[mi].html = this.renderMarkdown(this.messages[mi].text);
                this.$nextTick(() => this.scrollToBottom());

                let summary = '';
                await this.client.chat(this.selectedModel, ctx + `\n\nAssistant: ${currentOutput}\n\n[SYSTEM]: Code execution finished (exit: ${exitCode}). Results:\n${lastResult?.stdout || 'No output'}\nBriefly summarize.`, sys, (chunk) => {
                    summary += chunk;
                }, this.abortController?.signal || new AbortController().signal);
                if (summary) {
                    this.messages[mi].text += '\n\n' + summary;
                    this.messages[mi].html = this.renderMarkdown(this.messages[mi].text);
                }
                this.$nextTick(() => this.scrollToBottom());
            }
        },

        // ===== IMAGE GEN TOOL — Puter.js =====
        async executeImageGen(userInput, mi, response) {
            // Extract refined prompt from AI response
            const promptMatch = response.match(/<prompt>([\s\S]*?)<\/prompt>/);
            let refinedPrompt = promptMatch ? promptMatch[1].trim() : userInput;

            // VALIDATION: Check if AI's refined prompt matches user's actual request
            // Extract key nouns from user input (simple heuristic)
            const userWords = userInput.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            const refinedLower = refinedPrompt.toLowerCase();
            const hasKeyword = userWords.some(w => refinedLower.includes(w));

            // If AI completely ignored user request, use user's prompt directly
            if (!hasKeyword && promptMatch) {
                console.warn('AI ignored user prompt, using original:', userInput);
                refinedPrompt = userInput;
            }

            this.messages[mi].text += '\n\n🎨 *Generating image...*';
            this.messages[mi].html = this.renderMarkdown(this.messages[mi].text);
            this.$nextTick(() => this.scrollToBottom());

            try {
                const imagenModel = this.settings.imagenModel || 'google/imagen-4.0-fast';
                let imageElement;
                try {
                    imageElement = await puter.ai.txt2img(refinedPrompt, {
                        model: imagenModel,
                        provider: "together-ai",
                        disable_safety_checker: true
                    });
                } catch (puteErr) {
                    throw new Error(`Puter.js error: ${puteErr.message || puteErr}`);
                }

                // Convert to persistent data URL (blob URLs expire on reload)
                let imageUrl = '';
                if (imageElement?.src) {
                    if (imageElement.src.startsWith('blob:')) {
                        imageUrl = await this.blobToDataUrl(imageElement.src);
                    } else {
                        imageUrl = imageElement.src;
                    }
                } else if (imageElement instanceof Blob || imageElement instanceof File) {
                    imageUrl = await this.blobToDataUrl(imageElement);
                }

                if (!imageUrl) throw new Error('Could not extract image URL');

                // Remove status, add image with thumbnail
                this.messages[mi].text = this.messages[mi].text.replace(/🎨 \*Generating image\.\.\.\*/, '');
                const usedPrompt = refinedPrompt !== userInput ? ` (refined: "${refinedPrompt.substring(0, 50)}...")` : '';
                this.messages[mi].text += `\n\n<div class="generated-image-wrap"><img src="${imageUrl}" alt="Generated image" class="generated-image"><div class="image-caption">Imagen 4 — ${imagenModel}${usedPrompt}</div></div>`;
                this.messages[mi].html = this.renderMarkdown(this.messages[mi].text);

                // Artifact: replace previous image
                this.artifacts = this.artifacts.filter(a => a.type !== 'image');
                this.artifacts.push({
                    type: 'image', title: 'Generated Image',
                    html: `<img src="${imageUrl}" class="artifact-image" alt="Generated image">`
                });

                this.$nextTick(() => this.scrollToBottom());
            } catch (e) {
                this.messages[mi].text = this.messages[mi].text.replace(/🎨 \*Generating image\.\.\.\*/, '');
                this.messages[mi].text += `\n\n<details class="tool-error"><summary>🎨 Image generation failed</summary><pre>${this.escapeHtml(e.message)}</pre></details>`;
                this.messages[mi].html = this.renderMarkdown(this.messages[mi].text);
                this.$nextTick(() => this.scrollToBottom());
            }
        },

        // ===== IMAGE GEN TOOL — Imagine.js =====
        async executeImagineGen(userInput, mi, response) {
            // Extract refined prompt from AI response
            const promptMatch = response.match(/<prompt>([\s\S]*?)<\/prompt>/);
            let refinedPrompt = promptMatch ? promptMatch[1].trim() : userInput;

            // VALIDATION: Check if AI's refined prompt matches user's actual request
            const userWords = userInput.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            const refinedLower = refinedPrompt.toLowerCase();
            const hasKeyword = userWords.some(w => refinedLower.includes(w));

            if (!hasKeyword && promptMatch) {
                console.warn('AI ignored user prompt, using original:', userInput);
                refinedPrompt = userInput;
            }

            // LLM prompt remixing: use the model to enhance the prompt for better image generation
            const remixPrompt = `You are an expert image prompt remixer. Given a text prompt, return a more detailed, vivid description suitable for AI image generation.

Focus on:
- Lighting, atmosphere, mood
- Composition, camera angle, perspective
- Color palette, textures, materials
- Art style or medium (photorealistic, oil painting, digital art, etc.)

Keep it concise (1-3 sentences). Output ONLY the remixed image prompt — no explanations.

Original prompt: "${refinedPrompt}"`;

            let remixedPrompt = refinedPrompt;
            try {
                await this.client.chat(this.selectedModel, remixPrompt, "Output ONLY the remixed image prompt. No explanations, no quotes, no markdown.", (chunk) => {
                    remixedPrompt += chunk;
                }, this.abortController?.signal || new AbortController().signal);
                remixedPrompt = remixedPrompt.trim().replace(/^["']|["']$/g, '').replace(/^`+|`+$/g, '');
            } catch (e) {
                console.warn('LLM prompt remixing failed, using original prompt:', refinedPrompt);
                remixedPrompt = refinedPrompt;
            }

            this.messages[mi].text += '\n\n🖼️ *Generating with Imagine.js...*';
            this.messages[mi].html = this.renderMarkdown(this.messages[mi].text);
            this.$nextTick(() => this.scrollToBottom());

            const generateWithImagine = async (prompt) => {
                const serviceName = this.settings.imagineService || 'a1111';

                if (typeof Imagine !== 'function') {
                    throw new Error('Imagine.js not loaded — check network connection');
                }

                const imageBuffer = await Imagine(prompt, { service: serviceName });

                // Convert the image buffer to a data URL for display
                let imageUrl;
                if (imageBuffer instanceof Uint8Array || imageBuffer instanceof ArrayBuffer) {
                    const blob = new Blob([imageBuffer], { type: 'image/png' });
                    imageUrl = await this.blobToDataUrl(blob);
                } else if (typeof imageBuffer === 'string') {
                    imageUrl = imageBuffer;
                } else {
                    throw new Error('Unexpected image format from Imagine.js');
                }

                if (!imageUrl) throw new Error('Could not extract image from Imagine.js output');
                return { imageUrl, provider: 'Imagine.js', service: serviceName };
            };

            const generateWithPuter = async (prompt) => {
                const imagenModel = this.settings.imagenModel || 'google/imagen-4.0-fast';

                if (typeof puter === 'undefined' || !puter.ai) {
                    throw new Error('Puter.js not loaded');
                }

                const imageElement = await puter.ai.txt2img(prompt, {
                    model: imagenModel,
                    provider: "together-ai",
                    disable_safety_checker: true
                });

                let imageUrl;
                if (imageElement?.src) {
                    if (imageElement.src.startsWith('blob:')) {
                        imageUrl = await this.blobToDataUrl(imageElement.src);
                    } else {
                        imageUrl = imageElement.src;
                    }
                } else if (imageElement instanceof Blob || imageElement instanceof File) {
                    imageUrl = await this.blobToDataUrl(imageElement);
                } else {
                    throw new Error('Could not extract image from Puter.js');
                }

                return { imageUrl, provider: 'Puter.js', service: imagenModel };
            };

            try {
                // Try Imagine.js first, fall back to Puter.js on any error
                let result;
                try {
                    result = await generateWithImagine(remixedPrompt);
                } catch (imagineErr) {
                    console.warn('⚠️ Imagine.js failed, falling back to Puter.js:', imagineErr.message);
                    this.messages[mi].text = this.messages[mi].text.replace(/🖼️ \*Generating with Imagine\.js\.\.\.\*/, '');
                    this.messages[mi].text += '\n\n🔄 *Imagine.js unavailable — falling back to Puter.js...*';
                    this.messages[mi].html = this.renderMarkdown(this.messages[mi].text);
                    this.$nextTick(() => this.scrollToBottom());
                    result = await generateWithPuter(remixedPrompt);
                }

                // Remove status, add image with thumbnail
                this.messages[mi].text = this.messages[mi].text.replace(/🔄 \*Imagine\.js unavailable.*\*/, '');
                this.messages[mi].text = this.messages[mi].text.replace(/🖼️ \*Generating with Imagine\.js\.\.\.\*/, '');
                const usedPrompt = remixedPrompt !== userInput ? ` (remixed)` : '';
                this.messages[mi].text += `\n\n<div class="generated-image-wrap"><img src="${result.imageUrl}" alt="Generated image" class="generated-image"><div class="image-caption">${result.provider} — ${result.service}${usedPrompt}</div></div>`;
                this.messages[mi].html = this.renderMarkdown(this.messages[mi].text);

                // Artifact: replace previous image
                this.artifacts = this.artifacts.filter(a => a.type !== 'image');
                this.artifacts.push({
                    type: 'image', title: `Generated Image (${result.provider})`,
                    html: `<img src="${result.imageUrl}" class="artifact-image" alt="Generated image">`
                });

                this.$nextTick(() => this.scrollToBottom());
            } catch (e) {
                this.messages[mi].text = this.messages[mi].text.replace(/🖼️ \*Generating with Imagine\.js\.\.\.\*/, '');
                this.messages[mi].text = this.messages[mi].text.replace(/🔄 \*Imagine\.js unavailable.*\*/, '');
                this.messages[mi].text += `\n\n<details class="tool-error"><summary>🖼️ Image generation failed</summary><pre>${this.escapeHtml(e.message)}</pre></details>`;
                this.messages[mi].html = this.renderMarkdown(this.messages[mi].text);
                this.$nextTick(() => this.scrollToBottom());
            }
        },

        repairJson(json) {
            if (!json) return json;
            return json.trim()
                .replace(/\/\/[^\n\r"]*/g, '')
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/~(\d)/g, '$1')
                .replace(/,\s*([}\]])/g, '$1')
                .replace(/([{,\n])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1 "$2":');
        },

        // Render charts that were persisted in message HTML (on page reload)
        _renderSavedCharts() {
            const wrappers = document.querySelectorAll('.graph-wrapper[data-chart]');
            wrappers.forEach(wrapper => {
                try {
                    const config = JSON.parse(wrapper.getAttribute('data-chart'));
                    const canvas = wrapper.querySelector('canvas');
                    if (canvas) {
                        // Destroy existing chart instance if present
                        const existingChart = Chart.getChart(canvas);
                        if (existingChart) existingChart.destroy();
                        canvas.style.maxHeight = '240px';
                        new Chart(canvas, config);
                    }
                } catch (e) {
                    console.error('Failed to render saved chart:', e);
                }
            });
        },

        stopGeneration() {
            if (this.abortController) { this.abortController.abort(); this.abortController = null; }
            this.isStreaming = false;
            const mi = this.messages.length - 1;
            const lm = this.messages[mi];
            if (lm && lm.role === 'ai') {
                lm.isStreaming = false;
                // Save partial response (what was streamed before stop)
                this._saveAiMessage(mi);
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

        buildContextText(searchContext = "") {
            const h = this.messages.filter(m => m.role !== 'ai' || m.text)
                .map(m => `${m.role === 'user' ? (this.settings.username || 'User') : (this.settings.aiName || 'Assistant')}: ${m.text}`).join('\n\n');
            const a = this.attachments.map(x => `\n\nFile (${x.name}):\n${x.text}`).join('');
            
            // searchContext is passed in from sendMessage if web search was performed
            let text = (searchContext ? searchContext + '\n\n' : '') + h + a + `\n\nAssistant:`;

            return text;
        },

        getToolInstruction() {
            const toolMap = {
                'graph': '\n[TOOL: GRAPH_PLOTTER]\nWhen the user provides data or asks for a visualization, first provide a text summary. Then, at the end of your response, output a markdown block with the numerical data. A separate process will then convert this into a Chart.js visualization.',
                'code': '\n[TOOL: CODE_INTERPRETER]\nYou have access to a Nix-based Python sandbox. To execute code, wrap it in a ```python\n# code here\n``` block. You can use libraries like numpy, pandas, matplotlib, requests, PIL. For specific Nix packages, add a comment: # nix: package_name',
                'image-gen': '\n[TOOL: IMAGE_GENERATOR (Puter.js)]\nTo generate an image, refine the user\'s request into a detailed, vivid prompt and wrap it in <prompt>...</prompt> tags. Provide a brief description of what you\'re generating.',
                'imagine-gen': '\n[TOOL: IMAGE_GENERATOR (Imagine.js)]\nTo generate an image, refine the user\'s request into a detailed, vivid prompt and wrap it in <prompt>...</prompt> tags. Provide a brief description of what you\'re generating. Imagine.js uses Stable Diffusion and supports A1111, Replicate, or Stability backends.'
            };
            return toolMap[this.selectedTool] || '';
        },

        buildSystemPrompt() {
            let p = this.settings.systemPrompt || 'You are a helpful and advanced AI assistant.';
            if (this.settings.includeTime) p += `\nCurrent time: ${new Date().toLocaleString()}`;
            if (this.settings.aiName) p = `Your name is ${this.settings.aiName}.\n` + p;
            
            // Add tool-specific awareness to system prompt
            const toolInstruction = this.getToolInstruction();
            if (toolInstruction) {
                p += '\n\n' + toolInstruction;
                p += '\nYou are currently in ' + this.selectedTool + ' mode. Use the specified formats to trigger tool actions.';
            }

            if (this.thinkEnabled) {
                p += '\nYou MUST use <think>...</think> blocks for your internal reasoning before providing the final answer.';
            }

            return p;
        },

        copyMessage(msg) { navigator.clipboard.writeText(msg.text); },

        scrollToBottom() {
            const container = document.getElementById('chat-container');
            if (container) {
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: 'smooth'
                });
            }
        },

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
        renderMarkdown(t) {
            if (typeof marked !== 'undefined') {
                // Protect injected HTML from markdown processing
                const ph = [];
                let txt = t;
                txt = txt.replace(/<div class="graph-wrapper"[\s\S]*?<\/div>/g, m => { ph.push(m); return `%%PH${ph.length - 1}%%`; });
                txt = txt.replace(/<div class="generated-image-wrap"[\s\S]*?<\/div>/g, m => { ph.push(m); return `%%PH${ph.length - 1}%%`; });
                txt = txt.replace(/<details class="tool-error"[\s\S]*?<\/details>/g, m => { ph.push(m); return `%%PH${ph.length - 1}%%`; });
                txt = txt.replace(/<details class="tool-log"[\s\S]*?<\/details>/g, m => { ph.push(m); return `%%PH${ph.length - 1}%%`; });
                let res = marked.parse(txt);
                ph.forEach((p, i) => { res = res.replace(`%%PH${i}%%`, p); });
                return res;
            }
            return this.escapeHtml(t);
        },
        escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; },

        // Convert blob URL to base64 data URL for persistence across reloads
        async blobToDataUrl(blobUrlOrBlob) {
            if (typeof blobUrlOrBlob === 'string') {
                // Fetch from blob URL and convert
                const resp = await fetch(blobUrlOrBlob);
                const blob = await resp.blob();
                return this.blobToDataUrl(blob);
            }
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.readAsDataURL(blobUrlOrBlob);
            });
        },
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
