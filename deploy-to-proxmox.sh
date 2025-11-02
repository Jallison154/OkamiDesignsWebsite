#!/bin/bash

# Okami Designs - Deploy to Proxmox Script
# This script copies the updated files to the Proxmox server

PROXMOX_HOST="192.168.10.50"
PROXMOX_USER="root"
PROXMOX_PATH="/opt/okami-designs"

echo "🚀 Deploying Okami Designs to Proxmox server..."

# Check if we're in the right directory
if [ ! -f "index.html" ]; then
    echo "❌ Error: index.html not found. Please run this script from the website directory."
    exit 1
fi

# Files to copy (exclude git files and this script)
echo "📦 Preparing files to copy..."

# Create a temporary list of files to exclude
EXCLUDE_FILES=".git .gitignore deploy-to-proxmox.sh README.md PROXMOX_INSTALLATION_GUIDE.md install-okami-designs.sh install-okami-designs-github.sh deploy.sh deploy-webstudio.sh"

# Copy files using rsync (preferred) or scp
if command -v rsync &> /dev/null; then
    echo "📤 Copying files using rsync..."
    rsync -avz --progress --exclude='.git' --exclude='.gitignore' \
        --exclude='deploy*.sh' --exclude='install*.sh' --exclude='*.md' \
        --exclude='node_modules' --exclude='.DS_Store' \
        ./ ${PROXMOX_USER}@${PROXMOX_HOST}:${PROXMOX_PATH}/
else
    echo "📤 Copying files using scp..."
    # Create a tarball
    tar -czf /tmp/okami-deploy.tar.gz --exclude='.git' --exclude='.gitignore' \
        --exclude='deploy*.sh' --exclude='install*.sh' --exclude='*.md' \
        --exclude='node_modules' --exclude='.DS_Store' .
    
    # Copy tarball and extract on remote
    scp /tmp/okami-deploy.tar.gz ${PROXMOX_USER}@${PROXMOX_HOST}:/tmp/
    
    # SSH and extract
    ssh ${PROXMOX_USER}@${PROXMOX_HOST} "cd ${PROXMOX_PATH} && tar -xzf /tmp/okami-deploy.tar.gz && rm /tmp/okami-deploy.tar.gz"
    
    # Clean up local tarball
    rm /tmp/okami-deploy.tar.gz
fi

if [ $? -ne 0 ]; then
    echo "❌ Error copying files to Proxmox server"
    exit 1
fi

echo "✅ Files copied successfully!"

# Restart the Docker container on Proxmox
echo "🔄 Restarting Docker container on Proxmox..."
ssh ${PROXMOX_USER}@${PROXMOX_HOST} "cd ${PROXMOX_PATH} && docker-compose down && docker-compose up -d"

if [ $? -ne 0 ]; then
    echo "❌ Error restarting Docker container"
    exit 1
fi

echo "✅ Container restarted successfully!"

# Check container status
echo "📊 Checking container status..."
ssh ${PROXMOX_USER}@${PROXMOX_HOST} "docker ps | grep okami-designs"

echo ""
echo "🎉 Deployment complete!"
echo "🌐 Website should be accessible at: http://${PROXMOX_HOST}"

