#!/bin/bash

# Okami Designs - Webstudio Deployment Script
# This script deploys a Webstudio export to your server

echo "🚀 Deploying Okami Designs from Webstudio..."

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found. Please run this script from the website directory."
    exit 1
fi

# Check if webstudio export exists
if [ ! -d "webstudio-export" ]; then
    echo "⚠️  Warning: webstudio-export folder not found."
    echo "📋 Instructions:"
    echo "1. Go to your Webstudio project"
    echo "2. Click 'Export' → 'Download'"
    echo "3. Extract the ZIP file to 'webstudio-export' folder"
    echo "4. Run this script again"
    exit 1
fi

# Backup current dist folder
if [ -d "web/dist" ]; then
    echo "💾 Backing up current website..."
    mv web/dist web/dist.backup.$(date +%Y%m%d_%H%M%S)
fi

# Copy Webstudio export to dist folder
echo "📁 Copying Webstudio export..."
cp -r webstudio-export/* web/dist/

# Ensure proper permissions
chmod -R 755 web/dist/

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
    echo "⚠️  Created .env from .env.example — set ADMIN_PASSWORD_HASH before admin login."
fi

# Stop existing container
echo "🛑 Stopping existing container..."
docker-compose down

# Start the updated container
echo "🔄 Starting updated container..."
docker-compose up -d

# Check if container is running
sleep 5
if docker ps | grep -q "okami-designs-website"; then
    echo "✅ Website deployed successfully!"
    echo "🌐 Your website should be accessible at: http://$(hostname -I | awk '{print $1}')"
    echo "📊 Container status:"
    docker ps | grep okami-designs
    
    # Clean up old backups (keep last 3)
    echo "🧹 Cleaning up old backups..."
    ls -t web/dist.backup.* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
    
else
    echo "❌ Deployment failed. Checking logs..."
    docker logs okami-designs-website
    
    # Restore backup if available
    if [ -d "web/dist.backup."* ]; then
        echo "🔄 Restoring backup..."
        mv web/dist.backup.* web/dist/
        docker-compose up -d
    fi
    
    exit 1
fi

echo "🎉 Webstudio deployment complete!"
echo "💡 Next time: Just export from Webstudio and run ./deploy-webstudio.sh"
