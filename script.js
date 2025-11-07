// Tech-inspired interactive elements and animations
let transitionOverlay = null;
let isNavigating = false;
let systemStatusIntervalId = null;
let headerScrollHandler = null;
let terminalTimeoutId = null;

document.addEventListener('DOMContentLoaded', function() {
    
    // Initialize page transition
    initPageTransitions();
    
    // Initialize particles background
    initParticles();
    
    // Initialize tech animations
    initTechAnimations();
    
    // Terminal typing animation
    initTerminalAnimation();
    
    // Smooth scrolling for navigation links
    initSmoothScrolling();
    
    // Header scroll effects
    initHeaderEffects();
    
    // Interactive hover effects
    initHoverEffects();
    
    // System status indicator
    initSystemStatus();
    
    // Keyboard shortcuts
    initKeyboardShortcuts();

    // Mobile menu toggle
    initMobileMenu();

    // Set initial navigation state and history entry
    setActiveNavigation(window.location.href);
    if (!window.history.state) {
        window.history.replaceState({ url: window.location.href }, '', window.location.href);
    }
});

// Page transition system
function initPageTransitions() {
    transitionOverlay = document.querySelector('.page-transition-overlay');
    if (!transitionOverlay) {
        transitionOverlay = document.createElement('div');
        transitionOverlay.className = 'page-transition-overlay';
        document.body.appendChild(transitionOverlay);
    } else {
        transitionOverlay.classList.remove('active');
        transitionOverlay.style.pointerEvents = 'none';
        transitionOverlay.style.opacity = '0';
    }

    document.addEventListener('click', handleDocumentLinkClick);
    window.addEventListener('popstate', handlePopState);
}

function handleDocumentLinkClick(event) {
    const anchor = event.target.closest('a[href]');
    if (!anchor) {
        return;
    }

    const href = anchor.getAttribute('href');
    if (!href || anchor.hasAttribute('download') || anchor.target === '_blank') {
        return;
    }

    if (href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
    }

    if (href.startsWith('#')) {
        event.preventDefault();
        smoothScrollToHash(href);
        return;
    }

    let url;
    try {
        url = new URL(href, window.location.href);
    } catch (error) {
        return;
    }

    const sameOrigin = url.origin === window.location.origin;
    if (!sameOrigin) {
        return;
    }

    const pathname = url.pathname;
    const isHtmlPage = pathname.endsWith('.html') || pathname.endsWith('/') || pathname === '';

    if (!isHtmlPage) {
        return;
    }

    const currentPath = window.location.pathname + window.location.search;
    const targetPath = url.pathname + url.search;
    if (currentPath === targetPath) {
        event.preventDefault();
        if (url.hash) {
            window.history.replaceState({ url: url.toString() }, '', url.toString());
            smoothScrollToHash(url.hash);
        }
        return;
    }

    event.preventDefault();
    navigateTo(url.toString(), { anchor: url.hash });
}

function handlePopState(event) {
    const stateUrl = event.state && event.state.url ? event.state.url : window.location.href;
    const parsedUrl = new URL(stateUrl, window.location.origin);
    navigateTo(parsedUrl.toString(), { addToHistory: false, anchor: parsedUrl.hash });
}

async function navigateTo(url, { addToHistory = true, anchor = '' } = {}) {
    if (isNavigating) {
        return;
    }

    isNavigating = true;

    if (!transitionOverlay) {
        transitionOverlay = document.createElement('div');
        transitionOverlay.className = 'page-transition-overlay';
        document.body.appendChild(transitionOverlay);
    }

    requestAnimationFrame(() => {
        transitionOverlay.style.pointerEvents = 'auto';
        transitionOverlay.classList.add('active');
    });

    try {
        const response = await fetch(url, {
            headers: {
                'X-Requested-With': 'fetch'
            }
        });

        const contentType = response.headers.get('content-type') || '';

        if (!response.ok || !contentType.includes('text/html')) {
            throw new Error('Navigation request failed');
        }

        const html = await response.text();
        await updatePageContent(html, url, anchor);

        if (addToHistory) {
            window.history.pushState({ url }, '', url);
        }
    } catch (error) {
        window.location.href = url;
        return;
    } finally {
        setTimeout(() => {
            transitionOverlay.classList.remove('active');
            transitionOverlay.style.pointerEvents = 'none';
        }, 320);

        isNavigating = false;
    }
}

