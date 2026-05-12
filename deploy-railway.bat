@echo off
echo ========================================
echo   ДЕПЛОЙ НА RAILWAY - ПРОСТО СЛЕДУЙ ИНСТРУКЦИЯМ
echo ========================================
echo.

echo [Шаг 1/5] Проверка Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ОШИБКА: Node.js не установлен!
    echo Скачай и установи: https://nodejs.org/
    pause
    exit /b 1
)
echo ✓ Node.js установлен

echo.
echo [Шаг 2/5] Установка Railway CLI...
call npm install -g @railway/cli
if errorlevel 1 (
    echo ОШИБКА: Не удалось установить Railway CLI
    pause
    exit /b 1
)
echo ✓ Railway CLI установлен

echo.
echo [Шаг 3/5] Инициализация Git...
if not exist .git (
    git init
    git add .
    git commit -m "Initial commit for Railway deploy"
    echo ✓ Git репозиторий создан
) else (
    echo ✓ Git уже инициализирован
)

echo.
echo ========================================
echo   ВАЖНО! СЕЙЧАС ОТКРОЕТСЯ БРАУЗЕР
echo ========================================
echo.
echo 1. Войди через GitHub (или создай аккаунт)
echo 2. Разреши доступ Railway
echo 3. Вернись сюда в терминал
echo.
pause

echo.
echo [Шаг 4/5] Авторизация в Railway...
call railway login
if errorlevel 1 (
    echo ОШИБКА: Не удалось войти в Railway
    pause
    exit /b 1
)
echo ✓ Авторизация успешна

echo.
echo [Шаг 5/5] Создание проекта и деплой...
call railway init
if errorlevel 1 (
    echo ОШИБКА: Не удалось создать проект
    pause
    exit /b 1
)

echo.
echo Добавление переменных окружения...
call railway variables set NODE_ENV=production
call railway variables set SESSION_SECRET=7cf13e58913e3b94746c928a81e4192a8ec42905c27d910063fbdade23120242ffcc34a23a214a99a4d5dcc1c788c651c8cf72bf928d4168e21ca960e6525e7a
call railway variables set SMTP_USER=crystalcards89@gmail.com
call railway variables set SMTP_PASS=zvjszyktcpgulbg
call railway variables set USER_BOT_TOKEN=8184664856:AAGzpVyvWIKuBuc8OFZE1dl1GAzd__ohBbM
call railway variables set ADMIN_BOT_TOKEN=8775943790:AAEXqUa8-kResPhhzCwMzbogasmABwITeKs
call railway variables set SUPPORT_BOT_TOKEN=8779502933:AAFeyz16cBON5OQ1qfmGaTHRbbgaWe2vQns
call railway variables set CONTROL_BOT_TOKEN=8779502933:AAFeyz16cBON5OQ1qfmGaTHRbbgaWe2vQns
call railway variables set ADMIN_IDS=6383039210
call railway variables set BOT_USERNAME=CrystalCC_xBot
call railway variables set WEBHOOK_SECRET=your_webhook_secret_key_here
call railway variables set CONTROL_CHAT_ID=-5236298947
call railway variables set ENABLE_BOT_POLLING=false

echo.
echo ========================================
echo   ЗАПУСК ДЕПЛОЯ...
echo ========================================
call railway up

echo.
echo ========================================
echo   ДЕПЛОЙ ЗАВЕРШЕН!
echo ========================================
echo.
echo Получаем URL сайта...
call railway domain

echo.
echo ========================================
echo   ЧТО ДЕЛАТЬ ДАЛЬШЕ:
echo ========================================
echo.
echo 1. Скопируй URL выше (типа https://xxx.up.railway.app)
echo 2. Добавь переменную DOMAIN с этим URL:
echo    railway variables set DOMAIN=твой-url
echo.
echo 3. Настрой Telegram webhook:
echo    curl -X POST "https://api.telegram.org/bot8184664856:AAGzpVyvWIKuBuc8OFZE1dl1GAzd__ohBbM/setWebhook" -d "url=твой-url/webhook/telegram-bot"
echo.
echo 4. Открой URL в браузере и проверь!
echo.
pause
