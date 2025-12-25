// Prefetching functionality to make the website load faster
// It loads internal HTML pages when a user hovers over a link
(function () {
    const prefetched = new Set();

    const prefetch = (url) => {
        if (!url || prefetched.has(url)) return;

        try {
            const urlObj = new URL(url, window.location.href);
            // Only prefetch internal links
            if (urlObj.origin !== window.location.origin) return;

            // Check if it's likely an HTML page
            const path = urlObj.pathname;
            // Avoid prefetching the current page
            if (urlObj.href === window.location.href) return;

            if (path.endsWith('.html') || path.endsWith('/') || !path.includes('.')) {
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = url;
                document.head.appendChild(link);
                prefetched.add(url);
                // console.log('Prefetched:', url);
            }
        } catch (e) {
            // Invalid URL
        }
    };

    const init = () => {
        document.addEventListener('mouseover', (e) => {
            const anchor = e.target.closest('a');
            if (anchor && anchor.href) {
                prefetch(anchor.href);
            }
        }, { passive: true });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
