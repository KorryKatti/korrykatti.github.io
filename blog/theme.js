(function () {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeToggleBtn) themeToggleBtn.textContent = 'light mode';
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            themeToggleBtn.textContent = isDark ? 'light mode' : 'dark mode';
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }

    function highlightFirstLetters(element) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        const nodes = [];
        let node;
        while (node = walker.nextNode()) {
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
            // Match words with 2 or more letters
            const parts = text.split(/(\b[a-zA-Z][a-zA-Z]+\b)/g);
            if (parts.length > 1) {
                const fragment = document.createDocumentFragment();
                parts.forEach(part => {
                    const match = part.match(/^([a-zA-Z])([a-zA-Z]+)$/);
                    if (match) {
                        const span = document.createElement('span');
                        span.className = 'b-letter';
                        span.textContent = match[1];
                        fragment.appendChild(span);
                        fragment.appendChild(document.createTextNode(match[2]));
                    } else {
                        fragment.appendChild(document.createTextNode(part));
                    }
                });
                textNode.parentNode.replaceChild(fragment, textNode);
            }
        });
    }

    const postContents = document.querySelectorAll('.post-content');
    postContents.forEach(highlightFirstLetters);
})();
