#!/bin/bash

# Okami Designs - Quick Deploy Script
# This script pulls the latest changes and restarts the website

echo "🚀 Deploying Okami Designs Website..."

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found. Please run this script from the website directory."
    exit 1
fi

# Pull latest changes (if using git)
if [ -d ".git" ]; then
    echo "📥 Pulling latest changes from Git..."
    git pull origin main
    if [ $? -ne 0 ]; then
        echo "⚠️  Warning: Git pull failed. Continuing with existing files..."
    fi
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
else
    echo "❌ Deployment failed. Checking logs..."
    docker logs okami-designs-website
    exit 1
fi

echo "🎉 Deployment complete!"
