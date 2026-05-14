#!/bin/bash

echo "🔄 Updating Crystal Site on server..."

cd /var/www/crystal-site

echo "📥 Pulling latest code..."
git pull

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building project..."
npm run build

echo "🔄 Restarting application..."
pm2 restart crystal-site

echo "📊 Checking status..."
pm2 status

echo "✅ Update complete!"
echo ""
echo "Check logs with: pm2 logs crystal-site"
