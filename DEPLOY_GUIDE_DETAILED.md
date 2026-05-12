# Полная пошаговая инструкция по деплою (для новичков)

## ЧТО МЫ БУДЕМ ДЕЛАТЬ?

Сейчас твой сайт работает только на твоем компьютере (localhost:3000). 
Мы перенесем его на сервер в интернете, чтобы любой человек мог зайти на crystalcards.store и пользоваться сайтом.

---

## ШАГ 1: ПОДКЛЮЧЕНИЕ К СЕРВЕРУ

### Что такое VPS/сервер?
Это компьютер, который работает 24/7 в дата-центре. У тебя уже есть такой сервер с IP: `170.168.103.10`

### Как подключиться?

**На Windows:**

1. Открой **PowerShell** (не CMD!)
   - Нажми `Win + X`
   - Выбери "Windows PowerShell" или "Терминал"

2. Введи команду:
   ```bash
   ssh root@170.168.103.10
   ```

3. Тебя спросят пароль - введи: `j96Tq4ayF0u3`

**ЕСЛИ ПАРОЛЬ НЕ ПОДХОДИТ:**

Значит нужно его сбросить. Где ты покупал этот VPS? (Contabo, Hetzner, DigitalOcean?)
- Зайди в панель управления хостингом
- Найди раздел "Reset Password" или "Access"
- Сбрось пароль для пользователя root
- Попробуй подключиться снова

**Когда подключишься успешно:**
Ты увидишь что-то типа:
```
root@server:~#
```
Это значит ты внутри сервера! Теперь все команды будут выполняться на сервере, а не на твоем компьютере.

---

## ШАГ 2: ПРОВЕРКА СИСТЕМЫ

Давай проверим что за система на сервере:

```bash
cat /etc/os-release
```

Скорее всего это Ubuntu или Debian. Это Linux - операционная система для серверов.

Проверим свободное место:
```bash
df -h
```

Должно быть хотя бы 5-10 GB свободного места.

---

## ШАГ 3: ОБНОВЛЕНИЕ СИСТЕМЫ

**Зачем?** Чтобы все пакеты были свежие и без уязвимостей.

```bash
apt update
```

**Что происходит?** Система скачивает список доступных обновлений.

Подожди 10-30 секунд, затем:

```bash
apt upgrade -y
```

**Что происходит?** Система устанавливает все обновления. Флаг `-y` означает "да на все вопросы".

Это может занять 2-5 минут. Подожди пока не увидишь снова `root@server:~#`

---

## ШАГ 4: УСТАНОВКА NODE.JS

