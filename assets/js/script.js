// Theme toggle functionality
const Theme = (function () {
    const THEME_KEY = 'preferred-theme';
    const DARK_CLASS = 'dark-mode';
    const btn = document.getElementById('theme-toggle-btn');

    function apply(isDark) {
        document.body.classList.toggle(DARK_CLASS, isDark);
        if (btn) btn.textContent = isDark ? '☀ light' : '🌙 dark';
        try { localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light'); } catch (e) {}
    }

    function toggle() {
        apply(!document.body.classList.contains(DARK_CLASS));
    }

    function init() {
        let stored = null;
        try { stored = localStorage.getItem(THEME_KEY); } catch (e) {}
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        apply(stored ? stored === 'dark' : prefersDark);
    }

    if (btn) btn.addEventListener('click', toggle);

    // Synchronous on purpose: a deferred theme applies after first paint and
    // flashes the wrong palette. The `t` binding lives in KEYMAP below.
    init();

    return {
        toggle: toggle,
        isDark: function () { return document.body.classList.contains(DARK_CLASS); }
    };
})();

// Motion preference. Owned here rather than in Settings because CSS cannot
// govern scroll behaviour requested from JavaScript: `scroll-behavior:
// auto !important` is silently overridden by `scrollTo({behavior:'smooth'})`.
// Every scripted scroll asks this first.
const Motion = (function () {
    const KEY = 'kfx-motion';
    const CLASS = 'no-motion';
    const EXPLICIT = 'motion-explicit';

    function reduced() {
        return document.body.classList.contains(CLASS);
    }

    function apply(isReduced, persist) {
        document.body.classList.toggle(CLASS, isReduced);
        if (persist) {
            document.body.classList.add(EXPLICIT);
            try { localStorage.setItem(KEY, isReduced ? 'reduced' : 'full'); } catch (e) {}
        }
    }

    function init() {
        let saved = null;
        try { saved = localStorage.getItem(KEY); } catch (e) {}

        if (saved) {
            // A stored choice outranks the OS, either direction.
            apply(saved === 'reduced', true);
            return;
        }

        const prefersReduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        apply(prefersReduced, false);
    }

    return {
        init: init,
        reduced: reduced,
        apply: apply,
        behaviour: function () { return reduced() ? 'auto' : 'smooth'; }
    };
})();

// Applied at parse time, like Theme, so the very first paint already matches
// the saved preference instead of animating once and then settling.
Motion.init();

// Load time display
(function() {
    const loadTimeEl = document.getElementById('load-time');
    if (loadTimeEl) {
        const loadTime = performance.now() / 1000;
        loadTimeEl.textContent = `loaded in ${loadTime.toFixed(2)}s`;
    }
})();

// Hidden modal
const Video = (function () {
    const VIDEO_ID = '2g6qHTAjw90';
    const modal = document.getElementById('hidden-modal');
    const video = document.getElementById('hidden-video');
    const closeBtn = document.getElementById('close-hidden-btn');

    function open() {
        if (!modal || !video) return false;
        video.src = `https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1`;
        modal.style.display = 'flex';
        return true;
    }

    function close() {
        if (!modal || !video) return;
        modal.style.display = 'none';
        video.src = '';
    }

    if (closeBtn) closeBtn.addEventListener('click', close);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });
    }

    // The `l` binding lives in KEYMAP below.
    return { open: open, close: close, isOpen: function () { return !!modal && modal.style.display === 'flex'; } };
})();

// Modal functionality
document.addEventListener('DOMContentLoaded', () => {
    const openModalBtn = document.getElementById('open-modal-btn-inline');
    const modal = document.getElementById('chatbox-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');

    if (openModalBtn && modal) {
        openModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            modal.style.display = 'flex';
        });
    }

    if (closeModalBtn && modal) {
        closeModalBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    fetchQuote();
    fetchBlogMiniStream();
    fetchWakaTime();
    fetchGitHubActivity();
    initScrollProgress();
    initObserver();
    Menu.init();
    Settings.init();
    Resume.init();
});

// Scroll Progress Tracker
function initScrollProgress() {
    const scrollTopBtn = document.getElementById('scroll-top-btn');
    window.addEventListener('scroll', () => {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        const progressBar = document.getElementById('scroll-progress');
        if (progressBar) progressBar.style.width = scrolled + '%';
        if (scrollTopBtn) {
            scrollTopBtn.style.display = winScroll > 400 ? 'block' : 'none';
        }
    });
    if (scrollTopBtn) {
        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: Motion.behaviour() });
        });
    }
}

// WakaTime Fetcher (JSONP)
function fetchWakaTime() {
    const url = 'https://wakatime.com/share/@korrykatti/30d50027-2319-42d1-bfba-f0bff30eb412.json';
    const callbackName = 'wakatimeCallback';
    
    window[callbackName] = function(response) {
        const container = document.getElementById('wakatime-display');
        if (container && response.data && response.data.length > 0) {
            const topLang = response.data[0];
            container.innerHTML = `top language (week): <span>${topLang.name.toLowerCase()}</span> (${topLang.percent}%)`;
        }
        delete window[callbackName];
        document.body.removeChild(script);
    };

    const script = document.createElement('script');
    script.src = `${url}?callback=${callbackName}`;
    document.body.appendChild(script);
}

