# 🚀 Быстрый деплой на Railway.app (5 минут)

## Почему Railway?
- ✅ Бесплатный тариф для старта ($5 кредитов в месяц)
- ✅ Автоматический деплой из GitHub
- ✅ Поддержка Node.js из коробки
- ✅ Автоматический HTTPS
- ✅ Простая настройка переменных окружения
- ✅ Логи в реальном времени

---

## Шаг 1: Подготовка проекта (2 минуты)

### 1.1 Создай файл для Railway

В корне проекта создай файл `railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 1.2 Проверь package.json

Убедись, что в `package.json` есть:

```json
{
  "scripts": {
    "start": "node dist/src/index.js",
    "build": "tsc"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 1.3 Создай .gitignore (если нет)

```
node_modules/
dist/
*.db
*.log
.env
sessions.db
crystal.db
```

---

## Шаг 2: Загрузи на GitHub (1 минута)

```bash
# В папке проекта
git init
git add .
git commit -m "Initial commit for Railway deploy"

# Создай репозиторий на GitHub (можно приватный)
# Затем:
git remote add origin https://github.com/твой-username/crystal-site.git
git branch -M main
git push -u origin main
```

---

## Шаг 3: Деплой на Railway (2 минуты)

### 3.1 Регистрация
1. Открой https://railway.app
2. Нажми "Start a New Project"
3. Войди через GitHub

### 3.2 Создание проекта
1. Нажми "New Project"
2. Выбери "Deploy from GitHub repo"
3. Выбери свой репозиторий `crystal-site`
4. Railway автоматически определит Node.js проект

### 3.3 Настройка переменных окружения

В Railway проекте:
1. Перейди в "Variables"
2. Добавь все переменные из твоего .env:

```
NODE_ENV=production
PORT=3000

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

**ВАЖНО:** `DOMAIN` добавишь после деплоя (Railway даст тебе URL)

### 3.4 Деплой
1. Railway автоматически начнет деплой
2. Подожди 2-3 минуты
3. Получишь URL типа: `https://crystal-site-production.up.railway.app`

### 3.5 Обнови DOMAIN
1. Скопируй полученный URL
2. Добавь переменную `DOMAIN` с этим URL
3. Railway автоматически передеплоит

---

## Шаг 4: Настрой Telegram Webhook

После деплоя обнови webhook для ботов:

```bash
# Замени YOUR_RAILWAY_URL на твой URL от Railway
curl -X POST "https://api.telegram.org/bot8184664856:AAGzpVyvWIKuBuc8OFZE1dl1GAzd__ohBbM/setWebhook" \
  -d "url=https://YOUR_RAILWAY_URL/webhook/telegram-bot"

# Проверь
curl "https://api.telegram.org/bot8184664856:AAGzpVyvWIKuBuc8OFZE1dl1GAzd__ohBbM/getWebhookInfo"
```

---

## Шаг 5: Подключи свой домен (опционально)

В Railway:
1. Перейди в "Settings" → "Domains"
2. Нажми "Add Domain"
3. Введи `crystalcards.store`
4. Railway даст тебе CNAME запись
5. Добавь эту CNAME в DNS настройках домена на Beget

---

## 📊 Мониторинг

В Railway ты можешь:
- Смотреть логи в реальном времени
- Видеть использование ресурсов
- Перезапускать приложение
- Откатываться на предыдущие версии

---

## 💰 Стоимость

- **Бесплатно**: $5 кредитов в месяц (хватит на небольшой проект)
- **Hobby**: $5/месяц за проект
- **Pro**: $20/месяц

Для твоего проекта хватит бесплатного тарифа на старте.

---

## 🔄 Обновление кода

Просто пуш в GitHub:

```bash
git add .
git commit -m "Update"
git push
```

Railway автоматически задеплоит новую версию!

---

## ✅ Готово!

Твой сайт и боты работают на:
- `https://твой-проект.up.railway.app`
- Или на `https://crystalcards.store` (если подключил домен)

Боты работают через webhook, база данных SQLite работает (но для продакшена лучше PostgreSQL).