**Что такое Node.js?** Это программа, которая запускает JavaScript на сервере. Твой сайт написан на Node.js.

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
```

**Что происходит?** Скачивается скрипт установки Node.js версии 20.

Подожди 10-20 секунд, затем:

```bash
apt install -y nodejs
```

**Что происходит?** Устанавливается Node.js и npm (менеджер пакетов).

Проверим что установилось:

```bash
node -v
```

Должно показать что-то типа: `v20.12.0`

```bash
npm -v
```

Должно показать что-то типа: `10.5.0`

**Если видишь версии - отлично! Node.js установлен.**

---

## ШАГ 5: УСТАНОВКА PM2

**Что такое PM2?** Это программа, которая запускает твой сайт и следит чтобы он не упал. Если сайт крашнется - PM2 автоматически перезапустит его.

```bash
npm install -g pm2
```

**Что происходит?** 
- `npm install` - установить пакет
- `-g` - глобально (для всей системы)
- `pm2` - название программы

Подожди 30-60 секунд.

Проверим:
```bash
pm2 -v
```

Должна показаться версия PM2.

---

## ШАГ 6: УСТАНОВКА NGINX

**Что такое Nginx?** Это веб-сервер. Он принимает запросы из интернета и передает их твоему Node.js приложению.

**Зачем он нужен?** 
- Обрабатывает SSL (HTTPS)
- Раздает статические файлы быстрее
- Защищает от некоторых атак

```bash
apt install -y nginx
```

Подожди 20-40 секунд.

Проверим что Nginx запустился:
```bash
systemctl status nginx
```

Должно быть написано `active (running)` зеленым цветом.

Нажми `q` чтобы выйти из просмотра статуса.

---

## ШАГ 7: УСТАНОВКА GIT (опционально)

**Что такое Git?** Система контроля версий. Нужна если ты хочешь обновлять код через git pull.

```bash
apt install -y git
```

---

## ШАГ 8: СОЗДАНИЕ ПАПКИ ДЛЯ ПРОЕКТА

```bash
mkdir -p /var/www/crystal-site
```

**Что происходит?**
- `mkdir` - создать папку
- `-p` - создать родительские папки если их нет
- `/var/www/crystal-site` - путь к папке

Это стандартное место для веб-приложений на Linux.

Перейдем в эту папку:
```bash
cd /var/www/crystal-site
```

Проверим где мы:
```bash
pwd
```

Должно показать: `/var/www/crystal-site`

---

## ШАГ 9: ЗАГРУЗКА ПРОЕКТА НА СЕРВЕР

Теперь нужно перенести файлы с твоего компьютера на сервер.

### ВАРИАНТ A: Через SCP (рекомендую)

**На ТВОЕМ компьютере** (открой НОВОЕ окно PowerShell, не закрывай то что подключено к серверу):

1. Перейди в папку проекта:
   ```bash
   cd "C:\Users\Артем\Desktop\projects\BLACK-BET TEAM\Crystal site"
   ```

2. Создай архив проекта (без лишних файлов):
   ```bash
   tar -czf crystal-site.tar.gz --exclude=node_modules --exclude=.git --exclude=dist --exclude=logs .
   ```

   **Что происходит?**
   - `tar -czf` - создать сжатый архив
   - `crystal-site.tar.gz` - имя архива
   - `--exclude=node_modules` - не включать папку node_modules (она большая, установим на сервере)
   - `.` - архивировать текущую папку

3. Загрузи архив на сервер:
   ```bash
   scp crystal-site.tar.gz root@170.168.103.10:/var/www/crystal-site/
   ```

   Введи пароль: `j96Tq4ayF0u3`

   **Что происходит?** Файл копируется на сервер. Это может занять 1-5 минут в зависимости от скорости интернета.

4. **Вернись в окно с подключением к серверу** и распакуй архив:
   ```bash
   cd /var/www/crystal-site
   tar -xzf crystal-site.tar.gz
   rm crystal-site.tar.gz
   ```

   **Что происходит?**
   - `tar -xzf` - распаковать архив
   - `rm` - удалить архив (он больше не нужен)

5. Проверим что файлы на месте:
   ```bash
   ls -la
   ```

   Должны увидеть файлы: `package.json`, `src`, `public`, `.env` и т.д.

---

## ШАГ 10: НАСТРОЙКА .ENV ФАЙЛА

Нужно создать файл с настройками для production (боевого) сервера.

```bash
nano .env
```

**Что такое nano?** Это текстовый редактор в терминале.

**Скопируй и вставь** следующее (измени DOMAIN на свой домен):

```env
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
NODE_ENV=production
PORT=3000
```

**Как вставить в nano:**
- Правой кнопкой мыши в терминале (или Ctrl+Shift+V)

**Как сохранить:**
1. Нажми `Ctrl + X` (выход)
2. Нажми `Y` (да, сохранить)
3. Нажми `Enter` (подтвердить имя файла)

Проверим что файл создался:
```bash
cat .env
```

Должен показать содержимое файла.

---

## ШАГ 11: УСТАНОВКА ЗАВИСИМОСТЕЙ

```bash
npm install
```

**Что происходит?** npm читает файл `package.json` и устанавливает все библиотеки, которые нужны твоему проекту.

**Это займет 2-5 минут.** Увидишь много текста - это нормально.

Подожди пока не увидишь снова `root@server:~#`

---

## ШАГ 12: СБОРКА ПРОЕКТА

Твой проект написан на TypeScript, нужно скомпилировать его в JavaScript.

```bash
npm run build
```

**Что происходит?** TypeScript компилируется в JavaScript и складывается в папку `dist/`

Это займет 10-30 секунд.

Проверим что папка dist создалась:
```bash
ls -la dist/
```

Должна быть папка `src` внутри.

---

## ШАГ 13: СОЗДАНИЕ НЕОБХОДИМЫХ ПАПОК

```bash
mkdir -p logs uploads
```

Эти папки нужны для логов и загружаемых файлов.

---

## ШАГ 14: КОПИРОВАНИЕ БАЗЫ ДАННЫХ

**ВАЖНО!** Нужно скопировать базу данных с твоего компьютера на сервер.

**На ТВОЕМ компьютере** (в новом окне PowerShell):

```bash
cd "C:\Users\Артем\Desktop\projects\BLACK-BET TEAM\Crystal site"

scp database.db root@170.168.103.10:/var/www/crystal-site/
scp sessions.db root@170.168.103.10:/var/www/crystal-site/
```

Введи пароль когда попросит.

**Что происходит?** Копируются файлы баз данных со всеми пользователями, картами, сообщениями и т.д.

---

## ШАГ 15: ЗАПУСК ПРИЛОЖЕНИЯ