async function updatePageContent(html, url, anchor = '') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const newTitle = doc.querySelector('title');
    if (newTitle) {
        document.title = newTitle.textContent;
    }

    if (doc.body) {
        document.body.className = doc.body.className;
    }

    const currentMain = document.querySelector('main');
    const newMain = doc.querySelector('main');
    if (currentMain && newMain) {
        currentMain.className = newMain.className;
        currentMain.innerHTML = newMain.innerHTML;
    }

    const currentFooter = document.querySelector('footer');
    const newFooter = doc.querySelector('footer');
    if (newFooter) {
        if (currentFooter) {
            currentFooter.replaceWith(newFooter);
        } else {
            document.body.appendChild(newFooter);
        }
    }

    // Ensure particles container exists once
    let particlesContainer = document.getElementById('particles-js');
    if (!particlesContainer) {
        const newParticlesContainer = doc.getElementById('particles-js');
        if (newParticlesContainer) {
            document.body.appendChild(newParticlesContainer);
            particlesContainer = newParticlesContainer;
        }
    }

    setActiveNavigation(url);
    reinitializeDynamicContent();

    if (anchor) {
        requestAnimationFrame(() => smoothScrollToHash(anchor));
    } else {
        window.scrollTo({ top: 0, behavior: 'auto' });
    }
}

function reinitializeDynamicContent() {
    initTechAnimations();
    initTerminalAnimation();
    initHoverEffects();
    initSystemStatus();
    initSmoothScrolling();
    initHeaderEffects();
}

