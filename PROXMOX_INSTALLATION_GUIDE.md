# Proxmox Installation Guide for Okami Designs Website

This guide will walk you through installing your Okami Designs website on Proxmox using either a VM or LXC container.

## Prerequisites

- Proxmox VE server running (version 7.0+ recommended)
- Basic knowledge of Proxmox web interface
- SSH access to your Proxmox server
- Domain name (optional, for SSL setup)

## Method 1: Using LXC Container (Recommended)

### Step 1: Create LXC Container

1. **Access Proxmox Web Interface**
   - Open your browser and navigate to `https://your-proxmox-ip:8006`
   - Login with your credentials

2. **Create New LXC Container**
   - Click "Create CT" in the top right
   - **General Tab:**
     - Container ID: `100` (or next available)
     - Hostname: `okami-designs-web`
     - Password: Set a strong password
     - Uncheck "Unprivileged container" (needed for Docker)

3. **Template Tab:**
   - Select: `ubuntu-22.04-standard_22.04-1_amd64.tar.zst`
   - Or latest Ubuntu template available

4. **Root Disk Tab:**
   - Storage: `local-lvm` (or your preferred storage)
   - Disk size: `8GB` (minimum)

5. **CPU Tab:**
   - Cores: `2` (minimum)
   - Memory: `1024MB` (1GB minimum)

6. **Network Tab:**
   - Bridge: `vmbr0` (or your main bridge)
   - IPv4: `DHCP` or static IP
   - IPv6: `None` (unless needed)

7. **DNS Tab:**
   - DNS servers: `8.8.8.8, 1.1.1.1`

8. **Confirm and Create**
   - Review settings and click "Finish"
   - Wait for container creation to complete

### Step 2: Start and Access Container

1. **Start the Container**
   - Right-click on your new container → "Start"

2. **Access via Console**
   - Right-click container → "Console"
   - Login with `root` and your password

3. **Update System**
   ```bash
   apt update && apt upgrade -y
   ```

### Step 3: Install Docker

1. **Install Prerequisites**
   ```bash
   apt install -y apt-transport-https ca-certificates curl gnupg lsb-release
   ```

2. **Add Docker GPG Key**
   ```bash
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
   ```

3. **Add Docker Repository**
   ```bash
   echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
   ```

4. **Install Docker**
   ```bash
   apt update
   apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
   ```

5. **Start and Enable Docker**
   ```bash
   systemctl start docker
   systemctl enable docker
   ```

6. **Verify Installation**
   ```bash
   docker --version
   docker-compose --version
   ```

### Step 4: Deploy Website

1. **Create Website Directory**
   ```bash
   mkdir -p /opt/okami-designs
   cd /opt/okami-designs
   ```

2. **Upload Website Files**
   - Use SCP, SFTP, or copy files from your local machine:
   ```bash
   # From your local machine:
   scp -r /path/to/your/website/* root@your-container-ip:/opt/okami-designs/
   ```

3. **Set Proper Permissions**
   ```bash
   chown -R root:root /opt/okami-designs
   chmod -R 755 /opt/okami-designs
   ```

4. **Start the Website**
   ```bash
   cd /opt/okami-designs
   docker-compose up -d
   ```

5. **Verify Container is Running**
   ```bash
   docker ps
   ```

### Step 5: Configure Firewall

1. **Enable UFW (if not already enabled)**
   ```bash
   ufw enable
   ```

2. **Allow HTTP and HTTPS**
   ```bash
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw allow 22/tcp  # SSH access
   ```

3. **Check Status**
   ```bash
   ufw status
   ```

## Method 2: Using Virtual Machine

### Step 1: Create VM

1. **Create New VM**
   - Click "Create VM" in Proxmox
   - **General Tab:**
     - VM ID: `100` (or next available)
     - Name: `okami-designs-web`
     - Resource Pool: (optional)

2. **OS Tab:**
   - Use CD/DVD disc image file
   - Select: `ubuntu-22.04-server-amd64.iso`
   - Guest OS: `Linux`
   - Version: `5.x - 2.6 Kernel`

