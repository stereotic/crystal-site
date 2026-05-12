#!/bin/bash
# Quick fix for server deployment

echo "🔧 Fixing Crystal Cards deployment..."

cd /var/www/crystal-site

# Stop the crashing app
pm2 stop crystal-site 2>/dev/null || true
pm2 delete crystal-site 2>/dev/null || true

# The compiled files are in dist/src/ not dist/
# So we need to start from the correct path
echo "Starting application from correct path..."
pm2 start dist/src/index.js --name crystal-site

# Save PM2 configuration
pm2 save

# Check status
pm2 status

echo ""
echo "✅ Fixed! Check the logs:"
echo "pm2 logs crystal-site"
