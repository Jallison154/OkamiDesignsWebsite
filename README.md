# Okami Designs Website

A modern, responsive "Coming Soon" splash page for Okami Designs with brand colors and professional typography.

## Current Status

**Website is under construction** - Displaying a beautiful splash page with the Okami Designs logo.

## Features

- **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices
- **Modern Typography**: Uses Orbitron (headings) and JetBrains Mono (monospace) fonts
- **Smooth Animations**: Floating logo, fade-in effects, and shimmer animations
- **Brand Colors**: Consistent use of Okami Design color palette
- **SEO Optimized**: Proper meta tags and semantic HTML structure
- **Performance Optimized**: Minimal assets and efficient loading
- **Docker Ready**: Easy deployment with Docker Compose
- **Cloudflare Compatible**: Works with Cloudflare proxy and SSL

## Quick Start with Docker

### Automated Installation
1. **Run the installation script**:
   ```bash
   chmod +x install-okami-designs-github.sh
   sudo ./install-okami-designs-github.sh
   ```

### Manual Installation
1. **Clone or download the files** to your server
2. **Run with Docker Compose**:
   ```bash
   docker-compose up -d
   ```
3. **Access your website** at `http://your-server-ip` or `https://okamidesigns.com`

## Manual Nginx Setup

1. **Install Nginx** on your Proxmox VM/LXC:
   ```bash
   sudo apt update
   sudo apt install nginx
   ```

2. **Create website directory**:
   ```bash
   sudo mkdir -p /var/www/okami-designs
   ```

3. **Copy files**:
   ```bash
   sudo cp -r . /var/www/okami-designs/
   sudo chown -R www-data:www-data /var/www/okami-designs
   ```

4. **Configure Nginx**:
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/okami-designs
   sudo ln -s /etc/nginx/sites-available/okami-designs /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

## File Structure

```
okami-designs/
├── index.html                    # Main splash page HTML
├── index-full-website.html      # Full website (disabled, for future use)
├── Splash/                       # Splash page assets
│   ├── HTML.txt                 # Splash page template
│   └── Okami_Designs_FullW.png  # Logo image
├── styles.css                    # CSS styles (not used by splash page)
├── script.js                     # JavaScript (not used by splash page)
├── nginx.conf                    # Nginx configuration
├── docker-compose.yml            # Docker setup
├── install-okami-designs.sh     # Local installation script
├── install-okami-designs-github.sh # GitHub installation script
├── PROXMOX_INSTALLATION_GUIDE.md # Proxmox setup guide
└── README.md                     # This file
```

## Adding Images

Create an `images` folder and add your ceramic vase photos:

- **vase-1.jpg**: Square format, single round vase (400x400px recommended)
- **vase-2.jpg**: Vertical format, hands holding tall vase (300x400px recommended)
- **vase-3.jpg**: Horizontal format, collection of vases (600x300px recommended)

**Recommended formats**: WebP for better performance, JPG as fallback

## Customization

### Colors
The main color scheme uses:
- Background: `#333333` (dark grey)
- Text: `#e6e6e6` (light grey/white)
- Button: `#FF6A2D` (orange)
- Button Hover: White background with orange text

### Fonts
- Headers: Orbitron (monospace, bold)
- Status badge: JetBrains Mono (monospace)
- Body text: Inter (sans-serif)

### Layout
The current splash page features:
- Centered logo with floating animation
- "Website Under Construction" message
- "Coming Soon" status badge with shimmer effect
- Modern dark theme with orange accents
- Responsive and mobile-friendly

## Security Considerations

- Configure UDM Pro firewall rules (ports 80 and 443)
- Set up SSL certificates (Let's Encrypt or Cloudflare SSL)
- Use Cloudflare proxy for external access
- Regular security updates
- Enable Cloudflare security features

## Performance Tips

- Optimize images (WebP format recommended)
- Enable gzip compression (included in nginx.conf)
- Use Cloudflare CDN for static assets
- Implement caching headers
- Enable Cloudflare caching features

## Support

This website is designed to work with:
- Nginx web server
- Docker containers
- Proxmox VMs and LXC containers
- UDM Pro firewall
- Cloudflare proxy
- Modern web browsers

## Installation Scripts

- **`install-okami-designs-github.sh`**: Downloads from GitHub repository
- **`install-okami-designs.sh`**: Creates website files locally
- **`PROXMOX_INSTALLATION_GUIDE.md`**: Detailed Proxmox setup instructions

## Troubleshooting

### Common Issues
1. **Website not accessible**: Check UDM Pro firewall rules
2. **HTTPS not working**: Verify Cloudflare SSL settings
3. **Images not loading**: Add images to `/opt/okami-designs/images/`
4. **Container not starting**: Check Docker logs with `docker logs okami-designs-website`

### Useful Commands
```bash
# View website logs
docker logs okami-designs-website

# Restart website
docker-compose restart

# Check container status
docker ps | grep okami-designs
```

For questions or customization help, refer to the nginx and Docker documentation.
