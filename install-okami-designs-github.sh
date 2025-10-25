#!/bin/bash

# Okami Designs Website Installation Script for Proxmox
# This script downloads and installs the Okami Designs website from GitHub
# Run this script on your Proxmox server or LXC container

set -e  # Exit on any error

echo "🎌 Okami Designs Website Installation Script (GitHub Version)"
echo "============================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run this script as root (use sudo)"
    exit 1
fi

# GitHub repository configuration
GITHUB_USER="Jallison154"  # Your GitHub username
GITHUB_REPO="OkamiDesignsWebsite"  # Your repository name
GITHUB_BRANCH="main"  # Your default branch

print_status "Starting Okami Designs website installation from GitHub..."

# Update system
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install prerequisites
print_status "Installing prerequisites..."
apt install -y apt-transport-https ca-certificates curl gnupg lsb-release wget unzip git

# Install Docker
print_status "Installing Docker..."
if ! command -v docker &> /dev/null; then
    # Add Docker GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    print_success "Docker installed successfully"
else
    print_success "Docker is already installed"
fi

# Create website directory
print_status "Creating website directory..."
mkdir -p /opt/okami-designs
cd /opt/okami-designs

# Download from GitHub
print_status "Downloading Okami Designs website from GitHub..."

# Try to clone from GitHub
if git clone https://github.com/$GITHUB_USER/$GITHUB_REPO.git . 2>/dev/null; then
    print_success "Successfully downloaded from GitHub repository"
    
    # Checkout the correct branch
    if [ "$GITHUB_BRANCH" != "main" ]; then
        git checkout $GITHUB_BRANCH
    fi
    
    # Pull latest changes
    git pull origin $GITHUB_BRANCH
    
elif curl -s -o /dev/null -w "%{http_code}" https://github.com/$GITHUB_USER/$GITHUB_REPO | grep -q "200"; then
    print_warning "Git clone failed, trying direct download..."
    
    # Download individual files from GitHub raw URLs
    print_status "Downloading individual files..."
    
    # Create basic website structure
    mkdir -p images
    
    # Download files from GitHub raw URLs
    curl -s -o index.html "https://raw.githubusercontent.com/$GITHUB_USER/$GITHUB_REPO/$GITHUB_BRANCH/index.html" || print_warning "Could not download index.html"
    curl -s -o styles.css "https://raw.githubusercontent.com/$GITHUB_USER/$GITHUB_REPO/$GITHUB_BRANCH/styles.css" || print_warning "Could not download styles.css"
    curl -s -o script.js "https://raw.githubusercontent.com/$GITHUB_USER/$GITHUB_REPO/$GITHUB_BRANCH/script.js" || print_warning "Could not download script.js"
    curl -s -o docker-compose.yml "https://raw.githubusercontent.com/$GITHUB_USER/$GITHUB_REPO/$GITHUB_BRANCH/docker-compose.yml" || print_warning "Could not download docker-compose.yml"
    curl -s -o nginx.conf "https://raw.githubusercontent.com/$GITHUB_USER/$GITHUB_REPO/$GITHUB_BRANCH/nginx.conf" || print_warning "Could not download nginx.conf"
    
    print_success "Downloaded files from GitHub"
    
