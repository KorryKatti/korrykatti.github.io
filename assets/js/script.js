// Modal functionality
document.addEventListener('DOMContentLoaded', () => {
    const openModalBtn = document.getElementById('open-modal-btn');
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
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
            container.innerHTML = `top language: <span style="color: var(--accent);">${topLang.name.toLowerCase()}</span> (${topLang.percent}%)`;
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
            container.innerHTML = `push: <a href="${url}" target="_blank" style="border-bottom: 1px solid var(--accent);">${name}</a>`;
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

                // Adjust link since we are in root and link is for blog/index.html
                const fullLink = link.startsWith('http') ? link : `blog/${link.replace(/^\.\//, '')}`;

                const item = document.createElement('li');
                item.className = 'log-item';
                item.innerHTML = `
                    <a href="${fullLink}" class="log-link" style="font-size: 1.4rem;">${title}</a>
                    <div style="font-size: 0.85rem; opacity: 0.6; margin-top: 0.3rem; font-family: monospace;">${date}</div>
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
        const response = await fetch('https://yurippe.vercel.app/api/quotes?show=Steins;Gate&random=1');
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
                if (track.length > 15) track = track.substring(0, 12) + '...';
                activityContent = track;
            } else {
                let name = (activity.name || '').toLowerCase();
                if (name.length > 15) name = name.substring(0, 12) + '...';
                activityContent = name;
            }
        }

        statusHTML += `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${status === 'online' ? 'var(--accent)' : 'var(--text-secondary)'};"></span>`;
        statusHTML += `<span style="font-weight: 700; letter-spacing: 1px;">${label}</span>`;

        if (activityContent) {
            statusHTML += `<span style="opacity: 0.5; margin: 0 0.5rem;">//</span>`;
            statusHTML += `<span style="color: var(--accent);">${activityContent}</span>`;
        } else if (status === 'offline') {
            statusHTML += `<span style="opacity: 0.7; margin-left: 0.5rem;">off</span>`;
        } else {
            statusHTML += `<span style="opacity: 0.7; margin-left: 0.5rem;">idle</span>`;
        }
        
        statusContainer.innerHTML = statusHTML;
    } catch (error) {
        document.getElementById('status-container').innerHTML = '<div style="color: var(--color-orange);">offline</div>';
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

// Paginated Tumblr loader
(function () {
    var start = 0;
    var perPage = 3;
    var loading = false;
    var endpoint = 'https://korrykatti.tumblr.com/api/read/json';

    window.renderTumblr = function (data) {
        var container = document.getElementById('tumblr-posts');
        var loadBtn = document.getElementById('load-more-btn');
        var loader = document.getElementById('loader');
        if (!container) return;

        loading = false;
        if (loader) loader.style.opacity = '0';

        var posts = (data && (data.posts || (data.tumblr_api_read && data.tumblr_api_read.posts))) || [];

        if (!posts || posts.length === 0) {
            if (start === 0) container.textContent = '';
            if (loadBtn) loadBtn.style.display = 'none';
            return;
        }
        if (start === 0) container.innerHTML = '';

        posts.forEach(function (post) {
            var title = post['regular-title'] || post['title'] || post['photo-caption'] || post['video-caption'] || post['quote-text'] || '';
            var date = post['date'] || (post['timestamp'] ? new Date(post.timestamp * 1000).toLocaleString() : '');
            var body = post['regular-body'] || post['photo-caption'] || post['video-caption'] || post['quote-text'] || post['description'] || post['video-player'] || '';
            var url = post['url-with-slug'] || post['url'] || '#';

            var article = document.createElement('article');
            article.className = 'tumblr-post fade-in';

            let contentHtml = '';
            if (title) contentHtml += `<h4><a href="${url}" target="_blank">${title.toLowerCase()}</a></h4>`;
            contentHtml += `<div class="post-meta">${date.toLowerCase()}</div>`;
            contentHtml += `<div class="post-body">${body}</div>`;

            article.innerHTML = contentHtml;
            container.appendChild(article);

            try {
                var imgs = article.querySelectorAll('.post-body img');
                imgs.forEach(function (img) {
                    img.removeAttribute('width');
                    img.removeAttribute('height');
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';
                    img.style.display = 'block';
                });
            } catch (e) { }

            // Observe this new element for fade in
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                    }
                });
            });
            observer.observe(article);
        });

        if (posts.length < perPage && loadBtn) loadBtn.style.display = 'none';
    };

    function fetchPage() {
        if (loading) return;
        loading = true;

        var loader = document.getElementById('loader');
        if (loader) loader.style.opacity = '1';

        var script = document.createElement('script');
        script.src = endpoint + '?start=' + start + '&num=' + perPage + '&callback=renderTumblr';
        script.async = true;
        document.body.appendChild(script);
        start += perPage;
    }

    document.addEventListener('DOMContentLoaded', function () {
        var loadBtn = document.getElementById('load-more-btn');
        if (loadBtn) loadBtn.addEventListener('click', fetchPage);
        fetchPage();
    });
})();

// Semantic Page Finder Engine (Frontend Only)
(function () {
    let wordVectors = {};
    let pageIndex = [];

    async function loadIndex() {
        try {
            const res = await fetch('/search-index.json');
            const data = await res.json();
            wordVectors = data.wordVectors || {};
            pageIndex = data.documents || [];
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
        const searchBtn = document.getElementById('search-btn');
        const resultsContainer = document.getElementById('search-results');

        if (!searchInput || !searchBtn || !resultsContainer) return;

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
        searchBtn.addEventListener('click', handleSearch);
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
                    <h5 style="font-size: 1.3rem; font-family: 'IM Fell English', serif; margin-bottom: 0.3rem;">
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

// Keyboard Shortcuts
(function () {
    document.addEventListener('keydown', (e) => {
        const target = e.target;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        const shortcutsModal = document.getElementById('shortcuts-modal');
        const chatboxModal = document.getElementById('chatbox-modal');
        const anyModalOpen = (shortcutsModal && shortcutsModal.style.display === 'flex') ||
                             (chatboxModal && chatboxModal.style.display === 'flex');

        if (e.key === 'Escape') {
            if (shortcutsModal) shortcutsModal.style.display = 'none';
            if (chatboxModal) chatboxModal.style.display = 'none';
            return;
        }

        if (isInput || anyModalOpen) return;

        if (e.key === '?') {
            e.preventDefault();
            if (shortcutsModal) shortcutsModal.style.display = 'flex';
        } else if (e.key === '/') {
            e.preventDefault();
            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.focus();
        } else if (e.key === 'g') {
            window.location.href = '/guestbook.html';
        } else if (e.key === 'b') {
            window.location.href = '/blog/index.html';
        } else if (e.key === 'h') {
            window.location.href = '/index.html';
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        const closeShortcutsBtn = document.getElementById('close-shortcuts-btn');
        const shortcutsModal = document.getElementById('shortcuts-modal');
        if (closeShortcutsBtn && shortcutsModal) {
            closeShortcutsBtn.addEventListener('click', () => {
                shortcutsModal.style.display = 'none';
            });
        }
    });
})();