**Вернись в окно с сервером.**

Запустим приложение через PM2:

```bash
pm2 start dist/src/index.js --name crystal-site
```

**Что происходит?**
- `pm2 start` - запустить приложение
- `dist/src/index.js` - путь к главному файлу
- `--name crystal-site` - дать приложению имя

Должно показать таблицу с приложением в статусе "online".

Проверим логи:
```bash
pm2 logs crystal-site --lines 20
```

**Что смотреть:**
- Должно быть написано что сервер запустился на порту 3000
- Не должно быть красных ошибок
- Должно быть написано что боты подключились

Нажми `Ctrl + C` чтобы выйти из просмотра логов.

---

## ШАГ 16: НАСТРОЙКА АВТОЗАПУСКА

Чтобы приложение запускалось автоматически после перезагрузки сервера:

```bash
pm2 startup
```

Эта команда выдаст ДРУГУЮ команду. **Скопируй и выполни ее.**

Например:
```bash
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root
```

Затем:
```bash
pm2 save
```

**Что происходит?** PM2 сохраняет текущий список приложений и будет запускать их при старте системы.

---

## ШАГ 17: НАСТРОЙКА NGINX

Сейчас приложение работает на порту 3000, но доступно только локально. Nginx будет принимать запросы из интернета и передавать их приложению.

Создадим конфигурацию:

```bash
nano /etc/nginx/sites-available/crystalcards.store
```

**Скопируй и вставь:**

```nginx
server {
    listen 80;
    server_name crystalcards.store www.crystalcards.store;

    client_max_body_size 50M;

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
```

**Что это значит?**
- `listen 80` - слушать порт 80 (HTTP)
- `server_name` - домены которые обслуживаем
- `proxy_pass http://localhost:3000` - передавать запросы на порт 3000 (твое приложение)
- Остальное - заголовки для правильной работы

Сохрани: `Ctrl+X`, `Y`, `Enter`

Активируем конфигурацию:

```bash
ln -s /etc/nginx/sites-available/crystalcards.store /etc/nginx/sites-enabled/
```

**Что происходит?** Создается символическая ссылка (как ярлык в Windows).

Удалим дефолтную конфигурацию:

```bash
rm /etc/nginx/sites-enabled/default
```

Проверим что конфигурация правильная:

```bash
nginx -t
```

Должно быть написано: `syntax is ok` и `test is successful`

Перезапустим Nginx:

```bash
systemctl restart nginx
```

Проверим статус:

```bash
systemctl status nginx
```

Должно быть `active (running)` зеленым.

Нажми `q` для выхода.

---

## ШАГ 18: НАСТРОЙКА DNS (ДОМЕН)

Теперь нужно направить домен `crystalcards.store` на IP сервера.

**Где ты покупал домен?** (Namecheap, GoDaddy, Cloudflare?)

1. Зайди в панель управления доменом
2. Найди раздел "DNS Settings" или "DNS Management"
3. Добавь/измени записи:

```
Тип: A
Имя: @ (или пусто, или crystalcards.store)
Значение: 170.168.103.10
TTL: 3600 (или Auto)

Тип: A
Имя: www
Значение: 170.168.103.10
TTL: 3600 (или Auto)
```

4. Сохрани изменения

**Подожди 5-30 минут** пока DNS обновится по всему миру.

Проверить можно командой (на своем компьютере):

```bash
nslookup crystalcards.store
```

Должен показать IP: `170.168.103.10`

---

## ШАГ 19: ПРОВЕРКА РАБОТЫ (БЕЗ SSL)

Открой браузер и зайди на:

```
http://crystalcards.store
```

(именно HTTP, не HTTPS - SSL мы настроим в следующем шаге)

**Если сайт открылся - ОТЛИЧНО!** Переходи к следующему шагу.

**Если не открылся:**

1. Проверь что DNS обновился (nslookup)
2. Проверь что приложение работает:
   ```bash
   pm2 status
   pm2 logs crystal-site
   ```
3. Проверь что Nginx работает:
   ```bash
   systemctl status nginx
   ```
4. Проверь что порт 80 открыт:
   ```bash
   netstat -tulpn | grep :80
   ```

---

## ШАГ 20: УСТАНОВКА SSL (HTTPS)

Сейчас сайт работает по HTTP (небезопасно). Установим SSL сертификат для HTTPS.

Установим Certbot:

```bash
apt install -y certbot python3-certbot-nginx
```

Подожди 30-60 секунд.

Получим сертификат:

```bash
certbot --nginx -d crystalcards.store -d www.crystalcards.store
```

**Certbot задаст вопросы:**

