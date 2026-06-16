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

    # Server data files may differ from the repo; don't let them block deploy.
    for data_file in files/manifest.json files/site-settings.json files/analytics.json; do
        if [ -f "$data_file" ]; then
            git update-index --skip-worktree "$data_file" 2>/dev/null || true
        fi
    done

    if ! git pull origin main; then
        echo "⚠️  Git pull failed. Attempting stash + retry..."
        git stash push -u -m "deploy-autostash $(date -Iseconds)" || true
        if ! git pull origin main; then
            echo "❌ Git pull failed. Fix conflicts manually, then re-run deploy.sh"
            echo "   Run: cd $(pwd) && git status && git pull origin main"
            exit 1
        fi
        git stash pop 2>/dev/null || echo "⚠️  Stash pop skipped (resolve manually if needed)"
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
