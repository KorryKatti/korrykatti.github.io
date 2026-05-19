// Modal functionality
document.addEventListener('DOMContentLoaded', () => {
    const openModalBtn = document.getElementById('open-modal-btn');
    const modal = document.getElementById('modal');
    const closeModalBtn = document.getElementById('close-modal-btn');

    if (openModalBtn) {
        openModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            modal.style.display = 'flex';
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Dark Theme Toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-mode');
            themeBtn.textContent = '☼ light';
        } else {
            themeBtn.textContent = '☾ dark';
        }
        
        themeBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            themeBtn.textContent = isDark ? '☼ light' : '☾ dark';
        });
    }

    fetchQuote();
    fetchBlogMiniStream();
    initObserver();
});

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
        const posts = doc.querySelectorAll('.post');
        const container = document.getElementById('blog-mini-stream');

        if (container && posts.length > 0) {
            container.innerHTML = '';
            // Get latest 3 posts
            Array.from(posts).slice(0, 5).forEach(post => {
                const title = post.querySelector('.post-title').textContent.toLowerCase();
                const link = post.querySelector('.read-more').getAttribute('href');
                const date = post.querySelector('.post-meta').textContent;

                // Adjust link since we are in root and link is for blog/index.html
                const fullLink = link.startsWith('http') ? link : `blog/${link.replace(/^\.\//, '')}`;

                const item = document.createElement('li');
                item.className = 'log-item';
                item.style.marginBottom = '1.2rem';
                item.innerHTML = `
                    <a href="${fullLink}" style="display: block; font-size: 1.1rem; color: inherit; line-height: 1.3;">${title}</a>
                    <div style="font-size: 0.75rem; opacity: 0.4; margin-top: 0.3rem; font-family: monospace;">${date}</div>
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
            `updated ${diffDays} days ago`;
    } catch (error) {
        document.getElementById('last-updated').textContent = "";
    }
}

async function getStatus() {
    try {
        const response = await fetch('https://duinogame.pythonanywhere.com/statusget');
        const data = await response.json();
        const statusContainer = document.getElementById('status-container');

        let statusHTML = '';
        const currentStatus = data.current_status || {};
        const status = currentStatus.status || 'offline';
        
        statusHTML += `<div style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">`;
        statusHTML += `<span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background-color: ${status === 'online' ? '#2ecc71' : '#e74c3c'}; border: 2px solid var(--border-color);"></span>`;
        statusHTML += `<strong>${status.toUpperCase()}</strong>`;
        statusHTML += `</div>`;

        if (status === 'online' && currentStatus.activities && currentStatus.activities.length > 0) {
            statusHTML += `<div style="display: flex; flex-direction: column; gap: 0.8rem;">`;
            currentStatus.activities.forEach(activity => {
                const type = activity.type || activity.activity_type || 'playing';
                const name = activity.name || '';
                const details = activity.details || '';
                const state = activity.state || '';
                
                statusHTML += `<div style="border-left: 4px solid var(--border-color); padding-left: 0.8rem;">`;
                statusHTML += `<div style="font-size: 0.85rem; text-transform: uppercase; opacity: 0.7; letter-spacing: 1px;">${type.toLowerCase()}</div>`;
                statusHTML += `<div style="font-size: 1.1rem; font-weight: 700;">${name.toLowerCase()}</div>`;
                if (details) {
                    statusHTML += `<div style="font-size: 0.95rem; font-style: italic; opacity: 0.9;">${details.toLowerCase()}</div>`;
                }
                if (state) {
                    statusHTML += `<div style="font-size: 0.95rem; opacity: 0.85;">${state.toLowerCase()}</div>`;
                }
                statusHTML += `</div>`;
            });
            statusHTML += `</div>`;
        } else if (status === 'offline') {
            statusHTML += `<div style="opacity: 0.7; font-style: italic;">offline - out of range</div>`;
        } else {
            statusHTML += `<div style="opacity: 0.7; font-style: italic;">idle - drifting away</div>`;
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
        videoId: isDesktop ? 'cVeu_189HwM' : '-vdp2AVAFn0',
        playerVars: {
            'playsinline': 1,
            'controls': 0,
            'start': isDesktop ? 3287 : 0
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
                playBtn.textContent = "▶ play_bgm";
                playBtn.style.color = "var(--acc-blood)";
                isPlaying = false;
            } else {
                player.playVideo();
                playBtn.textContent = "■ pause";
                playBtn.style.color = "var(--acc-teal)";
                isPlaying = true;
            }
        });
    }
}