// GitHub Activity Fetcher
async function fetchGitHubActivity() {
    try {
        const response = await fetch('https://api.github.com/users/KorryKatti/repos?sort=pushed&per_page=1');
        const repos = await response.json();
        const container = document.getElementById('github-display');
        
        if (container && repos.length > 0) {
            const repo = repos[0];
            let name = repo.name.toLowerCase();
            if (name.length > 15) name = name.substring(0, 12) + '...';
            const url = repo.html_url;
            container.innerHTML = `last push: <a href="${url}" target="_blank" style="border-bottom: 1px solid var(--border-color);">${name}</a>`;
        }
    } catch (e) {
        console.error('GitHub fetch failed', e);
    }
}

// Gentle Observer
function initObserver() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.05 // Even lower threshold for "aimless" feel
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const elements = document.querySelectorAll('.fade-in, .section');
    elements.forEach(el => {
        el.classList.add('fade-in'); // ensure everything has the class
        observer.observe(el);
    });
}

// Blog Mini Stream Fetcher
async function fetchBlogMiniStream() {
    try {
        const response = await fetch('/blog/index.html');
        if (!response.ok) throw new Error('Network response was not ok');
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const posts = doc.querySelectorAll('.post-entry');
        const container = document.getElementById('blog-mini-stream');

        if (container && posts.length > 0) {
            container.innerHTML = '';
            // Get latest 5 posts
            Array.from(posts).slice(0, 5).forEach(post => {
                const titleLink = post.querySelector('.post-title a');
                const title = titleLink.textContent.toLowerCase();
                const link = titleLink.getAttribute('href');
                const date = post.querySelector('.post-meta').textContent;
                const excerpt = post.querySelector('.post-excerpt');

                // Adjust link since we are in root and link is for blog/index.html
                const fullLink = link.startsWith('http') ? link : `blog/${link.replace(/^\.\//, '')}`;

                const item = document.createElement('li');
                item.className = 'log-item';
                item.innerHTML = `
                    <a href="${fullLink}" class="log-link" style="font-size: 1.1rem;">${title}</a>
                    <div style="font-size: 0.8rem; opacity: 0.5; margin-top: 0.3rem;">${excerpt ? excerpt.textContent.trim() : ''}</div>
                    <div style="font-size: 0.75rem; opacity: 0.4; margin-top: 0.2rem; font-family: monospace;">${date}</div>
                `;
                container.appendChild(item);
            });
        }
    } catch (e) {
        const container = document.getElementById('blog-mini-stream');
        if (container) container.innerHTML = '<div class="log-item" style="opacity: 0.5;">connection lost.</div>';
    }
}

// Quote Fetcher
async function fetchQuote() {
    try {
        const response = await fetch('https://yurippe.vercel.app/api/quotes?show=Steins;Gate,monogatari,Maquia:%20When%20the%20Promised%20Flower%20Bloomsa&random=1');
        const data = await response.json();
        if (data && data.length > 0) {
            const quoteText = data[0].quote;

            // If quote is too long, fetch another one
            if (quoteText.length > 200) {
                return fetchQuote();
            }

            const character = data[0].character.toLowerCase();
            const container = document.getElementById('quote-display');
            if (container) {
                container.innerHTML = `"${quoteText.toLowerCase()}"<br><span class="small-text" style="color: var(--text-faint);">— ${character}</span>`;
            }
        }
    } catch (e) {
        const container = document.getElementById('quote-display');
        if (container) container.innerHTML = "no signal.";
    }
}

