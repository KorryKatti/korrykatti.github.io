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
                    <a href="${fullLink}" style="display: block; font-size: 1.1rem; color: var(--text-main); line-height: 1.3;">${title}</a>
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

        let statusText = `is ${data.current_status.status}`;

        if (data.current_status.status === 'online' && data.current_status.activities.length > 0) {
            const activity = data.current_status.activities[0];
            const type = activity.type || activity.activity_type || 'playing';
            statusText = `${type.toLowerCase()}: ${activity.name.toLowerCase()}`;
        }
        statusContainer.textContent = statusText;
    } catch (error) {
        document.getElementById('status-container').textContent = 'offline';
    }
}

// BGM / YouTube Player
var player;
function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '0',
        width: '0',
        videoId: '-vdp2AVAFn0',
        playerVars: {
            'playsinline': 1,
            'controls': 0
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