import { OllamaClient } from './client.js';

// ─── TONE SYSTEM PROMPTS ───────────────────────────────────────────────────
// Each is a writer's instruction, not a corporate description.
const TONES = {
    neutral: `Continue this story naturally. Match the author's voice and pacing. Write one or two sentences.`,
    optimistic: `You see the world bright-side up. Continue with warmth, small victories, or gentle hope — even in hard moments. Write one or two sentences.`,
    pessimistic: `Things rarely improve. Continue with a quiet resignation, a sense that effort doesn't quite redeem the world. Write one or two sentences.`,
    dramatic: `Everything matters enormously. Continue with heightened stakes, vivid emotion, and language that earns its intensity. Write one or two sentences.`,
    humorous: `Absurdity lurks beneath the ordinary. Continue with dry wit, an unexpected angle, or a comic beat that fits but surprises. Write one or two sentences.`,
    dark: `The light doesn't quite reach here. Continue with shadow, dread, or the particular loneliness of things gone wrong. Write one or two sentences.`,
    romantic: `The world is full of longing. Continue with emotional texture, sensory detail, and the weight of feeling between people. Write one or two sentences.`,
    mysterious: `Something is not explained. Continue in a way that deepens the unknown rather than resolving it — cryptic, suggestive, haunting. Write one or two sentences.`,
    whimsical: `The rules bend here. Continue with playful imagination, unexpected metaphors, and a child-like sense of wonder at strange things. Write one or two sentences.`,
    melancholic: `Something beautiful has been lost, or is passing. Continue with tender sadness, nostalgia, and the ache of time. Write one or two sentences.`,
    tense: `Something is about to go wrong. Continue with short beats, withheld information, and the anticipation of catastrophe. Write one or two sentences.`,
    philosophical: `The story opens onto something larger. Continue in a way that gestures toward meaning, impermanence, or the human condition. Write one or two sentences.`,
};

const STORE_KEY = 'story_mode_stories';
const SETTINGS_KEY = 'ollama_settings';

// ─── STORY STORAGE ────────────────────────────────────────────────────────

function loadStories() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
    catch { return []; }
}
function saveStories(stories) {
    localStorage.setItem(STORE_KEY, JSON.stringify(stories));
}

// ─── MAIN CLASS ───────────────────────────────────────────────────────────

class StoryEditor {
    constructor() {
        const cfg = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        this.client = new OllamaClient(cfg.ollamaUrl || 'http://localhost:11434');

        // Apply theme from main app
        if (cfg.theme !== 'light') document.body.classList.add('dark');

        this.el = {
            editor: document.getElementById('editor'),
            modelSelect: document.getElementById('model-select'),
            titleInput: document.getElementById('story-title'),
            statusText: document.getElementById('status-text'),
            wordCount: document.getElementById('word-count'),
            wpmDisplay: document.getElementById('wpm-display'),
            stopBtn: document.getElementById('stop-btn'),
            storyList: document.getElementById('story-list'),
            newStoryBtn: document.getElementById('new-story-btn'),
            deleteStoryBtn: document.getElementById('delete-story-btn'),
            exportBtn: document.getElementById('export-btn'),
            notesToggle: document.getElementById('notes-toggle'),
            notesSidebar: document.getElementById('notes-sidebar'),
            notesEditor: document.getElementById('notes-editor'),
            settingsToggle: document.getElementById('settings-toggle'),
            panel: document.getElementById('panel'),
            aiToggle: document.getElementById('ai-toggle'),
            themeSelect: document.getElementById('theme-select'),
            toneRow: document.getElementById('tone-row'),
            ytUrl: document.getElementById('yt-url'),
            ytLoad: document.getElementById('yt-load'),
            ytFrameWrap: document.getElementById('yt-frame-wrap'),
            ytIframe: document.getElementById('yt-iframe'),
            musicCtrl: document.getElementById('music-ctrl'),
            musicToggle: document.getElementById('music-toggle'),
            vol: document.getElementById('vol'),
            volVal: document.getElementById('vol-val'),
        };

        this.stories = loadStories();
        this.activeId = null;
        this.tone = 'neutral';
        this.abort = null;
        this.timer = null;
        this.generating = false;
        this.musicPaused = false;
        this.aiEnabled = true;

        // WPM tracking — rolling window of word-timestamps
        this._wpmBuffer = [];   // array of { words, ts }
        this._lastWordCount = 0;
        this._wpmInterval = null;

        this.init();
    }

