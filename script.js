// Modal functionality
document.addEventListener('DOMContentLoaded', () => {
    const openModalBtn = document.getElementById('open-modal-btn');
    const modal = document.getElementById('modal');
    const closeModalBtn = document.getElementById('close-modal-btn');

    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
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

    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeToggleBtn) themeToggleBtn.textContent = 'LIGHT_MODE';
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            themeToggleBtn.textContent = isDark ? 'LIGHT_MODE' : 'DARK_MODE';
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }

    // Image enlargement functionality 
    const mainImage = document.querySelector('.main-image');
    let clonedImage = null;

    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = 'image-overlay';
    document.body.appendChild(overlay);

    function closeImage() {
        if (clonedImage) {
            clonedImage.remove();
            clonedImage = null;
        }
        overlay.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }

    // Click to enlarge image
    if (mainImage) {
        mainImage.addEventListener('click', () => {
            clonedImage = mainImage.cloneNode(true);
            clonedImage.classList.add('enlarged');
            // Remove the click listener from the clone effectively (since cloneNode doesn't copy listeners)
            // But we might want clicking the enlarged image to close it too
            clonedImage.addEventListener('click', closeImage);

            document.body.appendChild(clonedImage);
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent scrolling when image is enlarged
        });
    }

    // Click overlay to close
    overlay.addEventListener('click', closeImage);

    // Press Escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeImage();
        }
    });
});

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
            `LAST_UPDATE: ${diffDays} days ago (${lastCommitDate.toDateString()})`;
    } catch (error) {
        console.error("Error fetching last commit:", error);
        document.getElementById('last-updated').textContent = "SYSTEM_ERROR: update data unavailable";
    }
}

async function getStatus() {
    try {
        const response = await fetch('https://duinogame.pythonanywhere.com/statusget');
        const data = await response.json();
        const statusContainer = document.getElementById('status-container');

        let statusHtml = `<div class="status-header"><strong>CURRENT_STATUS:</strong> ${data.current_status.status}</div>`;
        if (data.current_status.status === 'online') {
            statusHtml += '<div class="status-bar"></div>';
            statusHtml += '<div class="activities">';
            data.current_status.activities.forEach(activity => {
                statusHtml += '<div class="activity">';
                if (activity.activity_type === 'spotify') {
                    statusHtml += `Listening to: ${activity.title} by ${activity.artist}`;
                } else if (activity.activity_type === 'game') {
                    statusHtml += `Playing: ${activity.name}`;
                } else {
                    statusHtml += `${activity.name}`;
                }
                statusHtml += '</div>';
            });
            statusHtml += '</div>';
        }
        statusContainer.innerHTML = statusHtml;
    } catch (error) {
        console.error('Error fetching status:', error);
        const statusContainer = document.getElementById('status-container');
        statusContainer.innerHTML = '<strong>CURRENT_STATUS:</strong> Error fetching status';
    }
}

// Initialize
window.addEventListener('load', () => {
    getLastCommit();
    getStatus();
});


