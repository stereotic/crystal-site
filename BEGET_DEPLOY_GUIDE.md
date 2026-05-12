# 🚀 Полная инструкция по деплою Crystal Cards на сервер Beget

## 📋 Содержание
1. [Подготовка локального проекта](#1-подготовка-локального-проекта)
2. [Подключение к серверу](#2-подключение-к-серверу)
3. [Установка необходимого ПО на сервере](#3-установка-необходимого-по-на-сервере)
4. [Загрузка проекта на сервер](#4-загрузка-проекта-на-сервер)
5. [Настройка окружения](#5-настройка-окружения)
6. [Сборка и запуск проекта](#6-сборка-и-запуск-проекта)
7. [Настройка автозапуска (PM2)](#7-настройка-автозапуска-pm2)
8. [Настройка Nginx (если нужен)](#8-настройка-nginx-если-нужен)
9. [Настройка Telegram ботов](#9-настройка-telegram-ботов)
10. [Проверка работы](#10-проверка-работы)
11. [Решение проблем](#11-решение-проблем)

---

## 1. Подготовка локального проекта

### Шаг 1.1: Проверка работы локально
Перед деплоем убедитесь, что проект работает на вашем компьютере:

```bash
# Установите зависимости (если еще не установлены)
npm install

# Соберите проект
npm run build

# Запустите
npm start
```

Откройте браузер и проверьте `http://localhost:3000` - сайт должен работать.

### Шаг 1.2: Создание архива проекта
Создадим архив проекта для загрузки на сервер:

```bash
# В корне проекта выполните:
tar -czf crystal-site.tar.gz \
  --exclude=node_modules \
  --exclude=dist \
  --exclude=.git \
  --exclude=*.log \
  --exclude=sessions.db \
  --exclude=crystal.db \
  src/ \
  config/ \
  public/ \
  package.json \
  package-lock.json \
  tsconfig.json \
  .env
```

**Важно:** Мы НЕ включаем `node_modules` и `dist` - они будут созданы на сервере.

---

## 2. Подключение к серверу

### Шаг 2.1: Подключение через SSH

**Ваши данные:**
- IP: `62.113.111.249`
- Пользователь: `root`
- Пароль: `0AxEkgOHUR*S`

**Подключение:**

**Для Windows (PowerShell или CMD):**
```bash
ssh root@62.113.111.249
```

**Для Windows (если нет SSH):**
Скачайте и установите [PuTTY](https://www.putty.org/):
1. Откройте PuTTY
2. В поле "Host Name" введите: `62.113.111.249`
3. Port: `22`
4. Connection type: `SSH`
5. Нажмите "Open"
6. Введите логин: `root`
7. Введите пароль: `0AxEkgOHUR*S`

При первом подключении появится предупреждение о ключе - нажмите "Yes" или введите "yes".

### Шаг 2.2: Проверка подключения
После успешного подключения вы увидите приглашение командной строки:
```
root@server:~#
```

Проверьте систему:
```bash
# Узнайте версию ОС
cat /etc/os-release

# Проверьте доступное место
df -h

# Проверьте оперативную память
free -h
```

---

## 3. Установка необходимого ПО на сервере

### Шаг 3.1: Обновление системы
```bash
# Обновите список пакетов
apt update

# Обновите установленные пакеты (опционально)
apt upgrade -y
```

### Шаг 3.2: Установка Node.js 18+

**Проверьте, установлен ли Node.js:**
```bash
node --version
```

Если версия меньше 18 или Node.js не установлен:

```bash
# Установите Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Проверьте установку
node --version  # Должно быть v20.x.x
npm --version   # Должно быть 10.x.x
```

### Шаг 3.3: Установка дополнительных инструментов
```bash
# Установите необходимые инструменты
apt install -y build-essential python3 git

# Установите PM2 (менеджер процессов для Node.js)
npm install -g pm2

# Проверьте установку PM2
pm2 --version
```

### Шаг 3.4: Создание директории для проекта
```bash
# Создайте директорию для проекта
mkdir -p /var/www/crystal-site
cd /var/www/crystal-site

# Проверьте текущую директорию
pwd  # Должно быть: /var/www/crystal-site
```

---

## 4. Загрузка проекта на сервер

### Способ 1: Через SCP (рекомендуется)

**На вашем компьютере (в папке проекта):**

**Windows PowerShell:**
```powershell
# Перейдите в папку проекта
cd "C:\Users\Артем\Desktop\projects\BLACK-BET TEAM\Crystal site"

# Загрузите архив на сервер
scp crystal-site.tar.gz root@62.113.111.249:/var/www/crystal-site/
```

**Если используете PuTTY, используйте PSCP:**
```cmd
# Скачайте pscp.exe с сайта PuTTY
# Затем выполните:
pscp.exe crystal-site.tar.gz root@62.113.111.249:/var/www/crystal-site/
```

### Способ 2: Через Git (альтернатива)

**На сервере:**
```bash
cd /var/www/crystal-site

# Если у вас есть Git репозиторий
git clone <ваш-репозиторий-url> .

# Или загрузите через wget (если файл доступен по URL)
# wget https://your-url.com/crystal-site.tar.gz
```

### Шаг 4.1: Распаковка архива

**На сервере:**
```bash
cd /var/www/crystal-site

# Распакуйте архив
tar -xzf crystal-site.tar.gz

# Проверьте содержимое
ls -la

# Вы должны увидеть:
# src/
# config/
# public/
# package.json
# tsconfig.json
# .env
```

---

## 5. Настройка окружения

### Шаг 5.1: Создание/редактирование .env файла

```bash
cd /var/www/crystal-site

# Создайте или отредактируйте .env файл
nano .env
```

**Содержимое .env файла для продакшена:**

```env
# Основные настройки
NODE_ENV=production
PORT=3000
DOMAIN=http://62.113.111.249:3000

# Сессии (используйте тот же секрет или сгенерируйте новый)
SESSION_SECRET=7cf13e58913e3b94746c928a81e4192a8ec42905c27d910063fbdade23120242ffcc34a23a214a99a4d5dcc1c788c651c8cf72bf928d4168e21ca960e6525e7a

# Email (ваши текущие данные)
SMTP_USER=crystalcards89@gmail.com
SMTP_PASS=zvjszyktcpgulbg

# Telegram боты (ваши токены)
USER_BOT_TOKEN=8184664856:AAGzpVyvWIKuBuc8OFZE1dl1GAzd__ohBbM
ADMIN_BOT_TOKEN=8775943790:AAEXqUa8-kResPhhzCwMzbogasmABwITeKs
SUPPORT_BOT_TOKEN=8779502933:AAFeyz16cBON5OQ1qfmGaTHRbbgaWe2vQns
CONTROL_BOT_TOKEN=8779502933:AAFeyz16cBON5OQ1qfmGaTHRbbgaWe2vQns

# Telegram настройки
ADMIN_IDS=6383039210
BOT_USERNAME=CrystalCC_xBot
WEBHOOK_SECRET=your_webhook_secret_key_here
CONTROL_CHAT_ID=-5236298947

# Режим работы ботов (для сервера используем webhook или отключаем)
ENABLE_BOT_POLLING=false
```

**Сохранение в nano:**
- Нажмите `Ctrl + O` (сохранить)
- Нажмите `Enter` (подтвердить имя файла)
- Нажмите `Ctrl + X` (выйти)

### Шаг 5.2: Проверка .env файла
```bash
# Проверьте содержимое
cat .env

# Убедитесь, что все переменные на месте
```

---

## 6. Сборка и запуск проекта

### Шаг 6.1: Установка зависимостей

```bash
cd /var/www/crystal-site

# Установите зависимости (это займет 2-5 минут)
npm install

# Если возникают ошибки с bcrypt, выполните:
npm rebuild bcrypt --build-from-source
```

**Важно:** Процесс установки может занять время. Дождитесь завершения.

### Шаг 6.2: Сборка проекта

```bash
# Соберите TypeScript в JavaScript
npm run build

# Проверьте, что создалась папка dist
ls -la dist/

# Вы должны увидеть:
# dist/src/
# dist/config/
```

### Шаг 6.3: Проверка базы данных

```bash
# Проверьте, что база данных будет создана
ls -la *.db

# Если нет файлов .db - это нормально, они создадутся при первом запуске
```

### Шаг 6.4: Первый запуск (тестовый)

```bash
# Запустите проект напрямую для проверки
NODE_ENV=production npm start
```

**Что должно произойти:**
- Вы увидите логи запуска
- Сообщение: `🚀 Server started on port 3000`
- Сообщение: `📍 Environment: production`

**Проверка:**
Откройте новое окно терминала (не закрывая текущее) и выполните:
```bash
curl http://localhost:3000/health
```

Должен вернуться ответ: `{"status":"ok","timestamp":"..."}`

**Остановка тестового запуска:**
Нажмите `Ctrl + C` в терминале, где запущен сервер.

---

## 7. Настройка автозапуска (PM2)

### Шаг 7.1: Создание конфигурации PM2

```bash
cd /var/www/crystal-site

# Создайте файл конфигурации PM2
nano ecosystem.config.js
```

**Содержимое ecosystem.config.js:**

```javascript
module.exports = {
  apps: [{
    name: 'crystal-site',
    script: './dist/src/index.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
};
```

Сохраните файл (`Ctrl + O`, `Enter`, `Ctrl + X`).

### Шаг 7.2: Создание папки для логов

```bash
mkdir -p logs
```

### Шаг 7.3: Запуск через PM2

```bash
# Запустите приложение через PM2
pm2 start ecosystem.config.js

# Проверьте статус
pm2 status

# Вы должны увидеть:
# ┌─────┬──────────────┬─────────┬─────────┬─────────┬──────────┐
# │ id  │ name         │ status  │ restart │ uptime  │ cpu      │
# ├─────┼──────────────┼─────────┼─────────┼─────────┼──────────┤
# │ 0   │ crystal-site │ online  │ 0       │ 0s      │ 0%       │
# └─────┴──────────────┴─────────┴─────────┴─────────┴──────────┘

# Посмотрите логи
pm2 logs crystal-site --lines 50
```

### Шаг 7.4: Настройка автозапуска при перезагрузке сервера

```bash
# Сохраните текущий список процессов PM2
pm2 save

# Настройте автозапуск PM2 при загрузке системы
pm2 startup

# PM2 выдаст команду, которую нужно выполнить
# Скопируйте и выполните эту команду (она будет выглядеть примерно так):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root
```

### Шаг 7.5: Полезные команды PM2

```bash
# Перезапустить приложение
pm2 restart crystal-site

# Остановить приложение
pm2 stop crystal-site

# Удалить из PM2
pm2 delete crystal-site

# Посмотреть логи в реальном времени
pm2 logs crystal-site

# Посмотреть информацию о процессе
pm2 info crystal-site

# Очистить логи
pm2 flush

# Мониторинг в реальном времени
pm2 monit
```

---

## 8. Настройка Nginx (если нужен)

Если вы хотите использовать доменное имя или порт 80/443 вместо 3000:

### Шаг 8.1: Установка Nginx

```bash
# Установите Nginx
apt install -y nginx

# Проверьте статус
systemctl status nginx
```

### Шаг 8.2: Создание конфигурации

```bash
# Создайте конфигурацию для сайта
nano /etc/nginx/sites-available/crystal-site
```

**Содержимое конфигурации:**

```nginx
server {
    listen 80;
    server_name 62.113.111.249;

    # Логи
    access_log /var/log/nginx/crystal-site-access.log;
    error_log /var/log/nginx/crystal-site-error.log;

    # Проксирование на Node.js приложение
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

    # Статические файлы (опционально, для оптимизации)
    location /uploads {
        alias /var/www/crystal-site/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

Сохраните файл.

### Шаг 8.3: Активация конфигурации

```bash
# Создайте символическую ссылку
ln -s /etc/nginx/sites-available/crystal-site /etc/nginx/sites-enabled/

# Проверьте конфигурацию на ошибки
nginx -t

# Если все ОК, перезапустите Nginx
systemctl restart nginx

# Проверьте статус
systemctl status nginx
```

### Шаг 8.4: Обновление .env для Nginx

Если используете Nginx, обновите DOMAIN в .env:

```bash
nano .env
```

Измените:
```env
DOMAIN=http://62.113.111.249
```

Перезапустите приложение:
```bash
pm2 restart crystal-site
```

---

## 9. Настройка Telegram ботов

### Шаг 9.1: Настройка Webhook (рекомендуется для продакшена)

**Важно:** В продакшене лучше использовать webhook вместо polling.

**Установите webhook для ботов:**

```bash
# Для основного бота
curl -X POST "https://api.telegram.org/bot8184664856:AAGzpVyvWIKuBuc8OFZE1dl1GAzd__ohBbM/setWebhook" \
  -d "url=http://62.113.111.249:3000/webhook/telegram-bot"

# Проверьте webhook
curl "https://api.telegram.org/bot8184664856:AAGzpVyvWIKuBuc8OFZE1dl1GAzd__ohBbM/getWebhookInfo"
```

**Если используете Nginx на порту 80:**
```bash
curl -X POST "https://api.telegram.org/bot8184664856:AAGzpVyvWIKuBuc8OFZE1dl1GAzd__ohBbM/setWebhook" \
  -d "url=http://62.113.111.249/webhook/telegram-bot"
```

### Шаг 9.2: Или используйте Polling (проще, но менее эффективно)

Если хотите использовать polling (как на локалке):

```bash
nano .env
```

Измените:
```env
ENABLE_BOT_POLLING=true
```

Перезапустите:
```bash
pm2 restart crystal-site
```

---

## 10. Проверка работы

### Шаг 10.1: Проверка через curl

```bash
# Проверьте health endpoint
curl http://localhost:3000/health

# Проверьте главную страницу
curl http://localhost:3000/

# Проверьте API
curl http://localhost:3000/api/wallets
```

### Шаг 10.2: Проверка через браузер

**На вашем компьютере:**

Откройте браузер и перейдите:
- `http://62.113.111.249:3000` (если без Nginx)
- `http://62.113.111.249` (если с Nginx)

Вы должны увидеть главную страницу сайта.

### Шаг 10.3: Проверка логов

```bash
# Логи PM2
pm2 logs crystal-site --lines 100

# Логи приложения
tail -f logs/pm2-combined.log

# Логи Nginx (если используется)
tail -f /var/log/nginx/crystal-site-access.log
tail -f /var/log/nginx/crystal-site-error.log
```

### Шаг 10.4: Проверка базы данных

```bash
cd /var/www/crystal-site

# Проверьте, что создались файлы БД
ls -lh *.db

# Вы должны увидеть:
# crystal.db
# sessions.db
```

### Шаг 10.5: Проверка Telegram бота

1. Откройте Telegram
2. Найдите вашего бота: `@CrystalCC_xBot`
3. Отправьте команду `/start`
4. Бот должен ответить

---

## 11. Решение проблем

### Проблема 1: Порт 3000 уже занят

```bash
# Найдите процесс, использующий порт 3000
lsof -i :3000

# Или
netstat -tulpn | grep 3000

# Убейте процесс (замените PID на реальный)
kill -9 <PID>
```

### Проблема 2: Ошибка "Cannot find module"

```bash
cd /var/www/crystal-site

# Переустановите зависимости
rm -rf node_modules package-lock.json
npm install

# Пересоберите проект
npm run build

# Перезапустите
pm2 restart crystal-site
```

### Проблема 3: Ошибка с bcrypt

```bash
# Пересоберите bcrypt
npm rebuild bcrypt --build-from-source

# Или переустановите
npm uninstall bcrypt
npm install bcrypt

# Пересоберите проект
npm run build
pm2 restart crystal-site
```

### Проблема 4: База данных не создается

```bash
cd /var/www/crystal-site

# Проверьте права доступа
ls -la

# Дайте права на запись
chmod 755 .
chmod 644 *.db 2>/dev/null || true

# Проверьте логи
pm2 logs crystal-site --lines 100
```

### Проблема 5: Telegram бот не отвечает

**Если используете webhook:**
```bash
# Проверьте webhook
curl "https://api.telegram.org/bot8184664856:AAGzpVyvWIKuBuc8OFZE1dl1GAzd__ohBbM/getWebhookInfo"

# Удалите webhook (если нужно)
curl -X POST "https://api.telegram.org/bot8184664856:AAGzpVyvWIKuBuc8OFZE1dl1GAzd__ohBbM/deleteWebhook"

# Установите заново
curl -X POST "https://api.telegram.org/bot8184664856:AAGzpVyvWIKuBuc8OFZE1dl1GAzd__ohBbM/setWebhook" \
  -d "url=http://62.113.111.249:3000/webhook/telegram-bot"
```

**Если используете polling:**
```bash
# Убедитесь, что в .env установлено
# ENABLE_BOT_POLLING=true

# Проверьте логи
pm2 logs crystal-site | grep -i telegram
```

### Проблема 6: Сайт не открывается в браузере

```bash
# Проверьте, запущен ли процесс
pm2 status

# Проверьте, слушает ли порт
netstat -tulpn | grep 3000

# Проверьте firewall
ufw status

# Если firewall включен, откройте порт
ufw allow 3000/tcp
ufw allow 80/tcp
ufw allow 443/tcp
```

### Проблема 7: Недостаточно памяти

```bash
# Проверьте использование памяти
free -h

# Если мало памяти, создайте swap
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# Сделайте swap постоянным
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### Проблема 8: Ошибки в логах

```bash
# Посмотрите подробные логи
pm2 logs crystal-site --lines 200

# Посмотрите ошибки
pm2 logs crystal-site --err

# Включите debug режим
nano .env
# Добавьте: DEBUG=*

pm2 restart crystal-site
pm2 logs crystal-site
```

---

## 📝 Быстрая шпаргалка команд

### Подключение к серверу
```bash
ssh root@62.113.111.249
```

### Управление приложением
```bash
pm2 status                    # Статус
pm2 restart crystal-site      # Перезапуск
pm2 stop crystal-site         # Остановка
pm2 logs crystal-site         # Логи
pm2 monit                     # Мониторинг
```

### Обновление кода
```bash
cd /var/www/crystal-site
git pull                      # Если используете Git
npm install                   # Установка новых зависимостей
npm run build                 # Сборка
pm2 restart crystal-site      # Перезапуск
```

### Проверка работы
```bash
curl http://localhost:3000/health
pm2 logs crystal-site --lines 50
```

### Резервное копирование БД
```bash
cd /var/www/crystal-site
cp crystal.db crystal.db.backup-$(date +%Y%m%d-%H%M%S)
cp sessions.db sessions.db.backup-$(date +%Y%m%d-%H%M%S)
```

---

## 🎯 Финальная проверка

После завершения всех шагов проверьте:

- [ ] Сервер доступен по SSH
- [ ] Node.js установлен (версия 18+)
- [ ] PM2 установлен и настроен
- [ ] Проект собран (`dist/` папка существует)
- [ ] PM2 показывает статус "online"
- [ ] Сайт открывается в браузере
- [ ] API endpoints отвечают
- [ ] Telegram бот отвечает на команды
- [ ] База данных создана и работает
- [ ] Логи не показывают критических ошибок

---

## 🆘 Поддержка

Если возникли проблемы:

1. Проверьте логи: `pm2 logs crystal-site --lines 200`
2. Проверьте статус: `pm2 status`
3. Проверьте порты: `netstat -tulpn | grep 3000`
4. Проверьте .env файл: `cat .env`
5. Проверьте права доступа: `ls -la /var/www/crystal-site`

---

## 🔄 Обновление проекта в будущем

Когда нужно обновить код:

```bash
# 1. Подключитесь к серверу
ssh root@62.113.111.249

# 2. Перейдите в папку проекта
cd /var/www/crystal-site

# 3. Сделайте резервную копию БД
cp crystal.db crystal.db.backup-$(date +%Y%m%d)

# 4. Загрузите новый код (через Git или SCP)
git pull
# или загрузите новый архив и распакуйте

# 5. Установите зависимости (если изменились)
npm install

# 6. Соберите проект
npm run build

# 7. Перезапустите
pm2 restart crystal-site

# 8. Проверьте логи
pm2 logs crystal-site --lines 50
```

---

**Готово! Ваш сайт должен работать на сервере так же, как на локалке! 🎉**