// Get last commit info
async function getLastCommit() {
    try {
        const response = await fetch("https://api.github.com/repos/korrykatti/korrykatti.github.io/commits");
        const commits = await response.json();
        const lastCommitDate = new Date(commits[0].commit.committer.date);

        const now = new Date();
        const diffTime = Math.abs(now - lastCommitDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        document.getElementById('last-updated').textContent =
            `upd: ${diffDays}d ago`;
    } catch (error) {
        document.getElementById('last-updated').textContent = "";
    }
}

// Site Uptime (from first commit)
function getUptime() {
    const firstCommitDate = new Date('2024-02-03T04:25:10Z');
    function update() {
        const now = new Date();
        const diffMs = now - firstCommitDate;
        const days = Math.floor(diffMs / 86400000);
        const years = Math.floor(days / 365);
        const remainingDays = days % 365;
        const hours = Math.floor((diffMs % 86400000) / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        const seconds = Math.floor((diffMs % 60000) / 1000);
        const container = document.getElementById('uptime-display');
        if (container) {
            container.textContent = `uptime: ${years}y ${remainingDays}d ${hours}h ${minutes}m ${seconds}s`;
        }
    }
    update();
    setInterval(update, 1000);
}

async function getStatus() {
    try {
        const response = await fetch('https://duinogame.pythonanywhere.com/statusget');
        const data = await response.json();
        const statusContainer = document.getElementById('status-container');

        let statusHTML = '';
        const currentStatus = data.current_status || {};
        const status = currentStatus.status || 'offline';
        
        let label = status.toUpperCase();
        let activityContent = '';

        if (status === 'online' && currentStatus.activities && currentStatus.activities.length > 0) {
            const activity = currentStatus.activities[0];
            const isSpotify = activity.activity_type === 'spotify' || activity.name.toLowerCase() === 'spotify';
            
            if (isSpotify) {
                label = 'LISTEN';
                let track = `${activity.title || ''} - ${activity.artist || ''}`.toLowerCase();
                if (track.length > 30) track = track.substring(0, 27) + '...';
                activityContent = track;
            } else {
                let name = (activity.name || '').toLowerCase();
            if (name.length > 25) name = name.substring(0, 22) + '...';
                activityContent = name;
            }
        }

        const dotColor = status === 'online' ? '#16a34a' : '#dc2626';
        statusHTML += `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${dotColor}; flex-shrink: 0;"></span>`;
        statusHTML += `<span style="font-weight: 600; font-size: inherit; letter-spacing: 0.5px; color: ${dotColor};">${label}</span>`;

        if (activityContent) {
            statusHTML += `<span style="opacity: 0.5; margin: 0 0.5rem;">//</span>`;
            statusHTML += `<span>${activityContent}</span>`;
        } else if (status === 'offline') {
            statusHTML += `<span style="opacity: 0.5; margin-left: 0.5rem; color: #dc2626;">off</span>`;
        } else {
            statusHTML += `<span style="opacity: 0.7; margin-left: 0.5rem;">idle</span>`;
        }
        
        statusContainer.innerHTML = statusHTML;
    } catch (error) {
        document.getElementById('status-container').innerHTML = '<div style="color: var(--text-dim);">offline</div>';
    }
}

// BGM / YouTube Player
var player;
function onYouTubeIframeAPIReady() {
    const isDesktop = window.location.pathname.includes('desktopindex');
    player = new YT.Player('youtube-player', {
        height: '0',
        width: '0',
        videoId: 'fIZLgO5zLK4',
        playerVars: {
            'playsinline': 1,
            'controls': 0,
            'start': 0
        },
        events: {
            'onReady': onPlayerReady
        }
    });
}

function onPlayerReady(event) {
    const playBtn = document.getElementById('play-btn');
    let isPlaying = false;

    // Load API script if not already loaded
    if (!window.YT) {
        var tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        var firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    if (playBtn) {
        playBtn.parentElement.addEventListener('click', () => {
            if (isPlaying) {
                player.pauseVideo();
                playBtn.textContent = "▶ play";
                playBtn.parentElement.classList.remove('playing');
                isPlaying = false;
            } else {
                player.playVideo();
                playBtn.textContent = "■ pause";
                playBtn.parentElement.classList.add('playing');
                isPlaying = true;
            }
        });
    }
}

// Initialize
window.addEventListener('load', () => {
    getLastCommit();
    getStatus();
    getUptime();

    // Inject YouTube API
    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
});

// Semantic Page Finder Engine (Frontend Only)
(function () {
    let wordVectors = {};
    let pageIndex = [];

    // The index is ~129KB and only changes when the site does. Fetch it once
    // per tab, then serve every later visit from sessionStorage.
    const INDEX_CACHE_KEY = 'kfx-search-index-v1';

    function hydrate(data) {
        wordVectors = data.wordVectors || {};
        pageIndex = data.documents || [];
    }

    async function loadIndex() {
        try {
            const cached = sessionStorage.getItem(INDEX_CACHE_KEY);
            if (cached) {
                hydrate(JSON.parse(cached));
                return;
            }
        } catch (e) { /* corrupt entry or storage blocked; fall through */ }

        try {
            const res = await fetch('/search-index.json');
            const data = await res.json();
            hydrate(data);
            try { sessionStorage.setItem(INDEX_CACHE_KEY, JSON.stringify(data)); } catch (e) {}
        } catch (err) {
            console.error('Failed to load search-index.json', err);
        }
    }

    function computeQueryVector(query) {
        const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
        let queryVec = new Array(8).fill(0);
        let count = 0;
        
        terms.forEach(term => {
            if (wordVectors[term]) {
                count++;
                const vec = wordVectors[term];
                for (let d = 0; d < 8; d++) {
                    queryVec[d] += vec[d];
                }
            }
        });
        
        if (count > 0) {
            const magnitude = Math.sqrt(queryVec.reduce((sum, val) => sum + val * val, 0));
            if (magnitude > 0) {
                return queryVec.map(v => v / magnitude);
            }
        }
        return new Array(8).fill(0);
    }

    function cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        let dotProduct = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
        }
        return dotProduct;
    }

    function semanticSearch(query) {
        if (!query) return { results: [], mode: 'semantic' };
        const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
        if (terms.length === 0) return { results: [], mode: 'semantic' };

        const queryVector = computeQueryVector(query);
        const queryVectorMagnitude = Math.sqrt(queryVector.reduce((s, v) => s + v * v, 0));

        let results = [];
        let searchMode = 'semantic';

        // 1. Prioritize Semantic Vector Search
        if (queryVectorMagnitude > 0) {
            pageIndex.forEach(doc => {
                const cosSim = cosineSimilarity(queryVector, doc.vector || []);
                let textBoost = 0;
                const docTitleLower = doc.title.toLowerCase();
                terms.forEach(term => {
                    if (docTitleLower.includes(term)) textBoost += 0.2;
                    if (doc.keywords && doc.keywords.includes(term)) textBoost += 0.1;
                });
                
                const score = cosSim + textBoost;
                if (score > 0.15) {
                    results.push({ doc, score, isVector: true });
                }
            });
            results.sort((a, b) => b.score - a.score);
        }

        // 2. Direct File Search Fallback (if Vector Search yielded 0 results)
        if (results.length === 0) {
            searchMode = 'file';
            pageIndex.forEach(doc => {
                let score = 0;
                const docTitleLower = doc.title.toLowerCase();
                const docSnippetLower = doc.snippet.toLowerCase();

                terms.forEach(term => {
                    if (docTitleLower.includes(term)) score += 10;
                    if (doc.keywords && doc.keywords.includes(term)) score += 6;
                    if (docSnippetLower.includes(term)) score += 3;
                    if (doc.content && doc.content.toLowerCase().includes(term)) score += 2;
                });

                if (score > 0) {
                    results.push({ doc, score, isVector: false });
                }
            });
            results.sort((a, b) => b.score - a.score);
        }

        return { results, mode: searchMode };
    }

    function initSearch() {
        const searchInput = document.getElementById('search-input');
        const resultsContainer = document.getElementById('search-results');

        if (!searchInput || !resultsContainer) return;

        loadIndex();

        function handleSearch() {
            const query = searchInput.value.trim();
            if (!query) {
                resultsContainer.style.display = 'none';
                return;
            }
            const searchPayload = semanticSearch(query);
            renderSearchResults(searchPayload);
        }

        // Live search on typing
        searchInput.addEventListener('input', handleSearch);
    }

    function getReadingTime(text) {
        if (!text) return 1;
        const words = text.trim().split(/\s+/).length;
        return Math.max(1, Math.round(words / 200));
    }

    function generateRadarSVG(vector) {
        if (!vector || vector.every(v => v === 0)) return '';
        const R = 28;
        const cx = 35;
        const cy = 35;
        const points = [];
        const axesLines = [];
        
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4 - Math.PI / 2;
            const val = vector[i] || 0;
            
            // Axis line
            const ax = cx + R * Math.cos(angle);
            const ay = cy + R * Math.sin(angle);
            axesLines.push(`<line x1="${cx}" y1="${cy}" x2="${ax}" y2="${ay}" stroke="var(--border-color)" stroke-width="0.5" opacity="0.3"/>`);
            
            // Scaled data point
            const px = cx + R * val * Math.cos(angle);
            const py = cy + R * val * Math.sin(angle);
            points.push(`${px},${py}`);
        }
        
        const polygonPath = points.join(' ');
        
        return `
            <svg width="60" height="60" viewBox="0 0 70 70" style="margin-left: auto; flex-shrink: 0; background: rgba(0,0,0,0.03); border: 1px solid var(--border-color); border-radius: 4px;" title="Semantic Vector Profile">
                <!-- Concentric rings -->
                <circle cx="${cx}" cy="${cy}" r="${R * 0.5}" fill="none" stroke="var(--border-color)" stroke-width="0.5" opacity="0.15" stroke-dasharray="2"/>
                <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="var(--border-color)" stroke-width="0.5" opacity="0.25"/>
                <!-- Axes -->
                ${axesLines.join('')}
                <!-- Radar Polygon -->
                <polygon points="${polygonPath}" fill="var(--accent)" fill-opacity="0.3" stroke="var(--accent)" stroke-width="1.5"/>
            </svg>
        `;
    }

    function levenshtein(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        Math.min(
                            matrix[i][j - 1] + 1,
                            matrix[i - 1][j] + 1
                        )
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    function getSpellingSuggestionHtml(query) {
        const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        if (terms.length === 0) return '';
        
        const vocabWords = Object.keys(wordVectors);
        if (vocabWords.length === 0) return '';

        const suggestions = [];
        terms.forEach(term => {
            if (!wordVectors[term]) {
                let bestWord = '';
                let bestDist = 3;
                
                vocabWords.forEach(vWord => {
                    const dist = levenshtein(term, vWord);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestWord = vWord;
                    }
                });
                
                if (bestWord) {
                    suggestions.push(bestWord);
                } else {
                    suggestions.push(term);
                }
            } else {
                suggestions.push(term);
            }
        });

        const correctedQuery = suggestions.join(' ');
        if (correctedQuery !== query.toLowerCase()) {
            return `
                <div style="font-size: 0.95rem; margin-top: 0.8rem; color: var(--text-charcoal); opacity: 0.9; width: 100%; text-align: left;">
                    did you mean: <span class="suggestion-link" style="color: var(--bg-wine); border-bottom: 2px dashed var(--bg-wine); cursor: pointer; font-weight: bold; text-transform: lowercase;">${correctedQuery}</span>?
                </div>
            `;
        }
        return '';
    }

    function renderCard(res) {
        const scoreLabel = res.isVector ? `semantic match: ${(res.score * 100).toFixed(0)}%` : `relevance score: ${(res.score * 10).toFixed(0)}`;
        const readTime = getReadingTime(res.doc.content);
        const radarSVG = generateRadarSVG(res.doc.vector);

        return `
            <div style="padding: 1rem; border: var(--border-width) solid var(--border-color); background-color: var(--bg-panel); color: var(--text-primary); margin-bottom: 0.8rem; transition: transform 0.15s ease; width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                <div style="flex-grow: 1;">
                    <h5 style="font-size: 1.3rem; font-family: Georgia, serif; margin-bottom: 0.3rem;">
                        <a href="${res.doc.url}" style="border-bottom: 2px solid var(--accent); display: inline-block;">${res.doc.title}</a>
                    </h5>
                    <p style="font-size: 0.95rem; margin-bottom: 0; opacity: 0.9; text-align: left; color: var(--text-dim);">${res.doc.snippet}</p>
                    <div style="font-size: 0.75rem; font-family: monospace; opacity: 0.6; margin-top: 0.5rem; display: flex; gap: 1rem;">
                        <span>${scoreLabel}</span>
                        <span>•</span>
                        <span>${readTime} min read</span>
                    </div>
                </div>
                ${radarSVG}
            </div>
        `;
    }

    function renderSearchResults(searchPayload) {
        const resultsContainer = document.getElementById('search-results');
        const searchInput = document.getElementById('search-input');
        if (!resultsContainer || !searchInput) return;

        const { results, mode } = searchPayload;

        if (results.length === 0) {
            const suggestionHtml = getSpellingSuggestionHtml(searchInput.value.trim());
            resultsContainer.innerHTML = `
                <div style="font-size: 1.1rem; color: var(--color-orange); font-style: italic; width: 100%; text-align: left;">
                    no matches found. try 'space', 'chat', 'typing', or 'writing'...
                </div>
                ${suggestionHtml}
            `;
            resultsContainer.style.display = 'flex';

            // Attach auto-spelling click listener
            const suggestionLink = resultsContainer.querySelector('.suggestion-link');
            if (suggestionLink) {
                suggestionLink.addEventListener('click', () => {
                    searchInput.value = suggestionLink.textContent;
                    searchInput.dispatchEvent(new Event('input'));
                });
            }
            return;
        }

        const modeTitle = mode === 'semantic' ? 'semantic vector matches:' : 'direct file matches (fallback):';
        let html = `<h4 style="font-size: 1.2rem; margin-bottom: 1rem; color: var(--text-gold); text-transform: uppercase; letter-spacing: 1px; width: 100%; text-align: left;">${modeTitle}</h4>`;
        
        html += `<div id="results-list" style="width: 100%;">`;
        const topSlice = results.slice(0, 5);
        topSlice.forEach(res => {
            html += renderCard(res);
        });
        html += `</div>`;

        if (results.length > 5) {
            html += `
                <button id="load-more-btn" style="margin-top: 0.5rem; width: 100%; padding: 0.8rem; background-color: var(--bg-mustard); color: var(--text-charcoal); border: var(--border-width-thin) solid var(--border-color); font-weight: bold; font-family: 'Space Grotesk', sans-serif; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; transition: background-color 0.15s ease;">
                    load more (${results.length - 5} remaining) ↓
                </button>
            `;
        }

        resultsContainer.innerHTML = html;
        resultsContainer.style.display = 'flex';

        // Attach load more click listener
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                const listContainer = document.getElementById('results-list');
                if (listContainer) {
                    const remainingSlice = results.slice(5);
                    remainingSlice.forEach(res => {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = renderCard(res);
                        listContainer.appendChild(tempDiv.firstElementChild);
                    });
                }
                loadMoreBtn.remove();
            });
        }
    }

    document.addEventListener('DOMContentLoaded', initSearch);
})();