// Paginated Tumblr loader with "Load more"
(function () {
    var start = 0;
    var perPage = 6;
    var loading = false;
    var endpoint = 'https://korrykatti.tumblr.com/api/read/json';

    function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }

    function stripHtml(html) {
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    window.renderTumblr = function (data) {
        var container = document.getElementById('tumblr-posts');
        var loadBtn = document.getElementById('load-more-btn');
        var loader = document.getElementById('loader');
        if (!container) return;
        loading = false;
        loader && loader.setAttribute('aria-hidden', 'true');
        var posts = (data && (data.posts || (data.tumblr_api_read && data.tumblr_api_read.posts))) || [];
        if (!posts || posts.length === 0) {
            if (start === 0) container.textContent = 'No posts found.';
            if (loadBtn) loadBtn.disabled = true;
            return;
        }
        if (start === 0) container.innerHTML = '';
        posts.forEach(function (post) {
            var title = post['regular-title'] || post['title'] || post['photo-caption'] || post['video-caption'] || post['quote-text'] || '';
            var date = post['date'] || (post['timestamp'] ? new Date(post.timestamp * 1000).toLocaleString() : '');
            var body = post['regular-body'] || post['photo-caption'] || post['video-caption'] || post['quote-text'] || post['description'] || post['video-player'] || '';
            var url = post['url-with-slug'] || post['url'] || '#';
            var article = document.createElement('article');
            article.className = 'tumblr-post';

            // Detect duplicate title inside the body
            var plainTitle = stripHtml(title || '').trim();
            var plainBody = stripHtml(body || '').trim();
            var titleInBody = false;

            if (plainTitle && plainBody && plainBody.toLowerCase().indexOf(plainTitle.toLowerCase()) === 0) {
                titleInBody = true;
                // Create a temporary div to work with the HTML
                var tempDiv = document.createElement('div');
                tempDiv.innerHTML = body;

                // Try to remove the duplicate title from the start of the body HTML
                var firstChild = tempDiv.firstChild;
                if (firstChild) {
                    var firstText = stripHtml(firstChild.outerHTML || firstChild.textContent || '').trim();
                    if (firstText.toLowerCase().indexOf(plainTitle.toLowerCase()) === 0) {
                        // If the first element contains the title, remove just the title text
                        if (firstChild.nodeType === 1) { // Element node
                            var content = firstChild.innerHTML || firstChild.textContent || '';
                            var plainContent = stripHtml(content).trim();
                            if (plainContent.toLowerCase() === plainTitle.toLowerCase()) {
                                // Entire first element is the title, remove it
                                tempDiv.removeChild(firstChild);
                            } else {
                                // Title is part of first element, try to remove just that part
                                var regex = new RegExp('^\\s*' + plainTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i');
                                firstChild.innerHTML = content.replace(regex, '');
                            }
                        }
                    }
                }
                body = tempDiv.innerHTML;
            }

            // Render the post
            if (titleInBody && title) {
                // Use the title HTML as-is for proper formatting
                article.innerHTML = '<div class="in-body-title">' + title + '</div>'
                    + (date ? '<div class="post-meta">' + escapeHtml(date) + '</div>' : '')
                    + '<div class="post-body">' + (body || '') + '</div>';
            } else if (title) {
                article.innerHTML = '<h4><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + title + '</a></h4>'
                    + (date ? '<div class="post-meta">' + escapeHtml(date) + '</div>' : '')
                    + '<div class="post-body">' + (body || '') + '</div>';
            } else {
                var safeTitle = escapeHtml(body ? stripHtml(body).slice(0, 80) : 'Untitled');
                article.innerHTML = '<h4><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + safeTitle + '</a></h4>'
                    + (date ? '<div class="post-meta">' + escapeHtml(date) + '</div>' : '')
                    + '<div class="post-body">' + (body || '') + '</div>';
            }

            container.appendChild(article);

            // Post-process media: remove fixed width/height attributes from images,
            // make images block-level and wrap iframes/videos for responsive scaling.
            try {
                var imgs = article.querySelectorAll('.post-body img');
                imgs.forEach(function (img) {
                    img.removeAttribute('width');
                    img.removeAttribute('height');
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';
                    img.style.display = 'block';
                    img.style.margin = '8px 0';
                });
                var mediaEls = article.querySelectorAll('.post-body iframe, .post-body video, .post-body embed, .post-body object');
                mediaEls.forEach(function (el) {
                    // if already wrapped, skip
                    if (el.parentNode && el.parentNode.classList && el.parentNode.classList.contains('embed-wrap')) return;
                    var wrapper = document.createElement('div');
                    wrapper.className = 'embed-wrap';
                    el.parentNode.insertBefore(wrapper, el);
                    wrapper.appendChild(el);
                });
            } catch (e) { /* silent */ }
        });
        if (posts.length < perPage && loadBtn) loadBtn.disabled = true;
    };

    function fetchPage() {
        if (loading) return;
        loading = true;
        var loader = document.getElementById('loader');
        var loadBtn = document.getElementById('load-more-btn');
        loader && loader.setAttribute('aria-hidden', 'false');
        if (loadBtn) loadBtn.disabled = true;
        var script = document.createElement('script');
        script.src = endpoint + '?start=' + start + '&num=' + perPage + '&callback=renderTumblr';
        script.async = true;
        script.onerror = function () {
            var container = document.getElementById('tumblr-posts');
            if (start === 0 && container) container.textContent = 'Failed to load posts.';
            if (loadBtn) loadBtn.disabled = true;
            loading = false;
            loader && loader.setAttribute('aria-hidden', 'true');
        };
        document.body.appendChild(script);
        start += perPage;
        if (loadBtn) loadBtn.disabled = false;
    }

    document.addEventListener('DOMContentLoaded', function () {
        var loadBtn = document.getElementById('load-more-btn');
        if (loadBtn) loadBtn.addEventListener('click', fetchPage);
        fetchPage();
    });
})();