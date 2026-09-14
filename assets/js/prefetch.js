// Just-in-time prefetching — preload pages right before the user clicks
// Based on instant.page's approach with 65ms hover delay, touch support,
// speculation rules, and viewport preloading
(function () {
    'use strict';

    const DELAY_ON_HOVER = 65;
    const MAX_TOUCH_DURATION = 2500;

    const preloaded = new Set();
    let lastTouchstartEvent = null;
    let mouseoverTimer = null;

    // Browser support: need prefetch support + modern APIs
    const supportsPrefetch = (() => {
        try {
            return document.createElement('link').relList.supports('prefetch');
        } catch {
            return false;
        }
    })();

    if (!supportsPrefetch) return;

    const supportsSpeculationRules = HTMLScriptElement.supports &&
        HTMLScriptElement.supports('speculationrules');

    function isPreloadable(anchor) {
        if (!anchor || !anchor.href) return false;
        if (anchor.origin !== location.origin) return false;
        if (!['http:', 'https:'].includes(anchor.protocol)) return false;
        if (anchor.protocol === 'http:' && location.protocol === 'https:') return false;
        if (anchor.pathname + anchor.search === location.pathname + location.search) return false;
        if ('noInstant' in anchor.dataset) return false;
        if (anchor.dataset.instant === '') { /* whitelist */ }
        return true;
    }

    function preload(url, priority) {
        if (preloaded.has(url)) return;

        if (supportsSpeculationRules) {
            const script = document.createElement('script');
            script.type = 'speculationrules';
            script.textContent = JSON.stringify({
                prefetch: [{ source: 'list', urls: [url] }]
            });
            document.head.appendChild(script);
        } else {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = url;
            link.as = 'document';
            if (priority === 'high') link.fetchPriority = 'high';
            document.head.appendChild(link);
        }

        preloaded.add(url);
    }

    function isLikelyTouchEvent(event) {
        if (!lastTouchstartEvent || !event) return false;
        if (event.target !== lastTouchstartEvent.target) return false;
        return (event.timeStamp - lastTouchstartEvent.timeStamp) < MAX_TOUCH_DURATION;
    }

    function mouseoverListener(event) {
        if (isLikelyTouchEvent(event)) return;
        if (!('closest' in event.target)) return;

        const anchor = event.target.closest('a');
        if (!isPreloadable(anchor)) return;

        anchor.addEventListener('mouseout', mouseoutListener, { passive: true });

        mouseoverTimer = setTimeout(() => {
            preload(anchor.href, 'high');
            mouseoverTimer = null;
        }, DELAY_ON_HOVER);
    }

    function mouseoutListener(event) {
        if (event.relatedTarget && event.target.closest('a') === event.relatedTarget.closest('a')) return;
        if (mouseoverTimer) {
            clearTimeout(mouseoverTimer);
            mouseoverTimer = null;
        }
    }

    function touchstartListener(event) {
        lastTouchstartEvent = event;
        const anchor = event.target.closest('a');
        if (isPreloadable(anchor)) preload(anchor.href, 'high');
    }

    function mousedownListener(event) {
        if (isLikelyTouchEvent(event)) return;
        const anchor = event.target.closest('a');
        if (isPreloadable(anchor)) preload(anchor.href, 'high');
    }

    function init() {
        document.addEventListener('touchstart', touchstartListener, { capture: true, passive: true });
        document.addEventListener('mouseover', mouseoverListener, { capture: true, passive: true });
        document.addEventListener('mousedown', mousedownListener, { capture: true, passive: true });

        if (document.body.dataset.instantIntensity === 'viewport') {
            const saveData = navigator.connection && navigator.connection.saveData;
            if (!saveData) {
                requestIdleCallback(() => {
                    const observer = new IntersectionObserver((entries) => {
                        entries.forEach((entry) => {
                            if (entry.isIntersecting) {
                                observer.unobserve(entry.target);
                                preload(entry.target.href);
                            }
                        });
                    });
                    document.querySelectorAll('a[href]').forEach((anchor) => {
                        if (isPreloadable(anchor)) observer.observe(anchor);
                    });
                }, { timeout: 1500 });
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