else
    print_warning "GitHub repository not found, creating default website..."
    
    # Create default website files
    print_status "Creating default Okami Designs website files..."
    
    # Create index.html
    cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Okami Designs - Japanese-Inspired Ceramics</title>
    <meta name="description" content="Discover the beauty of Japanese-inspired ceramic designs. Handcrafted pottery that brings elegance to your home.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header class="header">
        <nav class="nav">
            <div class="nav-brand">
                <h1>Okami Designs</h1>
            </div>
            <ul class="nav-menu">
                <li><a href="#home">Home</a></li>
                <li><a href="#about">About</a></li>
                <li><a href="#gallery">Gallery</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
        </nav>
    </header>

    <main>
        <section id="home" class="hero">
            <div class="hero-content">
                <h2 class="hero-title">Japanese-Inspired Ceramics</h2>
                <p class="hero-subtitle">Handcrafted pottery that brings the essence of Japan to your home</p>
                <a href="#gallery" class="cta-button">Explore Collection</a>
            </div>
            <div class="hero-images">
                <div class="image-grid">
                    <div class="image-item image-1">
                        <img src="images/vase-1.jpg" alt="Traditional Japanese vase" loading="lazy">
                    </div>
                    <div class="image-item image-2">
                        <img src="images/vase-2.jpg" alt="Handcrafted ceramic bowl" loading="lazy">
                    </div>
                    <div class="image-item image-3">
                        <img src="images/vase-3.jpg" alt="Collection of ceramic pieces" loading="lazy">
                    </div>
                </div>
            </div>
        </section>

        <section id="about" class="about">
            <div class="container">
                <h2>About Okami Designs</h2>
                <p>Inspired by the wolf spirit of Japanese folklore, Okami Designs creates ceramic pieces that embody strength, elegance, and natural beauty. Each piece is carefully crafted using traditional techniques with a modern aesthetic.</p>
            </div>
        </section>

        <section id="gallery" class="gallery">
            <div class="container">
                <h2>Our Collection</h2>
                <div class="gallery-grid">
                    <div class="gallery-item">
                        <img src="images/vase-1.jpg" alt="Traditional Japanese vase" loading="lazy">
                        <h3>Traditional Vase</h3>
                        <p>Classic Japanese-inspired ceramic vase</p>
                    </div>
                    <div class="gallery-item">
                        <img src="images/vase-2.jpg" alt="Handcrafted ceramic bowl" loading="lazy">
                        <h3>Ceramic Bowl</h3>
                        <p>Hand-thrown bowl with natural glaze</p>
                    </div>
                    <div class="gallery-item">
                        <img src="images/vase-3.jpg" alt="Collection of ceramic pieces" loading="lazy">
                        <h3>Collection Set</h3>
                        <p>Complete set of matching ceramic pieces</p>
                    </div>
                </div>
            </div>
        </section>

        <section id="contact" class="contact">
            <div class="container">
                <h2>Contact Us</h2>
                <p>Ready to bring Japanese-inspired ceramics into your home? Get in touch with us.</p>
                <div class="contact-info">
                    <p>📧 info@okamidesigns.com</p>
                    <p>📞 (555) 123-4567</p>
                    <p>📍 Tokyo, Japan</p>
                </div>
            </div>
        </section>
    </main>

    <footer class="footer">
        <p>&copy; 2024 Okami Designs. All rights reserved.</p>
    </footer>

    <script src="script.js"></script>
</body>
</html>
EOF

    # Create styles.css (simplified version)
    cat > styles.css << 'EOF'
/* Okami Designs - Japanese-Inspired Ceramics Website */

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Inter', sans-serif;
    line-height: 1.6;
    color: #FFFFFF;
    background-color: #4A3F3A;
    overflow-x: hidden;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

/* Header */
.header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: rgba(74, 63, 58, 0.95);
    backdrop-filter: blur(10px);
    z-index: 1000;
    padding: 1rem 0;
}

.nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

.nav-brand h1 {
    font-family: 'Playfair Display', serif;
    font-size: 2rem;
    font-weight: 700;
    color: #EAE0D5;
}

.nav-menu {
    display: flex;
    list-style: none;
    gap: 2rem;
}

.nav-menu a {
    color: #FFFFFF;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.3s ease;
}

.nav-menu a:hover {
    color: #EAE0D5;
}

/* Hero Section */
.hero {
    min-height: 100vh;
    display: flex;
    align-items: center;
    padding: 100px 20px 50px;
    position: relative;
}

.hero-content {
    flex: 1;
    max-width: 600px;
    z-index: 2;
}

.hero-title {
    font-family: 'Playfair Display', serif;
    font-size: 3.5rem;
    font-weight: 700;
    margin-bottom: 1rem;
    color: #EAE0D5;
}

.hero-subtitle {
    font-size: 1.2rem;
    margin-bottom: 2rem;
    color: #FFFFFF;
}

