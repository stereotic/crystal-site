#!/bin/bash
# Quick reconnect and continue deployment

echo "Reconnecting to server..."
echo "Run these commands:"

cat << 'EOF'

# Reconnect to server
ssh root@170.168.103.10

# Then run:
cd /var/www/crystalcards

# Check if files extracted
ls -la

# Install dependencies (if not finished)
npm install --production

# Install PM2 if not installed
npm install -g pm2

# Create .env file
cat > .env << 'ENVEOF'
NODE_ENV=production
PORT=3000
SESSION_SECRET=crystal-secret-key-2024
DOMAIN=https://crystalcards.store
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CONTROL_BOT_TOKEN=your-control-bot-token
TELEGRAM_CONTROL_CHAT_ID=your-chat-id
ENVEOF

# Start application
pm2 start dist/index.js --name crystal-cards
pm2 save
pm2 startup

# Check status
pm2 status

# Install and configure Nginx
apt-get update
apt-get install -y nginx

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

ln -sf /etc/nginx/sites-available/crystalcards /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# Install SSL
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d crystalcards.store -d www.crystalcards.store --non-interactive --agree-tos --email admin@crystalcards.store

echo "✅ Done! Site: https://crystalcards.store"

EOF
