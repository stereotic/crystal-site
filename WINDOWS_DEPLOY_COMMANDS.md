# 🪟 Команды для деплоя с Windows (PowerShell)

## ✅ Шаг 1: Архив уже создан!

Архив `crystal-site.tar.gz` уже создан в папке проекта (133 KB).

---

## 📤 Шаг 2: Загрузка на сервер через SCP

**В PowerShell выполните:**

```powershell
# Убедитесь, что вы в папке проекта
cd "C:\Users\Артем\Desktop\projects\BLACK-BET TEAM\Crystal site"

# Загрузите архив на сервер (введите пароль когда попросит: 0AxEkgOHUR*S)
scp crystal-site.tar.gz root@62.113.111.249:/root/
```

**Пароль:** `0AxEkgOHUR*S`

---

## 🔌 Шаг 3: Подключение к серверу

```powershell
ssh root@62.113.111.249
```

**Пароль:** `0AxEkgOHUR*S`

При первом подключении напишите `yes` и нажмите Enter.

---

## 🛠️ Шаг 4: Команды на сервере (копируйте по одной)

После подключения к серверу выполняйте команды по порядку:

### 4.1 Обновление системы
```bash
apt update
```

### 4.2 Установка Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version
```

Должно показать: `v20.x.x`

### 4.3 Установка дополнительных инструментов
```bash
apt install -y build-essential python3 git
npm install -g pm2
pm2 --version
```

### 4.4 Создание директории и распаковка
```bash
mkdir -p /var/www/crystal-site
mv /root/crystal-site.tar.gz /var/www/crystal-site/
cd /var/www/crystal-site
tar -xzf crystal-site.tar.gz
ls -la
```

Вы должны увидеть папки: `src/`, `config/`, `public/` и файлы.

### 4.5 Создание .env файла
```bash
nano .env
```

**Вставьте это содержимое (Ctrl+Shift+V для вставки):**

```env
NODE_ENV=production
PORT=3000
DOMAIN=http://62.113.111.249:3000

SESSION_SECRET=7cf13e58913e3b94746c928a81e4192a8ec42905c27d910063fbdade23120242ffcc34a23a214a99a4d5dcc1c788c651c8cf72bf928d4168e21ca960e6525e7a

SMTP_USER=crystalcards89@gmail.com
SMTP_PASS=zvjszyktcpgulbg

USER_BOT_TOKEN=8184664856:AAGzpVyvWIKuBuc8OFZE1dl1GAzd__ohBbM
ADMIN_BOT_TOKEN=8775943790:AAEXqUa8-kResPhhzCwMzbogasmABwITeKs
SUPPORT_BOT_TOKEN=8779502933:AAFeyz16cBON5OQ1qfmGaTHRbbgaWe2vQns
CONTROL_BOT_TOKEN=8779502933:AAFeyz16cBON5OQ1qfmGaTHRbbgaWe2vQns

ADMIN_IDS=6383039210
BOT_USERNAME=CrystalCC_xBot
WEBHOOK_SECRET=your_webhook_secret_key_here
CONTROL_CHAT_ID=-5236298947

ENABLE_BOT_POLLING=true
```

**Сохранение:**
- Нажмите `Ctrl + O` (сохранить)
- Нажмите `Enter`
- Нажмите `Ctrl + X` (выйти)

### 4.6 Установка зависимостей (займет 2-5 минут)
```bash
npm install
```

Дождитесь завершения. Если будут ошибки с bcrypt:
```bash
npm rebuild bcrypt --build-from-source
```

### 4.7 Сборка проекта
```bash
npm run build
ls -la dist/
```

Должна появиться папка `dist/` с файлами.

### 4.8 Создание конфигурации PM2
```bash
nano ecosystem.config.js
```

**Вставьте:**

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

Сохраните: `Ctrl + O`, `Enter`, `Ctrl + X`

### 4.9 Создание папки для логов
```bash
mkdir -p logs
```

### 4.10 Запуск через PM2
```bash
pm2 start ecosystem.config.js
pm2 status
```

Должно показать статус `online`.

### 4.11 Просмотр логов
```bash
pm2 logs crystal-site --lines 50
```

Нажмите `Ctrl + C` чтобы выйти из логов.

### 4.12 Настройка автозапуска
```bash
pm2 save
pm2 startup
```

PM2 выдаст команду - **скопируйте и выполните её**.

### 4.13 Открытие порта в firewall (если нужно)
```bash
# Проверьте firewall
ufw status

# Если активен, откройте порт
ufw allow 3000/tcp
```

---

## 🌐 Шаг 5: Проверка работы

### На сервере:
```bash
curl http://localhost:3000/health
```

Должен вернуть: `{"status":"ok","timestamp":"..."}`

### На вашем компьютере:
Откройте браузер и перейдите:
```
http://62.113.111.249:3000
```

Вы должны увидеть сайт!

---

## 🤖 Шаг 6: Настройка Telegram бота (опционально)

Если хотите использовать webhook вместо polling:

### На вашем компьютере (PowerShell):
```powershell
# Установите webhook
curl -X POST "https://api.telegram.org/bot8184664856:AAGzpVyvWIKuBuc8OFZE1dl1GAzd__ohBbM/setWebhook" -d "url=http://62.113.111.249:3000/webhook/telegram-bot"

