(function () {
    // Theme toggle functionality
    const THEME_KEY = 'preferred-theme';
    const DARK_CLASS = 'dark-mode';
    const btn = document.getElementById('theme-toggle-btn');

    function applyTheme(isDark) {
        document.body.classList.toggle(DARK_CLASS, isDark);
        if (btn) btn.textContent = isDark ? 'light_mode' : 'dark_mode';
        try { localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light'); } catch (e) {}
    }

    function initTheme() {
        let stored = null;
        try { stored = localStorage.getItem(THEME_KEY); } catch (e) {}
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = stored ? stored === 'dark' : prefersDark;
        applyTheme(isDark);
    }

    if (btn) {
        btn.addEventListener('click', () => {
            const isDark = document.body.classList.contains(DARK_CLASS);
            applyTheme(!isDark);
        });
    }
    initTheme();

    // Bionic Reading
    function applyBionicReading(element) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        const nodes = [];
        let node;
        while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' ||
                parent.closest('pre') || parent.closest('code') ||
                parent.classList.contains('b-letter')) {
                continue;
            }
            nodes.push(node);
        }
        nodes.forEach(textNode => {
            const text = textNode.nodeValue;
            const parts = text.split(/(\b[a-zA-Z]+\b)/g);
            if (parts.length > 1) {
                const fragment = document.createDocumentFragment();
                parts.forEach(part => {
                    if (/^[a-zA-Z]+$/.test(part)) {
                        const len = part.length;
                        let highlightCount = len <= 3 ? 1 : Math.floor(len * 0.4) || 1;
                        const boldPart = part.substring(0, highlightCount);
                        const restPart = part.substring(highlightCount);
                        const span = document.createElement('span');
                        span.className = 'b-letter';
                        span.textContent = boldPart;
                        fragment.appendChild(span);
                        if (restPart) fragment.appendChild(document.createTextNode(restPart));
                    } else {
                        fragment.appendChild(document.createTextNode(part));
                    }
                });
                textNode.parentNode.replaceChild(fragment, textNode);
            }
        });
    }

    const postContents = document.querySelectorAll('.post-content');
    postContents.forEach(applyBionicReading);
})();