#!/bin/bash
# Upload and apply card fix to server

echo "Creating fix package..."
tar -czf cards-fix.tar.gz dist/

echo "Uploading to server..."
scp cards-fix.tar.gz root@185.233.38.107:~/

echo "Applying fix on server..."
ssh root@185.233.38.107 << 'ENDSSH'
cd ~/crystal-site
echo "Backing up current dist..."
cp -r dist dist.backup.$(date +%Y%m%d_%H%M%S)
echo "Extracting new files..."
tar -xzf ~/cards-fix.tar.gz
echo "Restarting service..."
pm2 restart crystal-site
echo "Checking status..."
pm2 list
echo "Done!"
ENDSSH

echo "Fix applied successfully!"