    async init() {
        await this.loadModels();
        this.bindEditor();
        this.bindSidebar();
        this.bindSettings();
        this.bindMusic();
        this.renderList();
        this.applyTheme();
        this.setFavicon();
        this.startWpmClock();

        // Load or create first story
        if (this.stories.length) {
            this.openStory(this.stories[0].id);
        } else {
            this.createStory();
        }
    }

    // ─── THEME & FAVICON ─────────────────────────────────────────────────

    applyTheme() {
        // First try to load a saved story-specific theme, otherwise fallback to app
        const savedTheme = localStorage.getItem('story_mode_theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            if (this.el.themeSelect) this.el.themeSelect.value = savedTheme;
        } else {
            const cfg = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
            const defaultTheme = cfg.theme === 'light' ? 'warm' : 'midnight';
            document.documentElement.setAttribute('data-theme', defaultTheme);
            if (this.el.themeSelect) this.el.themeSelect.value = defaultTheme;
        }
    }
    setFavicon() {
        const cfg = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        const avatar = cfg.aiAvatar || cfg.avatar || null;
        if (avatar) {
            document.getElementById('favicon').href = avatar;
        }
    }

    // ─── WPM CLOCK ────────────────────────────────────────────────────────

    startWpmClock() {
        this._wpmInterval = setInterval(() => {
            const now = Date.now();
            // Keep only data from the last 10 seconds
            this._wpmBuffer = this._wpmBuffer.filter(p => now - p.ts < 10000);
            if (this._wpmBuffer.length < 2) {
                this.el.wpmDisplay.textContent = '0 wpm';
                return;
            }
            const totalWords = this._wpmBuffer.reduce((a, p) => a + p.words, 0);
            const spanMin = (now - this._wpmBuffer[0].ts) / 60000;
            const wpm = spanMin > 0 ? Math.round(totalWords / spanMin) : 0;
            this.el.wpmDisplay.textContent = `${wpm} wpm`;
        }, 1000);
    }

    // ─── MODELS ───────────────────────────────────────────────────────────

    async loadModels() {
        try {
            const models = await this.client.listModels();
            this.el.modelSelect.innerHTML = models
                .map(m => `<option value="${m.name}">${m.name}</option>`)
                .join('');
        } catch { /* offline */ }
    }

    get model() { return this.el.modelSelect.value; }


    // ─── STORY LIFECYCLE ──────────────────────────────────────────────────

    createStory() {
        const id = Date.now().toString();
        const story = { id, title: 'Untitled', content: '', notes: '', created: id };
        this.stories.unshift(story);
        saveStories(this.stories);
        this.renderList();
        this.openStory(id);
    }

    openStory(id) {
        this.autosaveCurrent();
        this.activeId = id;
        const s = this.stories.find(s => s.id === id);
        if (!s) return;
        this.el.titleInput.value = s.title;
        this.el.editor.innerHTML = s.content || '';
        if (this.el.notesEditor) this.el.notesEditor.value = s.notes || '';
        this.renderList();
        this.updateWordCount();
        this.el.editor.focus();
    }

    deleteStory(id) {
        this.stories = this.stories.filter(s => s.id !== id);
        saveStories(this.stories);
        if (this.activeId === id) {
            this.activeId = null;
            if (this.stories.length) this.openStory(this.stories[0].id);
            else this.createStory();
        } else {
            this.renderList();
        }
    }

    autosaveCurrent() {
        if (!this.activeId) return;
        const s = this.stories.find(s => s.id === this.activeId);
        if (!s) return;
        s.content = this.el.editor.innerHTML;
        s.title = this.el.titleInput.value.trim() || 'Untitled';
        if (this.el.notesEditor) s.notes = this.el.notesEditor.value;
        saveStories(this.stories);
    }

