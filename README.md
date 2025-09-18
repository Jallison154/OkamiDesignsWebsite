# Ceramix Website

A modern, responsive website template for Ceramix pottery studio, featuring an elegant dark brown theme with natural, earthy aesthetics.

## Features

- **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices
- **Modern Typography**: Uses Playfair Display (serif) and Inter (sans-serif) fonts
- **Smooth Animations**: Fade-in effects and hover animations
- **SEO Optimized**: Proper meta tags and semantic HTML structure
- **Performance Optimized**: Compressed assets and efficient loading

## Quick Start with Docker

1. **Clone or download the files** to your server
2. **Run with Docker Compose**:
   ```bash
   docker-compose up -d
   ```
3. **Access your website** at `http://your-server-ip`

## Manual Nginx Setup

1. **Install Nginx** on your Proxmox VM/LXC:
   ```bash
   sudo apt update
   sudo apt install nginx
   ```

2. **Create website directory**:
   ```bash
   sudo mkdir -p /var/www/ceramix
   ```

3. **Copy files**:
   ```bash
   sudo cp -r . /var/www/ceramix/
   sudo chown -R www-data:www-data /var/www/ceramix
   ```

4. **Configure Nginx**:
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/ceramix
   sudo ln -s /etc/nginx/sites-available/ceramix /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

## File Structure

```
ceramix/
├── index.html          # Main HTML file
├── styles.css          # CSS styles
├── script.js           # JavaScript functionality
├── nginx.conf          # Nginx configuration
├── docker-compose.yml  # Docker setup
├── images/             # Image assets (create this folder)
│   ├── vase-1.jpg      # Top-left vase image
│   ├── vase-2.jpg      # Right-side hands holding vase
│   └── vase-3.jpg      # Bottom-left vase collection
└── README.md           # This file
```

## Adding Images

Create an `images` folder and add your ceramic vase photos:

- **vase-1.jpg**: Square format, single round vase
- **vase-2.jpg**: Vertical format, hands holding tall vase
- **vase-3.jpg**: Horizontal format, collection of vases

## Customization

### Colors
The main color scheme uses:
- Background: `#4A3F3A` (dark brown)
- Text: `#FFFFFF` (white)
- Button: `#EAE0D5` (light beige)

### Fonts
- Headers: Playfair Display (serif)
- Body text: Inter (sans-serif)

### Layout
The design features:
- Fixed header with navigation
- Hero section with overlapping images
- Responsive grid layout
- Smooth scroll navigation

## Security Considerations

- Configure firewall rules
- Set up SSL certificates (Let's Encrypt recommended)
- Use Cloudflare Tunnel for external access
- Regular security updates

## Performance Tips

- Optimize images (WebP format recommended)
- Enable gzip compression (included in nginx.conf)
- Use a CDN for static assets
- Implement caching headers

## Support

This template is designed to work with:
- Nginx web server
- Docker containers
- Proxmox VMs and LXC containers
- Modern web browsers

For questions or customization help, refer to the nginx and Docker documentation.
