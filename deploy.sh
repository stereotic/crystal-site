#!/bin/bash

# Deployment script for Crystal Cards
HOST="170.168.103.10"
USER="root"
PASSWORD="j96Tq4ayF0u3"
DOMAIN="crystalcards.store"
REMOTE_DIR="/var/www/crystalcards"

echo "🚀 Starting deployment to $DOMAIN..."

# Build the project
echo "📦 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"

# Create deployment package
echo "📦 Creating deployment package..."
tar -czf crystal-deploy.tar.gz \
    dist/ \
    public/ \
    node_modules/ \
    package.json \
    package-lock.json \
    database.db \
    .env 2>/dev/null || tar -czf crystal-deploy.tar.gz \
    dist/ \
    public/ \
    node_modules/ \
    package.json \
    package-lock.json \
    database.db

echo "✅ Package created!"

# Upload to server using sshpass
echo "📤 Uploading to server..."
sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no crystal-deploy.tar.gz $USER@$HOST:/tmp/

if [ $? -ne 0 ]; then
    echo "❌ Upload failed! Installing sshpass..."
    # Try alternative method without sshpass
    echo "Using alternative upload method..."
    cat crystal-deploy.tar.gz | ssh $USER@$HOST "cat > /tmp/crystal-deploy.tar.gz"
fi

echo "✅ Upload complete!"

# Deploy on server
echo "🔧 Deploying on server..."
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no $USER@$HOST << 'ENDSSH'
    # Stop existing service
    pm2 stop crystal-cards 2>/dev/null || true

    # Create directory
    mkdir -p /var/www/crystalcards
    cd /var/www/crystalcards

    # Backup old version
    if [ -d "dist" ]; then
        mv dist dist.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
    fi

    # Extract new version
    tar -xzf /tmp/crystal-deploy.tar.gz

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        npm install --production
    fi

    # Setup environment
    cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-super-secret-session-key-change-this
DOMAIN=https://crystalcards.store
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CONTROL_BOT_TOKEN=your-control-bot-token
TELEGRAM_CONTROL_CHAT_ID=your-chat-id
EOF

    # Start with PM2
    pm2 start dist/index.js --name crystal-cards --time
    pm2 save

    # Setup PM2 startup
    pm2 startup systemd -u root --hp /root

    echo "✅ Deployment complete!"
ENDSSH

echo ""
echo "✅ Deployment successful!"
echo "🌐 Your site should be available at: https://$DOMAIN"
echo ""
echo "⚠️  Next steps:"
echo "1. Configure Nginx reverse proxy"
echo "2. Setup SSL certificate (Let's Encrypt)"
echo "3. Update .env file with your Telegram bot tokens"
echo ""