3. **System Tab:**
   - Graphics card: `Default`
   - Machine: `q35`
   - Qemu Agent: `Yes`
   - SCSI controller: `VirtIO SCSI single`

4. **Hard Disk Tab:**
   - Bus/Device: `SCSI`
   - Storage: `local-lvm`
   - Disk size: `20GB`
   - Cache: `Write back`

5. **CPU Tab:**
   - Cores: `2`
   - Type: `host`

6. **Memory Tab:**
   - Memory: `2048MB` (2GB)

7. **Network Tab:**
   - Bridge: `vmbr0`
   - Model: `VirtIO (paravirtualized)`

8. **Confirm and Create**
   - Review settings and click "Finish"

### Step 2: Install Ubuntu

1. **Start VM and Install Ubuntu**
   - Start the VM
   - Follow Ubuntu server installation
   - Enable SSH server during installation
   - Create user account

2. **After Installation**
   - SSH into the VM
   - Follow steps 3-5 from the LXC method above

## Step 6: SSL Certificate Setup (Optional but Recommended)

### Using Let's Encrypt with Certbot

1. **Install Certbot**
   ```bash
   apt install -y certbot python3-certbot-nginx
   ```

2. **Stop Docker Container Temporarily**
   ```bash
   docker-compose down
   ```

3. **Install Nginx on Host**
   ```bash
   apt install -y nginx
   ```

4. **Get SSL Certificate**
   ```bash
   certbot --nginx -d your-domain.com
   ```

5. **Update Docker Compose for SSL**
   - Edit `docker-compose.yml` to include SSL volumes
   - Restart with SSL configuration

## Step 7: Access Your Website

1. **Local Access**
   - Open browser and navigate to: `http://your-container-ip`
   - Or: `http://your-domain.com` (if configured)

2. **Verify Everything Works**
   - Check that the website loads correctly
   - Test responsive design on mobile
   - Verify all images load properly

## Step 8: Maintenance and Updates

### Regular Updates

1. **Update System**
   ```bash
   apt update && apt upgrade -y
   ```

2. **Update Docker Images**
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

3. **Clean Up Old Images**
   ```bash
   docker system prune -a
   ```

### Backup Strategy

1. **Backup Website Files**
   ```bash
   tar -czf okami-designs-backup-$(date +%Y%m%d).tar.gz /opt/okami-designs/
   ```

2. **Backup Container/VM**
   - Use Proxmox backup feature
   - Schedule regular backups

## Troubleshooting

### Common Issues

1. **Container Won't Start**
   ```bash
   # Check container logs
   docker logs okami-designs-website
   
   # Check if ports are in use
   netstat -tulpn | grep :80
   ```

2. **Permission Issues**
   ```bash
   # Fix file permissions
   chown -R root:root /opt/okami-designs
   chmod -R 755 /opt/okami-designs
   ```

3. **Network Issues**
   ```bash
   # Check if container is accessible
   curl -I http://localhost
   
   # Check firewall
   ufw status
   ```

4. **SSL Issues**
   ```bash
   # Test SSL configuration
   openssl s_client -connect your-domain.com:443
   ```

## Security Recommendations

1. **Change Default Passwords**
2. **Use SSH Keys Instead of Passwords**
3. **Enable Fail2Ban**
4. **Regular Security Updates**
5. **Use Cloudflare Tunnel for External Access**
6. **Implement Rate Limiting**

## Performance Optimization

1. **Enable Nginx Caching**
2. **Use CDN for Static Assets**
3. **Optimize Images (WebP format)**
4. **Enable Gzip Compression**
5. **Monitor Resource Usage**

## Support

If you encounter issues:

1. Check container logs: `docker logs okami-designs-website`
2. Verify network connectivity
3. Check Proxmox logs in web interface
4. Ensure all ports are properly forwarded
5. Verify DNS settings if using domain name

Your Okami Designs website should now be running successfully on Proxmox!
