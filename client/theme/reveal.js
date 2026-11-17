// Fade-in on scroll for [data-reveal] elements (studio theme). No-op without
// IntersectionObserver or when the user prefers reduced motion.
(function() {
    'use strict';
    if (!('IntersectionObserver' in window)
        || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }
    document.documentElement.classList.add('ts-js');

    function init() {
        const targets = document.querySelectorAll('[data-reveal]');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
        targets.forEach((el, index) => {
            el.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
            observer.observe(el);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