    renderList() {
        this.el.storyList.innerHTML = '';
        this.stories.forEach(s => {
            const item = document.createElement('div');
            item.className = `story-item${s.id === this.activeId ? ' active' : ''}`;
            item.innerHTML = `<span>${s.title || 'Untitled'}</span><button class="story-item-del" title="Delete">✕</button>`;
            item.querySelector('span').addEventListener('click', () => this.openStory(s.id));
            item.querySelector('.story-item-del').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this story?')) this.deleteStory(s.id);
            });
            this.el.storyList.appendChild(item);
        });
    }

    // ─── EDITOR BINDINGS ─────────────────────────────────────────────────

    bindEditor() {
        this.el.editor.addEventListener('input', () => {
            this.dismissGhost();

            // WPM: record current word delta
            const currentWords = this.el.editor.innerText.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
            const delta = Math.max(0, currentWords - this._lastWordCount);
            if (delta > 0) this._wpmBuffer.push({ words: delta, ts: Date.now() });
            this._lastWordCount = currentWords;

            this.updateWordCount();
            this.autosaveCurrent();
            this.scheduleGen();
        });

        this.el.editor.addEventListener('keydown', e => {
            if (e.key === 'Tab' && this.ghostText()) {
                e.preventDefault();
                this.acceptGhost();
            } else if (e.key === 'Escape') {
                this.dismissGhost();
            } else if (this.generating && !['Control', 'Alt', 'Shift'].includes(e.key)) {
                this.stopGen();
            }
        });

        this.el.editor.addEventListener('mousedown', e => {
            if (e.target.classList.contains('ghost-text')) {
                e.preventDefault();
                this.el.editor.focus();
            }
        });

        this.el.titleInput.addEventListener('input', () => this.autosaveCurrent());
        if (this.el.notesEditor) {
            this.el.notesEditor.addEventListener('input', () => this.autosaveCurrent());
        }

        this.el.stopBtn.addEventListener('click', () => this.stopGen());
    }

    // ─── SIDEBAR BINDINGS ────────────────────────────────────────────────

    bindSidebar() {
        this.el.newStoryBtn.addEventListener('click', () => this.createStory());
        this.el.deleteStoryBtn.addEventListener('click', () => {
            if (this.activeId && confirm('Delete this story?')) {
                this.deleteStory(this.activeId);
            }
        });

        if (this.el.notesToggle && this.el.notesSidebar) {
            this.el.notesToggle.addEventListener('click', () => {
                this.el.notesSidebar.classList.toggle('open');
            });
        }

        if (this.el.exportBtn) {
            this.el.exportBtn.addEventListener('click', () => this.exportCurrentStory());
        }
    }

    // ─── SETTINGS BINDINGS ───────────────────────────────────────────────

    bindSettings() {
        this.el.settingsToggle.addEventListener('click', () => {
            this.el.panel.classList.toggle('open');
        });

        this.el.toneRow.addEventListener('click', e => {
            const chip = e.target.closest('.tone-chip');
            if (!chip) return;
            document.querySelectorAll('.tone-chip').forEach(c => c.classList.remove('on'));
            chip.classList.add('on');
            this.tone = chip.dataset.tone;
        });

        if (this.el.aiToggle) {
            this.el.aiToggle.addEventListener('change', e => {
                this.aiEnabled = e.target.checked;
                if (!this.aiEnabled) {
                    this.stopGen();
                    this.dismissGhost();
                }
            });
        }

        if (this.el.themeSelect) {
            this.el.themeSelect.addEventListener('change', e => {
                const theme = e.target.value;
                document.documentElement.setAttribute('data-theme', theme);
                localStorage.setItem('story_mode_theme', theme);
            });
        }
    }

    // ─── MUSIC BINDINGS ──────────────────────────────────────────────────

    bindMusic() {
        const load = () => {
            const url = this.el.ytUrl.value.trim();
            if (!url) return;
            const pl = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
            const vid = url.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/);
            let src = '';
            if (pl) {
                src = `https://www.youtube-nocookie.com/embed/${vid ? vid[1] : ''}?list=${pl[1]}&autoplay=1&enablejsapi=1`;
            } else if (vid) {
                src = `https://www.youtube-nocookie.com/embed/${vid[1]}?autoplay=1&enablejsapi=1&loop=1&playlist=${vid[1]}`;
            } else { return; }
            this.el.ytIframe.src = src;
            this.el.ytFrameWrap.style.display = 'block';
            this.el.musicCtrl.style.display = 'flex';
            this.el.musicToggle.textContent = '⏸ Pause';
            this.musicPaused = false;
        };

        this.el.ytLoad.addEventListener('click', load);
        this.el.ytUrl.addEventListener('keydown', e => { if (e.key === 'Enter') load(); });

        this.el.musicToggle.addEventListener('click', () => {
            const fn = this.musicPaused ? 'playVideo' : 'pauseVideo';
            this.el.ytIframe.contentWindow.postMessage(
                `{"event":"command","func":"${fn}","args":""}`, '*'
            );
            this.musicPaused = !this.musicPaused;
            this.el.musicToggle.textContent = this.musicPaused ? '▶ Play' : '⏸ Pause';
        });

        this.el.vol.addEventListener('input', e => {
            const v = e.target.value;
            this.el.volVal.textContent = `${v}%`;
            this.el.ytIframe.contentWindow.postMessage(
                `{"event":"command","func":"setVolume","args":[${v}]}`, '*'
            );
        });
    }

    // ─── GENERATION ──────────────────────────────────────────────────────

    scheduleGen() {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.generate(), 900);
    }

    async generate() {
        if (!this.aiEnabled || this.generating || !this.model) return;
        const rawText = this.el.editor.innerText.trim();
        if (rawText.length < 8) return;

        this.generating = true;
        this.setStatus('Thinking…');
        this.el.stopBtn.style.display = 'inline-block';
        this.abort = new AbortController();

        // last ~600 chars of plain text as context
        const context = rawText.slice(-600);
        const system = TONES[this.tone] || TONES.neutral;
        const prompt = `Continue the story below. Do NOT repeat any existing text. Output only the continuation.\n---\n${context}`;

        try {
            let text = '';
            await this.client.chat(this.model, prompt, system, (chunk, done) => {
                text += chunk;
                this.showGhost(text);
                if (done) {
                    this.generating = false;
                    this.el.stopBtn.style.display = 'none';
                    this.setStatus('Tab to accept');
                }
            }, this.abort.signal);
        } catch (e) {
            if (e.name !== 'AbortError') console.error(e);
            this.generating = false;
            this.el.stopBtn.style.display = 'none';
            this.setStatus('Ready');
        }
    }

    stopGen() {
        if (this.abort) { this.abort.abort(); this.abort = null; }
        this.generating = false;
        this.el.stopBtn.style.display = 'none';
        this.dismissGhost();
        this.setStatus('Stopped');
        setTimeout(() => this.setStatus('Ready'), 1200);
    }

    // ─── GHOST TEXT ───────────────────────────────────────────────────────

    ghostText() { return document.getElementById('ghost-span'); }

    showGhost(text) {
        const old = this.ghostText();
        if (old) old.remove();
        const sel = window.getSelection();
        if (!sel?.rangeCount) return;
        const range = sel.getRangeAt(0).cloneRange();
        const span = document.createElement('span');
        span.className = 'ghost-text';
        span.id = 'ghost-span';
        span.textContent = text;
        range.insertNode(span);
        range.setStartBefore(span);
        range.setEndBefore(span);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    dismissGhost() {
        this.ghostText()?.remove();
        this.setStatus('Ready');
    }

    acceptGhost() {
        const ghost = this.ghostText();
        if (!ghost) return;
        const text = ghost.textContent;
        ghost.remove();
        const sel = window.getSelection();
        const range = sel.getRangeAt(0);
        const node = document.createTextNode(text);
        range.insertNode(node);
        range.setStartAfter(node);
        range.setEndAfter(node);
        sel.removeAllRanges();
        sel.addRange(range);
        this.updateWordCount();
        this.autosaveCurrent();
        this.setStatus('Ready');
        this.scheduleGen(); // queue next
    }

    // ─── UTILITY ─────────────────────────────────────────────────────────

    updateWordCount() {
        const t = this.el.editor.innerText.replace(/\s+/g, ' ').trim();
        const n = t ? t.split(' ').length : 0;
        this.el.wordCount.textContent = `${n} word${n === 1 ? '' : 's'}`;
    }

    setStatus(msg) { this.el.statusText.textContent = msg; }

    exportCurrentStory() {
        const s = this.stories.find(s => s.id === this.activeId);
        if (!s) return;

        // Convert HTML content to plain text with basic formatting
        let text = s.title + '\n\n';

        // Very rough html-to-text just for export, preserving newlines
        let tempDiv = document.createElement('div');
        tempDiv.innerHTML = s.content;
        text += tempDiv.innerText;

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // sanitize title for filename
        const safeTitle = s.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `story_${safeTitle || 'untitled'}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

window.addEventListener('DOMContentLoaded', () => new StoryEditor());
