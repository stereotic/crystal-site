# 🚀 Инструкция по деплою Crystal Cards

## Шаг 1: Загрузка файлов на сервер

Архив `deploy.tar.gz` уже создан. Загрузи его на сервер одним из способов:

### Вариант A: Через WinSCP (рекомендуется для Windows)
1. Скачай WinSCP: https://winscp.net/
2. Подключись к серверу:
   - Host: `170.168.103.10`
   - User: `root`
   - Password: `j96Tq4ayF0u3`
3. Загрузи файл `deploy.tar.gz` в папку `/tmp/`

### Вариант B: Через командную строку
```bash
# Если установлен sshpass
sshpass -p 'j96Tq4ayF0u3' scp deploy.tar.gz root@170.168.103.10:/tmp/

# Или через pscp (PuTTY)
pscp -pw j96Tq4ayF0u3 deploy.tar.gz root@170.168.103.10:/tmp/
```

## Шаг 2: Подключись к серверу через SSH

```bash
ssh root@170.168.103.10
# Пароль: j96Tq4ayF0u3
```

## Шаг 3: Выполни команды на сервере

Скопируй и выполни все команды ниже:

```bash
# Установка Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Установка PM2
npm install -g pm2

# Создание директории
mkdir -p /var/www/crystalcards
cd /var/www/crystalcards

# Распаковка файлов
tar -xzf /tmp/deploy.tar.gz

# Установка зависимостей
npm install --production

# Создание .env файла
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
SESSION_SECRET=crystal-secret-key-change-this-in-production-2024
DOMAIN=https://crystalcards.store
TELEGRAM_BOT_TOKEN=your-bot-token-here
TELEGRAM_CONTROL_BOT_TOKEN=your-control-bot-token-here
TELEGRAM_CONTROL_CHAT_ID=your-chat-id-here
EOF

# Запуск приложения с PM2
pm2 stop crystal-cards 2>/dev/null || true
pm2 delete crystal-cards 2>/dev/null || true
pm2 start dist/index.js --name crystal-cards
pm2 save
pm2 startup

# Установка Nginx
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

# Настройка Nginx
cat > /etc/nginx/sites-available/crystalcards << 'EOF'
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
EOF

# Активация сайта
ln -sf /etc/nginx/sites-available/crystalcards /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# Получение SSL сертификата (замени email на свой)
certbot --nginx -d crystalcards.store -d www.crystalcards.store --non-interactive --agree-tos --email admin@crystalcards.store

echo "✅ Деплой завершен!"
echo "🌐 Сайт доступен: https://crystalcards.store"
```

## Шаг 4: Настройка Telegram ботов

После деплоя отредактируй файл `.env` на сервере:

```bash
nano /var/www/crystalcards/.env
```

Замени:
- `TELEGRAM_BOT_TOKEN` - токен основного бота
- `TELEGRAM_CONTROL_BOT_TOKEN` - токен контрольного бота
- `TELEGRAM_CONTROL_CHAT_ID` - ID чата для уведомлений

Затем перезапусти:
```bash
pm2 restart crystal-cards
```

## Проверка работы

```bash
# Проверить статус
pm2 status

# Посмотреть логи
pm2 logs crystal-cards

# Перезапустить
pm2 restart crystal-cards
```

## Обновление в будущем

1. Создай новый архив локально: `bash deploy-simple.sh`
2. Загрузи `deploy.tar.gz` на сервер в `/tmp/`
3. На сервере выполни:
```bash
cd /var/www/crystalcards
tar -xzf /tmp/deploy.tar.gz
npm install --production
pm2 restart crystal-cards
```

---

**Важно:** Убедись что DNS домена `crystalcards.store` указывает на IP `170.168.103.10`
