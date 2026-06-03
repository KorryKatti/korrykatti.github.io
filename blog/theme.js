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

    function applyBionicReading(element) {
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
            // Match words (including single letters)
            const parts = text.split(/(\b[a-zA-Z]+\b)/g);
            if (parts.length > 1) {
                const fragment = document.createDocumentFragment();
                parts.forEach(part => {
                    if (/^[a-zA-Z]+$/.test(part)) {
                        const len = part.length;
                        let highlightCount = 1;
                        
                        if (len <= 3) {
                            highlightCount = 1; 
                        } else {
                            highlightCount = Math.floor(len * 0.4) || 1;
                        }
                        
                        const boldPart = part.substring(0, highlightCount);
                        const restPart = part.substring(highlightCount);
                        
                        const span = document.createElement('span');
                        span.className = 'b-letter';
                        span.textContent = boldPart;
                        fragment.appendChild(span);
                        if (restPart) {
                            fragment.appendChild(document.createTextNode(restPart));
                        }
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