// ============================================================
// Interaction layer: menu cursor, synthesised audio, settings
// ============================================================

// --- SFX ---------------------------------------------------------------
// Synthesised rather than sampled: no asset requests, nothing to wait for,
// and the blips stay in tune with whatever the page is doing.
const Sfx = (function () {
    let ctx = null;
    let enabled = true;

    try { enabled = localStorage.getItem('kfx-sfx') !== 'off'; } catch (e) {}

    function audio() {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            try { ctx = new AC(); } catch (e) { return null; }
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function blip(freq, dur, peak, type) {
        if (!enabled) return;
        const c = audio();
        if (!c) return;
        const t = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.65, t + dur);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(peak, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    }

    // Browsers only allow audio after a gesture. Take the first one that comes
    // along rather than making the visitor hunt for a play button.
    function unlock() {
        if (enabled) audio();
        disarm();
    }

    function disarm() {
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('keydown', unlock, true);
        window.removeEventListener('touchstart', unlock, true);
    }

    function arm() {
        window.addEventListener('pointerdown', unlock, true);
        window.addEventListener('keydown', unlock, true);
        window.addEventListener('touchstart', unlock, true);
    }

    arm();

    return {
        hover: function () { blip(1180, 0.03, 0.015); },
        move: function () { blip(780, 0.05, 0.028); },
        select: function () { blip(1320, 0.08, 0.04, 'triangle'); },
        back: function () { blip(400, 0.07, 0.028, 'sawtooth'); },
        isEnabled: function () { return enabled; },
        setEnabled: function (v) {
            enabled = !!v;
            try { localStorage.setItem('kfx-sfx', v ? 'on' : 'off'); } catch (e) {}
            if (enabled) arm();
        }
    };
})();

// --- Menu cursor -------------------------------------------------------
// The osu! menu model: exactly one row is selected, keys move it, the
// highlight stays visible. Off by default so the minimal layout reads as-is
// until someone reaches for the keyboard; once engaged it also tracks manual
// scrolling, so mouse and keyboard share one selection.
const Menu = (function () {
    let targets = [];
    let index = -1;
    let engaged = false;
    let animating = false;
    let live = null;

    function build() {
        const list = [];
        const nav = document.querySelector('.app-container nav');
        if (nav) {
            nav.querySelectorAll('a').forEach(function (a) {
                list.push({ el: a, mode: 'link', label: a.textContent.trim() });
            });
        }
        document.querySelectorAll('.app-container section').forEach(function (s) {
            const h = s.querySelector('h2');
            const label = h ? h.textContent.trim().replace(/\.$/, '') : 'section';
            list.push({ el: s, mode: 'section', label: label });
        });
        targets = list;
        targets.forEach(function (t) { t.el.classList.add('kb-target'); });
    }

    function paint() {
        targets.forEach(function (t, i) {
            const on = engaged && i === index;
            t.el.classList.toggle('kb-selected', on);
            t.el.classList.toggle('kb-target-nav', on && t.mode === 'link');
            if (on) t.el.setAttribute('aria-current', 'true');
            else t.el.removeAttribute('aria-current');
        });
    }

    function announce() {
        if (live) live.textContent = engaged && index >= 0 ? targets[index].label : '';
    }

    function glide(t) {
        animating = true;
        t.el.scrollIntoView({ behavior: Motion.behaviour(), block: 'start' });
        setTimeout(function () { animating = false; }, 650);
    }

    function move(delta) {
        if (!targets.length) return;
        engaged = true;
        if (index < 0) index = delta > 0 ? -1 : targets.length;
        index = (index + delta + targets.length) % targets.length;
        paint();
        announce();
        Sfx.move();
        glide(targets[index]);
    }

    function activate() {
        if (!engaged || index < 0) return;
        const t = targets[index];
        Sfx.select();
        if (t.mode === 'link') t.el.click();
        else glide(t);
    }

    function reset() {
        const was = engaged;
        engaged = false;
        index = -1;
        paint();
        announce();
        return was;
    }

    // Bidirectional binding: scroll by hand and the cursor follows.
    function sync() {
        if (!engaged || animating || index < 0) return;
        const probe = window.innerHeight * 0.4;
        for (let i = 0; i < targets.length; i++) {
            const t = targets[i];
            if (t.mode !== 'section') continue;
            const r = t.el.getBoundingClientRect();
            if (r.top <= probe && r.bottom > probe) {
                if (i !== index) {
                    index = i;
                    paint();
                    announce();
                }
                return;
            }
        }
    }

    function init() {
        live = document.createElement('div');
        live.className = 'visually-hidden';
        live.setAttribute('role', 'status');
        live.setAttribute('aria-live', 'polite');
        document.body.appendChild(live);

        build();

        let queued = false;
        window.addEventListener('scroll', function () {
            if (queued) return;
            queued = true;
            requestAnimationFrame(function () { queued = false; sync(); });
        }, { passive: true });

        // Clicking anything drops the cursor, same as osu! losing focus.
        document.addEventListener('click', reset);

        if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
            document.addEventListener('mouseover', function (e) {
                if (!e.target.closest) return;
                const a = e.target.closest('a');
                if (a && !a.closest('.modal')) Sfx.hover();
            });
        }
    }

    return {
        init: init,
        move: move,
        activate: activate,
        reset: reset,
        isEngaged: function () { return engaged; },
        back: function () {
            reset();
            window.scrollTo({ top: 0, behavior: Motion.behaviour() });
        }
    };
})();

