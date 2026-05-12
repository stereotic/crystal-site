#!/bin/bash

# Скрипт для обновления баланса пользователя Maybe на сервере
# Добавляет $120 к текущему балансу

echo "🔄 Обновление баланса пользователя Maybe..."
echo ""

# Найти директорию проекта
if [ -d "/root/crystal-site" ]; then
    cd /root/crystal-site
elif [ -d "/var/www/crystal-site" ]; then
    cd /var/www/crystal-site
elif [ -d "~/crystal-site" ]; then
    cd ~/crystal-site
else
    echo "❌ Директория проекта не найдена"
    echo "Попробуйте вручную перейти в директорию проекта и запустить:"
    echo "node update-balance-server.js"
    exit 1
fi

echo "📁 Рабочая директория: $(pwd)"
echo ""

# Запустить скрипт обновления
node update-balance-server.js

echo ""
echo "✅ Готово! Обновите страницу в браузере."
