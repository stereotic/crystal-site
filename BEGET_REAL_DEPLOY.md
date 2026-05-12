# 🚀 Реальный деплой на Beget для домена crystalcards.store

## ⚠️ Важно понять
Beget - это **shared hosting**, а не VPS. У тебя НЕТ root доступа и возможности запускать Node.js приложение напрямую через PM2.

## 🎯 Два варианта решения

### Вариант 1: Статический сайт (РЕКОМЕНДУЕТСЯ для начала)
Если тебе нужен только фронтенд без серверной части.

### Вариант 2: Node.js на Beget (сложнее)
Beget поддерживает Node.js, но через их специальную систему.

---

## 📋 Вариант 1: Деплой статического сайта

### Шаг 1: Подключение по SSH к Beget

```bash
# Подключись к серверу (используй данные из панели Beget)
ssh stereotic@crystalcards.store
# Пароль: тот, что ты установил в панели Beget для SSH
```

### Шаг 2: Проверь структуру директорий

```bash
# После подключения выполни:
pwd
ls -la

# Ты должен увидеть папку:
# crystalcards.store/
# или
# public_html/
```

### Шаг 3: Перейди в папку сайта

```bash
cd crystalcards.store/public_html
# или
cd ~/crystalcards.store/public_html
```

### Шаг 4: Загрузи статические файлы

**На твоем компьютере:**

```bash
# Собери статические файлы
cd "C:\Users\Артем\Desktop\projects\BLACK-BET TEAM\Crystal site"

# Создай папку для статики
mkdir -p public/static

# Скопируй все из public в архив
tar -czf static-site.tar.gz public/
```

**Загрузи на сервер:**

```bash
scp static-site.tar.gz stereotic@crystalcards.store:~/crystalcards.store/public_html/
```

**На сервере:**

```bash
cd ~/crystalcards.store/public_html
tar -xzf static-site.tar.gz
mv public/* .
rm -rf public static-site.tar.gz
```

---

## 📋 Вариант 2: Node.js приложение на Beget

### Шаг 1: Проверь поддержку Node.js

**В панели управления Beget:**
1. Зайди в раздел "Сайты"
2. Найди crystalcards.store
3. Проверь, есть ли опция "Node.js"

Если НЕТ - нужно заказать VPS или использовать другой хостинг.

### Шаг 2: Настройка Node.js на Beget (если доступно)

**В панели Beget:**
1. Перейди в "Сайты" → crystalcards.store
2. Включи Node.js
3. Выбери версию Node.js 18 или выше
4. Укажи точку входа: `dist/src/index.js`
5. Укажи порт: `3000` (или тот, что даст Beget)

### Шаг 3: Загрузка проекта

**На твоем компьютере:**

```bash
cd "C:\Users\Артем\Desktop\projects\BLACK-BET TEAM\Crystal site"

# Создай архив проекта
tar -czf crystal-app.tar.gz \
  --exclude=node_modules \
  --exclude=dist \
  --exclude=.git \
  --exclude=*.log \
  --exclude=*.db \
  src/ \
  config/ \
  public/ \
  package.json \
  package-lock.json \
  tsconfig.json
```

**Загрузи через SFTP или SCP:**

```bash
scp crystal-app.tar.gz stereotic@crystalcards.store:~/crystalcards.store/
```

**На сервере:**

```bash
ssh stereotic@crystalcards.store

cd ~/crystalcards.store
tar -xzf crystal-app.tar.gz

# Установи зависимости
npm install

# Собери проект
npm run build

# Создай .env файл
nano .env
```

**Содержимое .env:**

```env
NODE_ENV=production
PORT=3000
DOMAIN=https://crystalcards.store

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

ENABLE_BOT_POLLING=false
```

### Шаг 4: Запуск через панель Beget

**В панели управления Beget:**
1. Перейди в настройки Node.js для сайта
2. Нажми "Перезапустить приложение"
3. Проверь логи в панели

---

## 🔍 Диагностика текущей проблемы

Давай проверим, что сейчас на сервере:

### Команды для проверки:

```bash
# Подключись к серверу
ssh stereotic@crystalcards.store

# Проверь, где ты находишься
pwd

# Посмотри структуру
ls -la

# Проверь папку сайта
ls -la ~/crystalcards.store/
ls -la ~/crystalcards.store/public_html/

# Проверь, есть ли Node.js
node --version
npm --version

# Проверь запущенные процессы
ps aux | grep node
```

---

## 🎯 Быстрое решение (если нужен только фронтенд)

Если тебе срочно нужно, чтобы хоть что-то работало:

### 1. Создай простой index.html

**На твоем компьютере:**

```bash
cd "C:\Users\Артем\Desktop\projects\BLACK-BET TEAM\Crystal site"
```

Создай файл `simple-index.html`:

```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Crystal Cards - Скоро открытие</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            color: white;
        }
        .container {
            text-align: center;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
        }
        h1 {
            font-size: 3em;
            margin-bottom: 20px;
        }
        p {
            font-size: 1.5em;
            margin-bottom: 30px;
        }
        .telegram-link {
            display: inline-block;
            padding: 15px 40px;
            background: white;
            color: #667eea;
            text-decoration: none;
            border-radius: 50px;
            font-weight: bold;
            transition: transform 0.3s;
        }
        .telegram-link:hover {
            transform: scale(1.05);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>💎 Crystal Cards</h1>
        <p>Сайт находится в разработке</p>
        <p>Свяжитесь с нами в Telegram:</p>
        <a href="https://t.me/CrystalCC_xBot" class="telegram-link">
            Открыть бота
        </a>
    </div>
</body>
</html>
```

### 2. Загрузи на сервер

```bash
scp simple-index.html stereotic@crystalcards.store:~/crystalcards.store/public_html/index.html
```

---

## 📞 Что делать дальше?

1. **Проверь панель управления Beget** - есть ли там поддержка Node.js
2. **Если Node.js НЕТ** - рассмотри варианты:
   - Заказать VPS (например, на том же Beget или другом хостинге)
   - Использовать Heroku, Railway, Render для Node.js приложения
   - Сделать статический фронтенд на Beget + API на другом сервере

3. **Если Node.js ЕСТЬ** - следуй инструкциям из Варианта 2

---

## 🆘 Нужна помощь?

Скажи мне:
1. Есть ли в панели Beget опция "Node.js"?
2. Какой у тебя тариф на Beget?
3. Можешь ли ты подключиться по SSH?

И я помогу настроить правильно!
