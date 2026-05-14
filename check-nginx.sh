#!/bin/bash

echo "=== Searching for all Nginx configs with crystalcards.store ==="
grep -r 'server_name.*crystalcards' /etc/nginx/

echo ""
echo "=== Listing all enabled sites ==="
ls -la /etc/nginx/sites-enabled/

echo ""
echo "=== Listing FastPanel sites ==="
ls -la /etc/nginx/fastpanel2-sites/

echo ""
echo "=== Checking default server blocks ==="
grep -r 'default_server' /etc/nginx/