// --- Modals -------------------------------------------------------------
// Registry so Escape and the keyboard guard agree on what counts as "open".
const Modals = (function () {
    const IDS = ['shortcuts-modal', 'chatbox-modal', 'hidden-modal'];

    function get(id) { return document.getElementById(id); }

    function isOpen(id) {
        const m = get(id);
        return !!m && m.style.display === 'flex';
    }

    function anyOpen() {
        return IDS.some(isOpen);
    }

    function closeAll() {
        let closed = false;
        IDS.forEach(function (id) {
            if (!isOpen(id)) return;
            closed = true;
            // Route the video through its own closer so the embed stops
            // playing audio behind the closed overlay.
            if (id === 'hidden-modal') Video.close();
            else get(id).style.display = 'none';
        });
        return closed;
    }

    return { get: get, isOpen: isOpen, anyOpen: anyOpen, closeAll: closeAll };
})();

// --- Panel --------------------------------------------------------------
// The shortcuts + settings overlay. Only index.html loads this script, and
// it ships the modal, so the panel is wired to that markup rather than built
// from scratch. build() returns false when the modal is absent, which leaves
// the `?` binding and the settings block as no-ops instead of half-wired.
const Panel = (function () {
    const ID = 'shortcuts-modal';
    let rows = null;

    function hide() {
        const m = document.getElementById(ID);
        if (m) m.style.display = 'none';
    }

    function build() {
        const modal = document.getElementById(ID);
        if (!modal) return false;

        const content = modal.querySelector('.modal-content');
        const closeBtn = document.getElementById('close-shortcuts-btn');
        if (!content || !closeBtn) return false;
        closeBtn.addEventListener('click', hide);

        rows = content.querySelector('.shortcut-list');
        if (!rows) {
            // Replace whatever hand-written rows the page shipped so the
            // list can never drift from the actual bindings.
            rows = document.createElement('div');
            rows.className = 'shortcut-list';
            const heading = content.querySelector('h3');
            const stale = heading ? heading.nextElementSibling : null;
            if (stale && stale.id !== 'close-shortcuts-btn') content.replaceChild(rows, stale);
            else content.insertBefore(rows, closeBtn);
        }

        return true;
    }

    return {
        build: build,
        hide: hide,
        toggle: function () { Modals.isOpen(ID) ? hide() : Modals.get(ID).style.display = 'flex'; },
        rows: function () { return rows; }
    };
})();

