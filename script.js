// Tech-inspired interactive elements and animations
document.addEventListener('DOMContentLoaded', function() {
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
});

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
        background: rgba(0, 255, 136, 0.6);
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
    const glitchStyle = document.createElement('style');
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
    
    // Matrix-style code rain effect
    createCodeRain();
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
    
    const characters = '01';
    const columns = Math.floor(window.innerWidth / 20);
    
    for (let i = 0; i < columns; i++) {
        createCodeColumn(codeContainer, i * 20, characters);
    }
}

function createCodeColumn(container, x, characters) {
    const column = document.createElement('div');
    column.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: -100px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 14px;
        color: rgba(0, 255, 136, 0.1);
        line-height: 20px;
        animation: codeFall ${Math.random() * 10 + 5}s linear infinite;
        animation-delay: ${Math.random() * 5}s;
    `;
    
    let text = '';
    for (let i = 0; i < 50; i++) {
        text += characters[Math.floor(Math.random() * characters.length)] + '<br>';
    }
    column.innerHTML = text;
    
    container.appendChild(column);
    
    // Add code fall animation
    if (!document.querySelector('#code-rain-style')) {
        const codeStyle = document.createElement('style');
        codeStyle.id = 'code-rain-style';
        codeStyle.textContent = `
            @keyframes codeFall {
                0% { transform: translateY(-100px); }
                100% { transform: translateY(100vh); }
            }
        `;
        document.head.appendChild(codeStyle);
    }
}

// Terminal typing animation
function initTerminalAnimation() {
    const terminalLine = document.querySelector('.terminal-line.typing');
    if (!terminalLine) return;
    
    const messages = [
        'Initializing cutting-edge tech stack...',
        'Loading quantum algorithms...',
        'Optimizing neural networks...',
        'Deploying to cloud infrastructure...',
        'Running security protocols...',
        'System ready for innovation!'
    ];
    
    let currentMessage = 0;
    let currentChar = 0;
    let isDeleting = false;
    
    function typeWriter() {
        const message = messages[currentMessage];
        
        if (isDeleting) {
            terminalLine.textContent = message.substring(0, currentChar - 1);
            currentChar--;
        } else {
            terminalLine.textContent = message.substring(0, currentChar + 1);
            currentChar++;
        }
        
        let typeSpeed = isDeleting ? 50 : 100;
        
        if (!isDeleting && currentChar === message.length) {
            typeSpeed = 2000; // Pause at end
            isDeleting = true;
        } else if (isDeleting && currentChar === 0) {
            isDeleting = false;
            currentMessage = (currentMessage + 1) % messages.length;
            typeSpeed = 500;
        }
        
        setTimeout(typeWriter, typeSpeed);
    }
    
    typeWriter();
}

// Smooth scrolling for navigation
function initSmoothScrolling() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
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
    });
    
    // CTA button functionality
    const ctaButton = document.querySelector('.cta-button');
    if (ctaButton) {
        ctaButton.addEventListener('click', function() {
            createPlaceholderSection('projects');
        });
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
    let lastScrollTop = 0;
    const header = document.querySelector('.header');
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            // Scrolling down
            header.style.transform = 'translateY(-100%)';
        } else {
            // Scrolling up
            header.style.transform = 'translateY(0)';
        }
        
        lastScrollTop = scrollTop;
        
        // Parallax effect for hero elements
        const heroVisual = document.querySelector('.hero-visual');
        if (heroVisual) {
            heroVisual.style.transform = `translateY(${scrollTop * 0.1}px)`;
        }
    });
    
    header.style.transition = 'transform 0.3s ease-in-out';
}

// Interactive hover effects
function initHoverEffects() {
    // Tech elements hover effects
    const techElements = document.querySelectorAll('.tech-element');
    techElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.05)';
            this.style.boxShadow = '0 20px 40px rgba(0, 255, 136, 0.2)';
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
            this.style.textShadow = '0 0 20px rgba(0, 255, 136, 0.5)';
        });
        
        stat.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
            this.style.textShadow = 'none';
        });
    });
}

// System status indicator
function initSystemStatus() {
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
    
    // Update status every 3 seconds
    setInterval(updateStatus, 3000);
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

// Add loading completion effect
window.addEventListener('load', function() {
    document.body.classList.add('loaded');
    
    // Add a subtle entrance animation to all elements
    const elements = document.querySelectorAll('.hero-content, .hero-visual, .nav, .footer');
    elements.forEach((element, index) => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            element.style.transition = 'all 0.6s ease-out';
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }, index * 100);
    });
});