// Initialize
window.addEventListener('load', () => {
    getLastCommit();
    getStatus();

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
        if (!query) return [];
        const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
        if (terms.length === 0) return [];

        const queryVector = computeQueryVector(query);
        const results = [];

        pageIndex.forEach(doc => {
            let keywordScore = 0;
            const docTitleLower = doc.title.toLowerCase();
            const docSnippetLower = doc.snippet.toLowerCase();

            // Calculate TF/Keyword match score
            terms.forEach(term => {
                if (docTitleLower.includes(term)) {
                    keywordScore += 10;
                }
                if (doc.keywords && doc.keywords.includes(term)) {
                    keywordScore += 6;
                }
                if (docSnippetLower.includes(term)) {
                    keywordScore += 3;
                }
            });

            // Calculate Cosine Similarity to Document Vector
            const cosSim = cosineSimilarity(queryVector, doc.vector || []);

            // Normalize Keyword score to 0..1 range (max potential is around 25 for typical queries)
            const normalizedKeywordScore = Math.min(keywordScore / 25, 1.0);

            // Combine scores: 40% exact/keyword match, 60% semantic vector similarity
            // If the query didn't match any vector dimensions, fall back 100% to keyword matches!
            const queryVectorMagnitude = Math.sqrt(queryVector.reduce((s, v) => s + v * v, 0));
            let finalScore = 0;
            if (queryVectorMagnitude === 0) {
                finalScore = normalizedKeywordScore;
            } else {
                finalScore = (normalizedKeywordScore * 0.4) + (cosSim * 0.6);
            }

            if (finalScore > 0.05) {
                results.push({ doc, score: finalScore });
            }
        });

        // Sort descending by combined score
        return results.sort((a, b) => b.score - a.score);
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
            const results = semanticSearch(query);
            renderSearchResults(results);
        }

        // Live search on typing
        searchInput.addEventListener('input', handleSearch);
        searchBtn.addEventListener('click', handleSearch);
    }

    function renderSearchResults(results) {
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;

        if (results.length === 0) {
            resultsContainer.innerHTML = `<div style="font-size: 1.1rem; color: var(--color-orange); font-style: italic;">no semantic matches found. try 'space', 'chat', 'typing', or 'writing'...</div>`;
        } else {
            let html = '<h4 style="font-size: 1.2rem; margin-bottom: 1rem; color: var(--text-gold); text-transform: uppercase; letter-spacing: 1px;">semantic matches:</h4>';
            results.forEach(res => {
                html += `
                    <div style="padding: 1rem; border: var(--border-width-thin) solid var(--border-color); background-color: var(--bg-cream); color: var(--text-charcoal); margin-bottom: 0.8rem; transition: transform 0.15s ease;">
                        <h5 style="font-size: 1.3rem; font-family: 'IM Fell English', serif; margin-bottom: 0.3rem;">
                            <a href="${res.doc.url}" style="border-bottom: 2px solid currentColor; display: inline-block;">${res.doc.title}</a>
                        </h5>
                        <p style="font-size: 0.95rem; margin-bottom: 0; opacity: 0.9; text-align: left;">${res.doc.snippet}</p>
                        <div style="font-size: 0.75rem; font-family: monospace; opacity: 0.5; margin-top: 0.5rem;">relevance score: ${(res.score * 10).toFixed(0)}</div>
                    </div>
                `;
            });
            resultsContainer.innerHTML = html;
        }
        resultsContainer.style.display = 'flex';
    }

    document.addEventListener('DOMContentLoaded', initSearch);
})();