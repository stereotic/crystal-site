# 🚀 ДЕПЛОЙ НА RENDER С POSTGRESQL

## ✅ Что я сделал:

1. ✅ Добавил поддержку PostgreSQL
2. ✅ Код теперь работает с обеими БД:
   - **Локально:** SQLite (как сейчас)
   - **На Render:** PostgreSQL (база сохраняется навсегда)
3. ✅ Настроил render.yaml с PostgreSQL

---

## 🎯 ЧТО ДЕЛАТЬ СЕЙЧАС:

### Шаг 1: Создай репозиторий на GitHub (2 минуты)

1. Открой https://github.com/new
2. Название: `crystal-site` (или любое)
3. Можно сделать **Private** (приватный)
4. Нажми **"Create repository"**

### Шаг 2: Загрузи код на GitHub (1 минута)

Открой PowerShell в папке проекта и выполни:

```bash
git init
git add .
git commit -m "Ready for Render deploy with PostgreSQL"
git branch -M main
git remote add origin https://github.com/твой-username/crystal-site.git
git push -u origin main
```

**Замени `твой-username` на свой GitHub username!**

### Шаг 3: Деплой на Render (3 минуты)

1. Открой https://render.com
2. Нажми **"Get Started"** → войди через GitHub
3. Нажми **"New +"** → **"Blueprint"**
4. Выбери свой репозиторий `crystal-site`
5. Render найдет `render.yaml` и создаст:
   - ✅ PostgreSQL базу данных
   - ✅ Web сервис
   - ✅ Автоматически свяжет их

6. **Добавь переменные окружения:**

В настройках сервиса добавь:

```
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
```

7. Нажми **"Apply"** или **"Deploy"**

### Шаг 4: Получи URL и настрой (2 минуты)

После деплоя получишь URL: `https://crystal-site.onrender.com`

**Добавь переменную DOMAIN:**
В настройках сервиса добавь:
```
DOMAIN=https://crystal-site.onrender.com
```

**Настрой Telegram webhook:**

Открой PowerShell и выполни:

```bash
curl -X POST "https://api.telegram.org/bot8184664856:AAGzpVyvWIKuBuc8OFZE1dl1GAzd__ohBbM/setWebhook" -d "url=https://crystal-site.onrender.com/webhook/telegram-bot"
```

**Проверь webhook:**

```bash
curl "https://api.telegram.org/bot8184664856:AAGzpVyvWIKuBuc8OFZE1dl1GAzd__ohBbM/getWebhookInfo"
```

---

## ✅ ГОТОВО!

Твой сайт работает на:
- 🌐 `https://crystal-site.onrender.com`
- 💾 PostgreSQL база (данные сохраняются навсегда)
- 🤖 Telegram боты работают через webhook
- 📧 Email работает

---

## 🔗 Подключение домена crystalcards.store (опционально)

В Render:
1. Settings → Custom Domain
2. Добавь `crystalcards.store`
3. Render даст CNAME запись

В панели Beget:
1. DNS настройки для crystalcards.store
2. Добавь CNAME запись от Render

---

## 💰 Стоимость

- **Web Service:** Бесплатно (с ограничениями)
- **PostgreSQL:** Бесплатно (90 дней, потом $7/мес)

Для старта хватит бесплатного!

---

## 🆘 Если что-то не работает

Скажи на каком шаге застрял, и я помогу!