// --- Settings ----------------------------------------------------------
const Settings = (function () {
    const ACCENT_KEY = 'kfx-accent';
    const CURSOR_KEY = 'kfx-cursor';

    // Preset 1 reproduces the shipped defaults exactly, so installing an
    // accent changes nothing until the visitor actually picks one.
    const ACCENTS = [
        { name: 'rust', light: '#c45d3e', dark: '#d4c5b9' },
        { name: 'moss', light: '#4f7a5c', dark: '#9fc7a8' },
        { name: 'wine', light: '#7d2f3f', dark: '#d59aa6' },
        { name: 'slate', light: '#3f5a7d', dark: '#9db8d6' },
        { name: 'ash', light: '#555555', dark: '#b8b0a8' }
    ];

    let accentName = 'rust';
    let cursorOn = true;

    function isDark() { return document.body.classList.contains('dark-mode'); }

    function applyAccent() {
        const p = ACCENTS.filter(function (a) { return a.name === accentName; })[0] || ACCENTS[0];
        const value = isDark() ? p.dark : p.light;
        document.body.style.setProperty('--accent', value);
        document.body.style.setProperty('--accent-alt', value);
    }

    function row(labelText, control) {
        const el = document.createElement('div');
        el.className = 'settings-row';
        const l = document.createElement('span');
        l.className = 'settings-row-label';
        l.textContent = labelText;
        el.appendChild(l);
        el.appendChild(control);
        return el;
    }

    // A switch whose caption states the current value rather than a bare
    // on/off, so "reduced" vs "off" reads unambiguously.
    function switchRow(labelText, get, set, onLabel, offLabel) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'switch';
        btn.setAttribute('role', 'switch');

        function sync() {
            const on = get();
            btn.setAttribute('aria-checked', on ? 'true' : 'false');
            btn.textContent = on ? onLabel : offLabel;
        }

        btn.addEventListener('click', function () {
            set(!get());
            sync();
            if (Sfx.isEnabled()) Sfx.select();
        });

        sync();
        return { node: row(labelText, btn), sync: sync };
    }

    function build() {
        const content = document.getElementById('shortcuts-modal').querySelector('.modal-content');
        const closeBtn = document.getElementById('close-shortcuts-btn');
        if (!content || !closeBtn || content.querySelector('.settings-block')) return;

        const block = document.createElement('div');
        block.className = 'settings-block';

        const title = document.createElement('h3');
        title.textContent = 'settings';
        title.style.fontSize = '1.1rem';
        block.appendChild(title);

        block.appendChild(switchRow('sound effects',
            Sfx.isEnabled,
            Sfx.setEnabled, 'on', 'off').node);

        block.appendChild(switchRow('motion',
            Motion.reduced,
            function (v) { Motion.apply(v, true); }, 'reduced', 'full').node);

        block.appendChild(switchRow('custom cursor',
            function () { return cursorOn; },
            function (v) {
                cursorOn = v;
                document.body.classList.toggle('no-custom-cursor', !v);
                try { localStorage.setItem(CURSOR_KEY, v ? 'on' : 'off'); } catch (e) {}
            }, 'crosshair', 'system').node);

        const swatches = document.createElement('div');
        swatches.className = 'swatch-row';
        const buttons = [];
        ACCENTS.forEach(function (p) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'swatch';
            b.title = p.name;
            b.setAttribute('aria-label', p.name);
            b.style.background = isDark() ? p.dark : p.light;
            b.addEventListener('click', function () {
                accentName = p.name;
                try { localStorage.setItem(ACCENT_KEY, p.name); } catch (e) {}
                applyAccent();
                buttons.forEach(function (btn, i) {
                    btn.setAttribute('aria-pressed', ACCENTS[i].name === accentName ? 'true' : 'false');
                });
                if (Sfx.isEnabled()) Sfx.select();
            });
            buttons.push(b);
            swatches.appendChild(b);
        });
        buttons.forEach(function (b, i) {
            b.setAttribute('aria-pressed', ACCENTS[i].name === accentName ? 'true' : 'false');
        });
        block.appendChild(row('accent', swatches));

        content.insertBefore(block, closeBtn);
    }

    function init() {
        let savedAccent = null;
        try { savedAccent = localStorage.getItem(ACCENT_KEY); } catch (e) {}
        if (savedAccent && ACCENTS.some(function (a) { return a.name === savedAccent; })) {
            accentName = savedAccent;
        }

        let savedCursor = null;
        try { savedCursor = localStorage.getItem(CURSOR_KEY); } catch (e) {}
        cursorOn = savedCursor !== 'off';
        document.body.classList.toggle('no-custom-cursor', !cursorOn);

        applyAccent();

        // The theme toggle flips light/dark, and each preset carries a value
        // per theme, so re-apply whenever the body class changes.
        new MutationObserver(applyAccent)
            .observe(document.body, { attributes: true, attributeFilter: ['class'] });

        if (Panel.build()) build();
    }

    return { init: init };
})();