# Проверьте webhook
curl "https://api.telegram.org/bot8184664856:AAGzpVyvWIKuBuc8OFZE1dl1GAzd__ohBbM/getWebhookInfo"
```

Затем на сервере измените .env:
```bash
nano .env
# Измените: ENABLE_BOT_POLLING=false
# Сохраните: Ctrl+O, Enter, Ctrl+X

pm2 restart crystal-site
```

---

## 📋 Полезные команды

### Управление приложением:
```bash
pm2 status                    # Статус
pm2 restart crystal-site      # Перезапуск
pm2 stop crystal-site         # Остановка
pm2 logs crystal-site         # Логи в реальном времени
pm2 logs crystal-site --lines 100  # Последние 100 строк
pm2 monit                     # Мониторинг CPU/RAM
```

### Проверка работы:
```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/wallets
netstat -tulpn | grep 3000
```

### Просмотр логов:
```bash
pm2 logs crystal-site
tail -f logs/pm2-combined.log
tail -f logs/pm2-error.log
```

### Резервное копирование БД:
```bash
cd /var/www/crystal-site
cp crystal.db crystal.db.backup-$(date +%Y%m%d)
cp sessions.db sessions.db.backup-$(date +%Y%m%d)
```

---

## 🔄 Обновление проекта в будущем

### На вашем компьютере:
```powershell
# 1. Перейдите в папку проекта
cd "C:\Users\Артем\Desktop\projects\BLACK-BET TEAM\Crystal site"

# 2. Создайте новый архив
tar -czf crystal-site.tar.gz --exclude=node_modules --exclude=dist --exclude=.git --exclude=*.log --exclude=sessions.db --exclude=crystal.db src/ config/ public/ package.json package-lock.json tsconfig.json .env

# 3. Загрузите на сервер
scp crystal-site.tar.gz root@62.113.111.249:/root/
```

### На сервере:
```bash
# 1. Подключитесь
ssh root@62.113.111.249

# 2. Остановите приложение
pm2 stop crystal-site

# 3. Сделайте резервную копию
cd /var/www/crystal-site
cp crystal.db crystal.db.backup-$(date +%Y%m%d)
tar -czf backup-$(date +%Y%m%d).tar.gz src/ config/ public/ dist/

# 4. Распакуйте новый код
mv /root/crystal-site.tar.gz .
tar -xzf crystal-site.tar.gz

# 5. Установите зависимости (если изменились)
npm install

# 6. Соберите проект
npm run build

# 7. Запустите
pm2 restart crystal-site

# 8. Проверьте логи
pm2 logs crystal-site --lines 50
```

---

## ❌ Решение проблем

### Проблема: "Permission denied" при SCP
```powershell
# Используйте полный путь
scp -v crystal-site.tar.gz root@62.113.111.249:/root/
```

### Проблема: Порт 3000 занят
```bash
# Найдите процесс
lsof -i :3000
# Или
netstat -tulpn | grep 3000

# Убейте процесс
kill -9 <PID>
```

### Проблема: Ошибка с bcrypt
```bash
cd /var/www/crystal-site
npm rebuild bcrypt --build-from-source
npm run build
pm2 restart crystal-site
```

### Проблема: PM2 показывает "errored"
```bash
# Посмотрите логи ошибок
pm2 logs crystal-site --err

# Проверьте .env файл
cat .env

# Попробуйте запустить напрямую для диагностики
cd /var/www/crystal-site
NODE_ENV=production node dist/src/index.js
```

### Проблема: Сайт не открывается в браузере
```bash
# Проверьте, что процесс запущен
pm2 status

# Проверьте, что порт слушается
netstat -tulpn | grep 3000

# Проверьте firewall
ufw status

# Откройте порт если нужно
ufw allow 3000/tcp
```

### Проблема: База данных не создается
```bash
cd /var/www/crystal-site

# Проверьте права
ls -la *.db

# Дайте права на запись
chmod 755 .

# Проверьте логи
pm2 logs crystal-site --lines 100
```

---

## ✅ Чеклист после деплоя

- [ ] Архив создан и загружен на сервер
- [ ] Node.js 20 установлен (`node --version`)
- [ ] PM2 установлен (`pm2 --version`)
- [ ] Проект распакован в `/var/www/crystal-site`
- [ ] .env файл создан с правильными настройками
- [ ] Зависимости установлены (`npm install`)
- [ ] Проект собран (`npm run build`)
- [ ] PM2 запущен и показывает `online`
- [ ] Автозапуск настроен (`pm2 startup`)
- [ ] Сайт открывается: `http://62.113.111.249:3000`
- [ ] API работает: `/api/wallets`, `/health`
- [ ] Telegram бот отвечает на `/start`
- [ ] Логи не показывают ошибок

---

## 🎉 Готово!

Ваш сайт работает на сервере!

**URL:** http://62.113.111.249:3000

Если возникнут проблемы - смотрите логи:
```bash
pm2 logs crystal-site --lines 200
```