1. **Email:** Введи свой email (для уведомлений о продлении сертификата)
2. **Terms of Service:** Введи `Y` (согласиться)
3. **Share email:** Введи `N` (не делиться email)
4. **Redirect HTTP to HTTPS:** Введи `2` (перенаправлять все на HTTPS)

**Что происходит?**
- Certbot получает бесплатный SSL сертификат от Let's Encrypt
- Автоматически настраивает Nginx для HTTPS
- Настраивает автоматическое продление сертификата

Если все прошло успешно, увидишь:

```
Congratulations! You have successfully enabled HTTPS...
```

---

## ШАГ 21: ФИНАЛЬНАЯ ПРОВЕРКА

Открой браузер и зайди на:

```
https://crystalcards.store
```

(теперь HTTPS с буквой S)

**Что проверить:**

1. ✅ Сайт открывается
2. ✅ В адресной строке есть замочек (SSL работает)
3. ✅ Можно зарегистрироваться
4. ✅ Можно войти
5. ✅ Карты отображаются
6. ✅ Баланс работает
7. ✅ Депозиты работают

**Проверь боты:**

1. Открой Telegram
2. Напиши боту @CrystalCC_xBot
3. Проверь что бот отвечает
4. Проверь контрольный бот - отправь `/wallets`

---

## ШАГ 22: НАСТРОЙКА ФАЙРВОЛА (БЕЗОПАСНОСТЬ)

Закроем ненужные порты:

```bash
apt install -y ufw

ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

Введи `y` когда спросит.

**Что происходит?** Открываем только нужные порты, остальные закрыты.

---

## ГОТОВО! 🎉

Твой сайт работает на `https://crystalcards.store`

---

## ПОЛЕЗНЫЕ КОМАНДЫ ДЛЯ УПРАВЛЕНИЯ

### Просмотр статуса приложения:
```bash
pm2 status
```

### Просмотр логов:
```bash
pm2 logs crystal-site
```

### Перезапуск приложения:
```bash
pm2 restart crystal-site
```

### Остановка приложения:
```bash
pm2 stop crystal-site
```

### Просмотр использования ресурсов:
```bash
pm2 monit
```

Нажми `Ctrl+C` для выхода.

### Проверка использования диска:
```bash
df -h
```

### Проверка использования памяти:
```bash
free -h
```

### Просмотр логов Nginx:
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## КАК ОБНОВИТЬ КОД НА СЕРВЕРЕ

Когда ты изменишь код на своем компьютере:

1. **На своем компьютере:**
   ```bash
   cd "C:\Users\Артем\Desktop\projects\BLACK-BET TEAM\Crystal site"
   npm run build
   tar -czf crystal-site.tar.gz --exclude=node_modules --exclude=.git --exclude=logs dist src public package.json package-lock.json .env
   scp crystal-site.tar.gz root@170.168.103.10:/var/www/
   ```

2. **На сервере:**
   ```bash
   cd /var/www/crystal-site
   tar -xzf /var/www/crystal-site.tar.gz
   npm install
   pm2 restart crystal-site
   ```

---

## ЧТО ДЕЛАТЬ ЕСЛИ ЧТО-ТО СЛОМАЛОСЬ

### Приложение не запускается:

```bash
pm2 logs crystal-site --lines 50
```

Посмотри на ошибки. Обычно это:
- Неправильный .env файл
- Нет базы данных
- Порт занят

### Сайт не открывается:

1. Проверь DNS:
   ```bash
   nslookup crystalcards.store
   ```

2. Проверь Nginx:
   ```bash
   systemctl status nginx
   nginx -t
   ```

3. Проверь приложение:
   ```bash
   pm2 status
   ```

### База данных пропала:

Скопируй с локалки:
```bash
scp database.db root@170.168.103.10:/var/www/crystal-site/
```

### Боты не работают:

Проверь логи:
```bash
pm2 logs crystal-site | grep -i telegram
```

Проверь токены в .env файле.

---

## ВАЖНЫЕ ФАЙЛЫ И ПАПКИ

```
/var/www/crystal-site/          # Главная папка проекта
├── dist/                        # Скомпилированный код
├── src/                         # Исходный код
├── public/                      # Статические файлы
├── database.db                  # База данных
├── sessions.db                  # Сессии
├── .env                         # Настройки
├── package.json                 # Зависимости
└── logs/                        # Логи

/etc/nginx/sites-available/      # Конфигурации Nginx
/var/log/nginx/                  # Логи Nginx
```

---

## КОНТАКТЫ ДЛЯ ПОМОЩИ

Если что-то не получается:
1. Скопируй ошибку из логов
2. Скопируй команду которую выполнял
3. Напиши мне

Удачи! 🚀