// --- Resume ------------------------------------------------------------
// osu! remembers where you were. Scroll position is per-tab state rather than
// a permanent preference, so it rides on sessionStorage.
const Resume = (function () {
    const KEY = 'kfx-resume-y';
    let timer = 0;

    function save() {
        try { sessionStorage.setItem(KEY, String(Math.round(window.scrollY))); } catch (e) {}
    }

    function init() {
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

        window.addEventListener('scroll', function () {
            if (timer) return;
            timer = setTimeout(function () { timer = 0; save(); }, 250);
        }, { passive: true });
        window.addEventListener('pagehide', save);

        let y = 0;
        try { y = parseInt(sessionStorage.getItem(KEY) || '0', 10) || 0; } catch (e) {}
        if (y <= 200) return;

        // The hero image is 1.4MB. Restoring before layout settles would land
        // in the wrong place, so wait for load and then jump, not animate.
        const restore = function () { window.scrollTo(0, y); };
        if (document.readyState === 'complete') restore();
        else window.addEventListener('load', restore);
    }

    return { init: init };
})();

// --- KEYMAP ------------------------------------------------------------
// Single source of truth. The bindings below and the list rendered in the
// panel come from this array, so a shortcut cannot exist without being
// documented (the old hand-written list had drifted: `t` and `l` were bound
// but unlisted, and `l` had no discoverable affordance at all).
const KEYMAP = [
    {
        group: 'menu', keys: ['j', 'ArrowDown'], label: 'next item',
        run: function () { Menu.move(1); }
    },
    {
        group: 'menu', keys: ['k', 'ArrowUp'], label: 'previous item',
        run: function () { Menu.move(-1); }
    },
    {
        group: 'menu', keys: ['Enter'], label: 'open selected', noRepeat: true,
        run: function () {
            // Only when nothing else owns Enter, or it would double-fire
            // alongside whatever the user has tabbed to.
            if (!Menu.isEngaged() || document.activeElement !== document.body) return false;
            Menu.activate();
            return true;
        }
    },
    {
        group: 'navigation', keys: ['/'], label: 'focus search',
        run: function () {
            const input = document.getElementById('search-input');
            if (!input) return false;
            input.focus();
            return true;
        }
    },
    {
        group: 'navigation', keys: ['b'], label: 'go to blog', noRepeat: true,
        run: function () { window.location.href = '/blog/index.html'; }
    },
    {
        group: 'navigation', keys: ['g'], label: 'go to guestbook', noRepeat: true,
        run: function () { window.location.href = '/guestbook.html'; }
    },
    {
        group: 'navigation', keys: ['h'], label: 'go home', noRepeat: true,
        run: function () { window.location.href = '/index.html'; }
    },
    {
        group: 'site', keys: ['t'], label: 'toggle theme', noRepeat: true,
        run: function () { Theme.toggle(); }
    },
    {
        group: 'site', keys: ['l'], label: 'video signal', noRepeat: true,
        // Only listed where the hidden modal actually exists to be opened.
        hidden: function () { return !document.getElementById('hidden-modal'); },
        run: function () { return Video.open(); }
    },
    {
        group: 'site', keys: ['?'], label: 'shortcuts + settings', noRepeat: true,
        hidden: function () { return !document.getElementById('shortcuts-modal'); },
        run: function () { Panel.toggle(); }
    },
    {
        // Escape is the one binding that must fire regardless of focus or
        // what is open: close a modal, else leave the field, else go back.
        group: 'site', keys: ['Escape'], label: 'close / go back', always: true,
        run: function () {
            if (Modals.closeAll()) return;
            const focused = document.activeElement;
            if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA' || focused.isContentEditable)) {
                focused.blur();
            } else {
                Menu.back();
            }
        }
    }
];