function setActiveNavigation(url) {
    const normalizePath = (path) => {
        const cleaned = (path || '').replace(/^\//, '');
        if (!cleaned || cleaned === '/' || cleaned === 'index.html') {
            return 'home.html';
        }
        return cleaned;
    };

    const targetUrl = new URL(url, window.location.origin);
    const normalizedTarget = normalizePath(targetUrl.pathname);

    document.querySelectorAll('.nav-link').forEach(link => {
        const linkHref = link.getAttribute('href');
        if (!linkHref) {
            return;
        }

        let normalizedLink;
        try {
            normalizedLink = normalizePath(new URL(linkHref, window.location.origin).pathname);
        } catch (error) {
            return;
        }

        if (normalizedLink === normalizedTarget) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    document.querySelectorAll('.footer-link').forEach(link => {
        const linkHref = link.getAttribute('href');
        if (!linkHref) {
            return;
        }

        let normalizedLink;
        try {
            normalizedLink = normalizePath(new URL(linkHref, window.location.origin).pathname);
        } catch (error) {
            return;
        }

        if (normalizedLink === normalizedTarget) {
            link.classList.add('active-footer');
        } else {
            link.classList.remove('active-footer');
        }
    });
}

function smoothScrollToHash(hash) {
    if (!hash) {
        return;
    }

    const targetId = hash.replace('#', '');
    let targetElement = document.getElementById(targetId);

    if (!targetElement) {
        createPlaceholderSection(targetId);
        targetElement = document.getElementById(targetId);
    }

    if (targetElement) {
        targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Particles.js initialization
function initParticles() {
    // Create particle system
    const particlesContainer = document.getElementById('particles-js');
    
    // Simple particle system without external library
    for (let i = 0; i < 50; i++) {
        createParticle(particlesContainer);
    }
}

function createParticle(container) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.cssText = `
        position: absolute;
        width: 2px;
        height: 2px;
        background: rgba(255, 106, 45, 0.4);
        border-radius: 50%;
        pointer-events: none;
        animation: particleFloat ${Math.random() * 20 + 10}s linear infinite;
    `;
    
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 20 + 's';
    
    container.appendChild(particle);
}

// Add particle animation CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes particleFloat {
        0% {
            transform: translateY(100vh) translateX(0);
            opacity: 0;
        }
        10% {
            opacity: 1;
        }
        90% {
            opacity: 1;
        }
        100% {
            transform: translateY(-100px) translateX(${Math.random() * 200 - 100}px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Tech animations
function initTechAnimations() {
    // Randomize tech element positions on load
    randomizeTechElementPositions();
    
    // Glitch effect on logo
    const logo = document.querySelector('.logo-text');
    if (logo) {
        logo.addEventListener('mouseenter', () => {
            logo.style.animation = 'glitch 0.3s ease-in-out';
        });
        
        logo.addEventListener('animationend', () => {
            logo.style.animation = 'glow 2s ease-in-out infinite alternate';
        });
    }
    
    // Add glitch animation
    if (!document.getElementById('glitch-animation-style')) {
        const glitchStyle = document.createElement('style');
        glitchStyle.id = 'glitch-animation-style';
        glitchStyle.textContent = `
            @keyframes glitch {
                0% { transform: translate(0); }
                20% { transform: translate(-2px, 2px); }
                40% { transform: translate(-2px, -2px); }
                60% { transform: translate(2px, 2px); }
                80% { transform: translate(2px, -2px); }
                100% { transform: translate(0); }
            }
        `;
        document.head.appendChild(glitchStyle);
    }
    
    // Matrix-style code rain effect
    document.querySelectorAll('.code-rain').forEach(el => el.remove());
    createCodeRain();
}

// Randomize tech element positions
function randomizeTechElementPositions() {
    const techElements = document.querySelectorAll('.tech-element');
    const placedPositions = []; // Track positions to avoid overlaps
    const minDistance = 120; // Minimum distance between badges in pixels
    
    techElements.forEach((element, index) => {
        let attempts = 0;
        let positionFound = false;
        
        while (!positionFound && attempts < 50) {
            attempts++;
            
            // Generate random positions while avoiding the center area
            const minMargin = 5; // Minimum margin from edges (in %)
            const maxMargin = 25; // Maximum margin from edges (in %)
            
            // Random top/bottom position (avoiding center 30-50% for main content)
            let topPercent;
            const randomSide = Math.random();
            if (randomSide < 0.5) {
                // Top area (0-30%)
                topPercent = Math.random() * 25 + minMargin;
            } else {
                // Bottom area (50-100%)
                topPercent = Math.random() * 40 + 55;
            }
            
            // Random left/right position
            let leftPercent, rightPercent;
            const horizontalSide = Math.random();
            let useLeft = horizontalSide < 0.5;
            
            if (useLeft) {
                // Left side
                leftPercent = Math.random() * maxMargin + minMargin;
                rightPercent = null;
            } else {
                // Right side
                rightPercent = Math.random() * maxMargin + minMargin;
                leftPercent = null;
            }
            
            // Check for collisions with already placed badges
            let overlaps = false;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Convert percentage to pixels
            const xPos = leftPercent !== null 
                ? (leftPercent / 100) * viewportWidth 
                : viewportWidth - ((rightPercent / 100) * viewportWidth);
            const yPos = (topPercent / 100) * viewportHeight;
            
            // Check distance from all placed badges
            for (let i = 0; i < placedPositions.length; i++) {
                const existingPos = placedPositions[i];
                const distance = Math.sqrt(
                    Math.pow(xPos - existingPos.x, 2) + 
                    Math.pow(yPos - existingPos.y, 2)
                );
                
                if (distance < minDistance) {
                    overlaps = true;
                    break;
                }
            }
            
            // If no overlap, place the badge
            if (!overlaps) {
                if (useLeft) {
                    element.style.left = leftPercent + '%';
                    element.style.right = 'auto';
                } else {
                    element.style.right = rightPercent + '%';
                    element.style.left = 'auto';
                }
                
                element.style.top = topPercent + '%';
                element.style.bottom = 'auto';
                
                // Random animation delay for float only
                const floatDelay = (Math.random() * 4);
                element.style.animationDelay = `0s, ${floatDelay}s`;
                
                // Store position
                placedPositions.push({ x: xPos, y: yPos });
                positionFound = true;
            }
        }
    });
}

function createCodeRain() {
    const codeContainer = document.createElement('div');
    codeContainer.className = 'code-rain';
    codeContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: -1;
        overflow: hidden;
    `;
    document.body.appendChild(codeContainer);
    
    // Create lines moving in random directions (horizontal or vertical only)
    const numLines = 60; // Number of animated lines
    
    for (let i = 0; i < numLines; i++) {
        createAnimatedLine(codeContainer);
    }
}

function createAnimatedLine(container) {
    // Randomly choose horizontal or vertical
    const isHorizontal = Math.random() > 0.5;
    
    const line = document.createElement('div');
    const lineLength = Math.random() * 500 + 300; // Random length between 300-800px
    const startPos = isHorizontal 
        ? Math.random() * window.innerHeight // Random Y position for horizontal
        : Math.random() * window.innerWidth; // Random X position for vertical
    
    const duration = Math.random() * 10 + 5; // Animation duration 5-15s
    const delay = Math.random() * 5; // Random delay
    
    if (isHorizontal) {
        // Horizontal line moving left to right
        line.style.cssText = `
            position: absolute;
            left: ${-lineLength}px;
            top: ${startPos}px;
            width: ${lineLength}px;
            height: 2px;
            background: linear-gradient(90deg, transparent, rgba(255, 106, 45, 0.2), transparent);
            animation: moveRight ${duration}s linear infinite;
            animation-delay: ${delay}s;
            box-shadow: 0 0 10px rgba(255, 106, 45, 0.3);
        `;
    } else {
        // Vertical line moving top to bottom
        line.style.cssText = `
            position: absolute;
            left: ${startPos}px;
            top: ${-lineLength}px;
            width: 2px;
            height: ${lineLength}px;
            background: linear-gradient(180deg, transparent, rgba(255, 106, 45, 0.2), transparent);
            animation: moveDown ${duration}s linear infinite;
            animation-delay: ${delay}s;
            box-shadow: 0 0 10px rgba(255, 106, 45, 0.3);
        `;
    }
    
    container.appendChild(line);
    
    // Add keyframe animations if they don't exist
    if (!document.querySelector('#line-animations-style')) {
        const style = document.createElement('style');
        style.id = 'line-animations-style';
        style.textContent = `
            @keyframes moveRight {
                0% { transform: translateX(0); opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { transform: translateX(${window.innerWidth + lineLength}px); opacity: 0; }
            }
            @keyframes moveDown {
                0% { transform: translateY(0); opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { transform: translateY(${window.innerHeight + lineLength}px); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Terminal typing animation
function initTerminalAnimation() {
    if (terminalTimeoutId) {
        clearTimeout(terminalTimeoutId);
        terminalTimeoutId = null;
    }

    const terminalLine = document.getElementById('typing-line');
    if (!terminalLine) return;
    
    const messages = [
        'Engineering creative solution...',
        'Compiling custom build...',
        'Initializing fabrication process...',
        '3D printing component...',
        'Integrating ESP32 module...',
        'Calibrating LED systems...',
        'Deploying automation script...',
        'System optimization complete!',
        'Running quality tests...',
        'Packaging custom solution...',
        'Shipment ready for delivery.',
        'All systems operational! ✓'
    ];
    
    let currentMessage = 0;
    let currentChar = 0;
    let isDeleting = false;
    let messageCount = 0;
    
    function typeWriter() {
        const message = messages[currentMessage];
        
        if (isDeleting) {
            terminalLine.textContent = message.substring(0, currentChar - 1);
            currentChar--;
        } else {
            terminalLine.textContent = message.substring(0, currentChar + 1);
            currentChar++;
        }
        
        let typeSpeed = isDeleting ? 30 : 80;
        
        if (!isDeleting && currentChar === message.length) {
            typeSpeed = 2500; // Pause at end
            isDeleting = true;
            messageCount++;
        } else if (isDeleting && currentChar === 0) {
            isDeleting = false;
            
            // Cycle through messages but occasionally repeat to show activity
            if (Math.random() > 0.3 || messageCount % 8 === 0) {
                currentMessage = (currentMessage + 1) % messages.length;
            } else {
                // Sometimes repeat the same message to show continuous work
                currentMessage = Math.min(messages.length - 1, currentMessage);
            }
            
            typeSpeed = 300;
        }
        
        terminalTimeoutId = setTimeout(typeWriter, typeSpeed);
    }
    
    // Start typing immediately
    typeWriter();
    
    // Add additional terminal activity effect
    addTerminalActivity();
}

function addTerminalActivity() {
    const terminalContent = document.getElementById('terminal-content');
    if (!terminalContent) return;
    
    // Add more visual activity indicators
    const activityIndicator = document.createElement('div');
    activityIndicator.className = 'terminal-line terminal-status';
    activityIndicator.textContent = '● Building...';
    activityIndicator.style.cssText = `
        color: rgba(255, 106, 45, 0.6);
        font-size: 11px;
        margin-top: 5px;
        animation: pulse-dot 2s ease-in-out infinite;
    `;
    
    // Only add if it doesn't already exist
    if (!terminalContent.querySelector('.terminal-status')) {
        terminalContent.appendChild(activityIndicator);
    }
}

// Smooth scrolling for navigation
function initSmoothScrolling() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.dataset.smoothBound === 'true') {
            return;
        }

        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                } else {
                    // Create placeholder sections if they don't exist
                    createPlaceholderSection(href.substring(1));
                }
            }
        });

        link.dataset.smoothBound = 'true';
    });
    
    // CTA button functionality
    const ctaButton = document.querySelector('.cta-button');
    if (ctaButton && ctaButton.dataset.projectsBound !== 'true') {
        ctaButton.addEventListener('click', function() {
            createPlaceholderSection('projects');
        });
        ctaButton.dataset.projectsBound = 'true';
    }
}

function createPlaceholderSection(sectionName) {
    let section = document.getElementById(sectionName);
    if (!section) {
        section = document.createElement('section');
        section.id = sectionName;
        section.innerHTML = `
            <div class="container" style="padding: 100px 20px; text-align: center;">
                <h2 style="font-family: 'Orbitron', monospace; font-size: 3rem; margin-bottom: 20px; color: var(--accent-color);">
                    ${sectionName.toUpperCase()}
                </h2>
                <p style="color: var(--secondary-text); font-size: 1.2rem;">
                    This section is under development. More content coming soon!
                </p>
                <div style="margin-top: 40px;">
                    <button class="cta-button" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">
                        BACK TO TOP
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(section);
    }
    
    section.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

// Header scroll effects
function initHeaderEffects() {
    const header = document.querySelector('.header');
    
    if (!header) return;
    
    // Ensure header stays visible at the top
    header.style.transform = 'translateY(0)';
    header.style.opacity = '1';
    header.style.visibility = 'visible';
    
    if (headerScrollHandler) {
        window.removeEventListener('scroll', headerScrollHandler);
    }

    headerScrollHandler = function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        const heroVisual = document.querySelector('.hero-visual');
        if (heroVisual) {
            heroVisual.style.transform = `translateY(${scrollTop * 0.1}px)`;
        }
    };

    window.addEventListener('scroll', headerScrollHandler, { passive: true });
}

// Interactive hover effects
function initHoverEffects() {
    // Tech elements hover effects
    const techElements = document.querySelectorAll('.tech-element');
    techElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.05)';
            this.style.boxShadow = '0 20px 40px rgba(255, 106, 45, 0.2)';
        });
        
        element.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
            this.style.boxShadow = 'none';
        });
    });
    
    // Stats hover effects
    const statNumbers = document.querySelectorAll('.stat-number');
    statNumbers.forEach(stat => {
        stat.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1)';
            this.style.textShadow = '0 0 20px rgba(255, 106, 45, 0.5)';
        });
        
        stat.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
            this.style.textShadow = 'none';
        });
    });
}

// System status indicator
function initSystemStatus() {
    if (systemStatusIntervalId) {
        clearInterval(systemStatusIntervalId);
        systemStatusIntervalId = null;
    }

    const systemIndicator = document.querySelector('.tech-indicator');
    if (!systemIndicator) return;
    
    const statuses = [
        { text: 'SYSTEMS ONLINE', color: 'var(--accent-color)' },
        { text: 'LOADING', color: 'var(--warning-color)' },
        { text: 'PROCESSING', color: 'var(--accent-secondary)' },
        { text: 'READY', color: 'var(--accent-color)' }
    ];
    
    let currentStatus = 0;
    
    function updateStatus() {
        const status = statuses[currentStatus];
        const statusText = systemIndicator.querySelector('span');
        const pulseDot = systemIndicator.querySelector('.pulse-dot');
        
        if (statusText) statusText.textContent = status.text;
        if (pulseDot) pulseDot.style.background = status.color;
        
        currentStatus = (currentStatus + 1) % statuses.length;
    }
    
    updateStatus();

    // Update status every 3 seconds
    systemStatusIntervalId = setInterval(updateStatus, 3000);
}

// Keyboard shortcuts
function initKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + K for quick actions
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            showQuickActions();
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            closeModals();
        }
    });
}

function showQuickActions() {
    const quickActions = document.createElement('div');
    quickActions.className = 'quick-actions-modal';
    quickActions.innerHTML = `
        <div class="quick-actions-content">
            <h3>Quick Actions</h3>
            <div class="quick-actions-list">
                <button onclick="createPlaceholderSection('projects')">View Projects</button>
                <button onclick="createPlaceholderSection('services')">Our Services</button>
                <button onclick="createPlaceholderSection('about')">About Us</button>
                <button onclick="createPlaceholderSection('contact')">Contact</button>
            </div>
            <p class="quick-actions-hint">Press ESC to close</p>
        </div>
    `;
    
    quickActions.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(10px);
    `;
    
    const content = quickActions.querySelector('.quick-actions-content');
    content.style.cssText = `
        background: var(--glass-bg);
        border: 1px solid var(--glass-border);
        border-radius: 10px;
        padding: 30px;
        text-align: center;
        backdrop-filter: blur(20px);
    `;
    
    document.body.appendChild(quickActions);
    
    // Auto-close after 5 seconds
    setTimeout(() => {
        if (quickActions.parentNode) {
            quickActions.remove();
        }
    }, 5000);
}

function closeModals() {
    const modals = document.querySelectorAll('.quick-actions-modal');
    modals.forEach(modal => modal.remove());
}

// Mobile menu toggle
function initMobileMenu() {
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const mobileNav = document.querySelector('.nav-mobile');
    
    if (!mobileToggle || !mobileNav) return;
    
    // Toggle menu on button click
    mobileToggle.addEventListener('click', function() {
        mobileToggle.classList.toggle('active');
        mobileNav.classList.toggle('active');
        
        // Prevent body scroll when menu is open
        if (mobileNav.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    });
    
    // Close menu when clicking on a link
    const mobileLinks = mobileNav.querySelectorAll('.nav-link');
    mobileLinks.forEach(link => {
        link.addEventListener('click', function() {
            mobileToggle.classList.remove('active');
            mobileNav.classList.remove('active');
            document.body.style.overflow = '';
        });
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
        if (mobileNav.classList.contains('active')) {
            if (!mobileNav.contains(e.target) && !mobileToggle.contains(e.target)) {
                mobileToggle.classList.remove('active');
                mobileNav.classList.remove('active');
                document.body.style.overflow = '';
            }
        }
    });
    
    // Handle logout button in mobile menu (admin page)
    const logoutBtnMobile = document.getElementById('logout-btn-mobile');
    if (logoutBtnMobile) {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtnMobile.addEventListener('click', function() {
                logoutBtn.click();
            });
        }
    }
    
    // Close menu on window resize if it goes back to desktop
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            mobileToggle.classList.remove('active');
            mobileNav.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

// Performance monitoring
function initPerformanceMonitoring() {
    // Monitor FPS
    let lastTime = performance.now();
    let frameCount = 0;
    
    function measureFPS() {
        frameCount++;
        const currentTime = performance.now();
        
        if (currentTime - lastTime >= 1000) {
            const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
            
            // Update system status with FPS
            const systemIndicator = document.querySelector('.tech-indicator span');
            if (systemIndicator && fps < 30) {
                systemIndicator.textContent = `LOW FPS: ${fps}`;
            }
            
            frameCount = 0;
            lastTime = currentTime;
        }
        
        requestAnimationFrame(measureFPS);
    }
    
    requestAnimationFrame(measureFPS);
}

// Initialize performance monitoring
initPerformanceMonitoring();
