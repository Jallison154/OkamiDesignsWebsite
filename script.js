// Simple JavaScript for interactive elements
document.addEventListener('DOMContentLoaded', function() {
    // Play button functionality
    const playBtn = document.getElementById('playBtn');
    let isPlaying = false;
    
    playBtn.addEventListener('click', function() {
        isPlaying = !isPlaying;
        playBtn.textContent = isPlaying ? '▶' : 'II';
        
        // Add any slideshow or video functionality here
        if (isPlaying) {
            console.log('Starting slideshow...');
            // Implement slideshow logic here
        } else {
            console.log('Pausing slideshow...');
            // Implement pause logic here
        }
    });
    
    // Smooth scrolling for navigation links
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
                }
            }
        });
    });
    
    // CTA button functionality
    const ctaButton = document.querySelector('.cta-button');
    ctaButton.addEventListener('click', function() {
        // Scroll to work section or implement other functionality
        const workSection = document.querySelector('#work');
        if (workSection) {
            workSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        } else {
            console.log('Work section not found');
        }
    });
    
    // Add scroll effect to header
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
    });
    
    // Add transition to header
    header.style.transition = 'transform 0.3s ease-in-out';
    
    // Image hover effects
    const heroImages = document.querySelectorAll('.hero-image');
    heroImages.forEach(img => {
        img.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
        });
        
        img.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });
    
    // Add loading animation
    window.addEventListener('load', function() {
        document.body.classList.add('loaded');
    });
});