const GROUP_LABELS = { menu: 'menu', navigation: 'navigation', site: 'site' };

(function bindKeys() {
    function isTyping(t) {
        return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
    }

    function render(rows) {
        if (!rows) return;
        rows.innerHTML = '';
        let group = null;

        KEYMAP.forEach(function (binding) {
            if (binding.hidden && binding.hidden()) return;
            if (binding.group !== group) {
                group = binding.group;
                const heading = document.createElement('div');
                heading.className = 'shortcut-group';
                heading.textContent = GROUP_LABELS[group] || group;
                rows.appendChild(heading);
            }

            const row = document.createElement('div');
            row.className = 'settings-row';

            const label = document.createElement('span');
            label.className = 'settings-row-label';
            label.textContent = binding.label;
            row.appendChild(label);

            const cluster = document.createElement('span');
            cluster.className = 'kbd-cluster';
            binding.keys.forEach(function (key, i) {
                if (i) {
                    const sep = document.createElement('span');
                    sep.className = 'kbd-sep';
                    sep.textContent = '/';
                    cluster.appendChild(sep);
                }
                const kbd = document.createElement('kbd');
                kbd.className = 'kbd';
                kbd.textContent = key === 'ArrowDown' ? '↓' : key === 'ArrowUp' ? '↑' : key;
                cluster.appendChild(kbd);
            });
            row.appendChild(cluster);
            rows.appendChild(row);
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const typing = isTyping(e.target);

        for (let i = 0; i < KEYMAP.length; i++) {
            const binding = KEYMAP[i];
            if (binding.keys.indexOf(e.key) === -1) continue;

            if (!binding.always) {
                if (binding.noRepeat && e.repeat) return;
                if (typing) return;
                if (Modals.anyOpen()) return;
            }

            // Returning false means "not applicable here"; keep looking
            // rather than swallowing the key.
            if (binding.run() === false) return;

            if (!binding.always) e.preventDefault();
            else if (e.key === 'Escape') e.preventDefault();
            return;
        }
    });

    document.addEventListener('DOMContentLoaded', function () {
        render(Panel.rows());
    });
})();