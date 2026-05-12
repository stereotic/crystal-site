#!/bin/bash

# Simple deployment script
echo "🚀 Deploying Crystal Cards to crystalcards.store..."

# Build project
echo "📦 Building..."
npm run build

# Create archive
echo "📦 Creating archive..."
tar -czf deploy.tar.gz dist/ public/ package.json package-lock.json database.db config/

echo "✅ Archive created: deploy.tar.gz"
echo ""
echo "📤 Now upload to server:"
echo "scp deploy.tar.gz root@170.168.103.10:/tmp/"
echo ""
echo "🔧 Then SSH and run:"
echo "ssh root@170.168.103.10"
echo ""
echo "Commands to run on server:"
cat << 'EOF'

# Install Node.js if not installed
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Create directory
mkdir -p /var/www/crystalcards
cd /var/www/crystalcards

# Extract files
tar -xzf /tmp/deploy.tar.gz

# Install dependencies
npm install --production

# Create .env file
cat > .env << 'ENVEOF'
NODE_ENV=production
PORT=3000
SESSION_SECRET=change-this-secret-key-to-something-random
DOMAIN=https://crystalcards.store
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CONTROL_BOT_TOKEN=your-control-bot-token
TELEGRAM_CONTROL_CHAT_ID=your-chat-id
ENVEOF

# Start with PM2
pm2 stop crystal-cards 2>/dev/null || true
pm2 delete crystal-cards 2>/dev/null || true
pm2 start dist/index.js --name crystal-cards
pm2 save
pm2 startup

# Install Nginx
apt-get install -y nginx certbot python3-certbot-nginx

# Configure Nginx
cat > /etc/nginx/sites-available/crystalcards << 'NGINXEOF'
server {
    listen 80;
    server_name crystalcards.store www.crystalcards.store;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXEOF

# Enable site
ln -sf /etc/nginx/sites-available/crystalcards /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# Get SSL certificate
certbot --nginx -d crystalcards.store -d www.crystalcards.store --non-interactive --agree-tos --email your-email@example.com

echo "✅ Deployment complete!"
echo "🌐 Site: https://crystalcards.store"

EOF