.cta-button {
    display: inline-block;
    background: #EAE0D5;
    color: #4A3F3A;
    padding: 15px 30px;
    text-decoration: none;
    border-radius: 5px;
    font-weight: 600;
    transition: all 0.3s ease;
}

.cta-button:hover {
    background: #FFFFFF;
    transform: translateY(-2px);
}

/* About, Gallery, Contact sections */
.about, .gallery, .contact {
    padding: 100px 0;
    text-align: center;
}

.about {
    background: rgba(255, 255, 255, 0.05);
}

.contact {
    background: rgba(255, 255, 255, 0.05);
}

h2 {
    font-family: 'Playfair Display', serif;
    font-size: 2.5rem;
    margin-bottom: 2rem;
    color: #EAE0D5;
}

/* Footer */
.footer {
    background: rgba(0, 0, 0, 0.3);
    padding: 2rem 0;
    text-align: center;
    color: #FFFFFF;
}

/* Responsive Design */
@media (max-width: 768px) {
    .nav {
        flex-direction: column;
        gap: 1rem;
    }
    
    .hero {
        flex-direction: column;
        text-align: center;
    }
    
    .hero-title {
        font-size: 2.5rem;
    }
}
EOF

    # Create script.js
    cat > script.js << 'EOF'
// Okami Designs Website JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('.nav-menu a[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});
EOF

    # Create docker-compose.yml
    cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  okami-designs-web:
    image: nginx:alpine
    container_name: okami-designs-website
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./:/var/www/okami-designs:ro
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    restart: unless-stopped
    networks:
      - okami-designs-network

networks:
  okami-designs-network:
    driver: bridge
EOF

    # Create nginx.conf
    cat > nginx.conf << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name okami-designs.local localhost;
    root /var/www/okami-designs;
    index index.html index.htm;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # Main location block
    location / {
        try_files $uri $uri/ =404;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
    }
}
EOF

    # Create images directory
    mkdir -p images
    cat > images/placeholder.txt << 'EOF'
Placeholder Images for Okami Designs

Replace these with your actual ceramic images:

1. vase-1.jpg - Traditional Japanese vase
2. vase-2.jpg - Handcrafted ceramic bowl  
3. vase-3.jpg - Collection of ceramic pieces

Recommended image sizes:
- vase-1.jpg: 400x400px
- vase-2.jpg: 300x400px  
- vase-3.jpg: 600x300px

Use WebP format for better performance.
EOF

    print_success "Created default website files"
fi

# Set proper permissions
print_status "Setting file permissions..."
chown -R root:root /opt/okami-designs
chmod -R 755 /opt/okami-designs

# Start the website
print_status "Starting Okami Designs website..."
docker-compose up -d

# Wait for container to start
sleep 5

# Check if container is running
if docker ps | grep -q "okami-designs-website"; then
    print_success "Okami Designs website is running successfully!"
    print_success "Container name: okami-designs-website"
    print_success "Website directory: /opt/okami-designs"
    
    # Get container IP
    CONTAINER_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' okami-designs-website)
    
    echo ""
    print_status "🌐 Access your website at:"
    echo "   Local: http://localhost"
    echo "   Container IP: http://$CONTAINER_IP"
    echo "   Proxmox Server: http://192.168.10.50"
    echo ""
    
    print_status "📁 Website files location: /opt/okami-designs"
    print_status "🖼️  Add your images to: /opt/okami-designs/images/"
    print_status "📝 Edit website files in: /opt/okami-designs/"
    
    echo ""
    print_success "🎌 Okami Designs website installation completed!"
    print_warning "Don't forget to add your ceramic images to the /opt/okami-designs/images/ directory!"
    
else
    print_error "Failed to start the website container"
    print_status "Checking container logs..."
    docker logs okami-designs-website
    exit 1
fi

echo ""
print_status "🔧 Useful commands:"
echo "   View logs: docker logs okami-designs-website"
echo "   Stop website: docker-compose down"
echo "   Start website: docker-compose up -d"
echo "   Restart website: docker-compose restart"
echo ""
print_success "Installation completed successfully! 🎉"
