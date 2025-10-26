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
        
        setTimeout(typeWriter, typeSpeed);
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
        color: rgba(0, 255, 136, 0.6);
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