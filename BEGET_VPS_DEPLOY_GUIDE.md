# Деплой сайта Crystal на VPS Beget — пошаговая инструкция

Этот документ описывает, как развернуть **Node.js-приложение** (бэкенд + раздача фронта из репозитория) на **VPS у Beget** так, чтобы сайт открывался по домену с **HTTPS**, стабильно переживал перезагрузку сервера и корректно работал за **обратным прокси Nginx**.

> **Важно:** не публикуйте файл `.env` и не вставляйте реальные пароли и токены в открытые чаты. В примерах ниже — только **заглушки**.

---

## Содержание

1. [Что вы в итоге получите](#1-что-вы-в-итоге-получите)
2. [Что понадобится заранее](#2-что-понадобится-заранее)
3. [Домен и DNS у Beget](#3-домен-и-dns-у-beget)
4. [Первый вход по SSH](#4-первый-вход-по-ssh)
5. [Базовая подготовка сервера](#5-базовая-подготовка-сервера)
6. [Установка Node.js (рекомендуется LTS 20 или 22)](#6-установка-nodejs-рекомендуется-lts-20-или-22)
7. [База данных: PostgreSQL или SQLite](#7-база-данных-postgresql-или-sqlite)
8. [Загрузка кода на сервер](#8-загрузка-кода-на-сервер)
9. [Файл `.env` и переменные окружения](#9-файл-env-и-переменные-окружения)
10. [Сборка и проверка без Nginx](#10-сборка-и-проверка-без-nginx)
11. [PM2: запуск и автозапуск](#11-pm2-запуск-и-автозапуск)
12. [Nginx как reverse proxy](#12-nginx-как-reverse-proxy)
13. [HTTPS (Let's Encrypt, Certbot)](#13-https-lets-encrypt-certbot)
14. [Файрвол (UFW)](#14-файрвол-ufw)
15. [Telegram: webhook после HTTPS](#15-telegram-webhook-после-https)
16. [Обновление сайта после правок в коде](#16-обновление-сайта-после-правок-в-коде)
17. [Типичные проблемы](#17-типичные-проблемы)
18. [Вариант с панелью FastPanel на Beget](#18-вариант-с-панелью-fastpanel-на-beget)

---

## 1. Что вы в итоге получите

- Сервер слушает приложение на **localhost** (например, порт **3000**).
- **Nginx** принимает запросы с интернета на портах **80/443** и проксирует их в Node.js.
- **PM2** держит процесс живым и поднимает его после перезагрузки VPS.
- **HTTPS** для домена (через бесплатный сертификат Let's Encrypt).
- Для продакшена желательно **PostgreSQL** (если задан `DATABASE_URL`); без него приложение может использовать **SQLite** (проще для старта, хуже для нагрузки и бэкапов).

---

## 2. Что понадобится заранее

| Что | Зачем |
|-----|--------|
| **IP-адрес VPS** | Подключение по SSH, запись **A-записи** домена |
| **Логин** | Часто `root` (уточните в письме от Beget / в панели VPS) |
| **Пароль или SSH-ключ** | Вход на сервер |
| **Домен** (у Beget или другого регистратора) | Красивый URL и выпуск SSL |
| **Доступ к репозиторию** (GitHub/GitLab) или архив проекта | Чтобы залить код на VPS |
| **Секреты для `.env`** | Сессии, SMTP, Telegram — со своего старого хостинга или `.env` с локальной машины (без утечек) |

В панели Beget найдите раздел **VPS**: там обычно указаны IP, ОС (часто **Ubuntu 22.04**), логин и способ сброса пароля.

Официальная справка Beget по VPS: [https://beget.com/kb/vps](https://beget.com/kb/vps) (разделы могут обновляться — ориентируйтесь на актуальные статьи в базе знаний).

---

## 3. Домен и DNS у Beget

1. Зайдите в **панель управления доменом** (Beget или другой регистратор).
2. Создайте **A-запись**:
   - **Имя:** `@` (корень) и при необходимости `www`
   - **Значение:** **IP вашего VPS**
3. Подождите распространения DNS (обычно от **5 минут до нескольких часов**). Проверка с вашего ПК:

   ```powershell
   nslookup ваш-домен.ru
   ```

   В ответе должен фигурировать IP VPS.

Пока DNS не указывает на сервер, Certbot для домена может **не выдать** сертификат — это нормально, сначала доведите DNS до конца.

---

## 4. Первый вход по SSH

### С Windows (PowerShell или «Терминал»)

```powershell
ssh root@ВАШ_IP
```

Если у вас не `root`, подставьте логин из панели Beget:

```powershell
ssh ubuntu@ВАШ_IP
```

При первом подключении спросят отпечаток ключа — введите `yes`.

**Если вход по паролю:** введите пароль (символы при вводе не отображаются — это нормально).

**Если не подключается:**

- Проверьте, что в панели Beget VPS **запущен**.
- Убедитесь, что с вашей сети не блокируется порт **22** (иногда мешает антивирус или корпоративный файрвол).

---

## 5. Базовая подготовка сервера

Выполняйте команды **на сервере** после входа по SSH.

### 5.1. Обновление списка пакетов и установка утилит

Для Ubuntu/Debian:

```bash
apt update && apt upgrade -y
apt install -y curl git ufw
```

### 5.2. Проверка свободного места и памяти

```bash
df -h
free -h
```

Для Node + PostgreSQL + сборки комфортно иметь **несколько гигабайт** свободного диска и **от 1 ГБ RAM** (меньше — возможны ошибки при `npm install`).

### 5.3. Часовой пояс (по желанию)

```bash
timedatectl list-timezones | grep Moscow
sudo timedatectl set-timezone Europe/Moscow
```

---

## 6. Установка Node.js (рекомендуется LTS 20 или 22)

Удобный способ — **NodeSource** (пример для **Node 20**):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs build-essential
node -v
npm -v
```

Требования проекта: **Node >= 18** (см. `package.json` → `engines`).

---

## 7. База данных: PostgreSQL или SQLite

### Вариант A — SQLite (быстрее начать, для небольшой нагрузки)

- Переменную **`DATABASE_URL` не задавайте** — приложение выберет SQLite.
- Файлы базы появятся в каталоге проекта (имена зависят от кода; следите за **бэкапом** этой папки).

### Вариант B — PostgreSQL (рекомендуется для продакшена)

Установка на Ubuntu:

```bash
apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql
```

Создайте пользователя и базу (подставьте свои имена и пароль):

```bash
sudo -u postgres psql -c "CREATE USER crystal_user WITH PASSWORD 'НАДЁЖНЫЙ_ПАРОЛЬ';"
sudo -u postgres psql -c "CREATE DATABASE crystal_db OWNER crystal_user;"
```

Строка подключения для `.env`:

```env
DATABASE_URL=postgresql://crystal_user:НАДЁЖНЫЙ_ПАРОЛЬ@127.0.0.1:5432/crystal_db
```

Миграции в проекте **запускаются при старте приложения** (через слой подключения к БД). После первого успешного запуска проверьте логи PM2, что нет ошибок SQL.

---

## 8. Загрузка кода на сервер

### Вариант 1 — Git (предпочтительно)

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/ВАШ_ЛОГИН/crystal-site.git
cd crystal-site
```

Если репозиторий **приватный**, настройте доступ:

- [Deploy Key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys) на сервере, или
- Personal Access Token при клонировании по HTTPS (храните токен только на сервере и не коммитьте).

### Вариант 2 — архив с вашего компьютера (scp)

На **Windows (PowerShell)** из папки с архивом:

```powershell
scp .\crystal-site.zip root@ВАШ_IP:/var/www/
```

На сервере:

```bash
cd /var/www
apt install -y unzip
unzip crystal-site.zip -d crystal-site
cd crystal-site
```

---

## 9. Файл `.env` и переменные окружения

В корне проекта создайте файл `.env`:

```bash
cd /var/www/crystal-site
nano .env
```

### Минимальный шаблон (замените значения на свои)

```env
NODE_ENV=production
PORT=3000
DOMAIN=https://ваш-домен.ru

SESSION_SECRET=длинная-случайная-строка-минимум-32-символа

SMTP_USER=ваш_email@example.com
SMTP_PASS=пароль_приложения_smtp

USER_BOT_TOKEN=токен_от_BotFather
ADMIN_BOT_TOKEN=токен_админ_бота
SUPPORT_BOT_TOKEN=токен_при_необходимости
CONTROL_BOT_TOKEN=токен_при_необходимости

BOT_USERNAME=имя_бота_без_@
ADMIN_IDS=id1,id2
CONTROL_CHAT_ID=id_чата_или_оставьте_пустым_если_не_используется

WEBHOOK_SECRET=случайная_строка_для_проверки_webhook

# PostgreSQL (раскомментируйте и заполните, если используете Вариант B из раздела 7)
# DATABASE_URL=postgresql://crystal_user:ПАРОЛЬ@127.0.0.1:5432/crystal_db

# В продакшене боты обычно через webhook, не polling:
ENABLE_BOT_POLLING=false
```

**Обязательные поля** (приложение проверит при старте): `SESSION_SECRET`, `SMTP_USER`, `SMTP_PASS`, `USER_BOT_TOKEN`, `ADMIN_BOT_TOKEN`, `WEBHOOK_SECRET` — см. `config/index.ts`.

Сохранение в `nano`: **Ctrl+O**, Enter, **Ctrl+X**.

Сгенерировать случайные секреты на сервере:

```bash
openssl rand -hex 32
```

---

## 10. Сборка и проверка без Nginx

```bash
cd /var/www/crystal-site
npm ci
# если нет package-lock — используйте: npm install
npm run build
```

Краткая проверка (процесс в foreground, остановка **Ctrl+C**):

```bash
NODE_ENV=production node dist/src/index.js
```

В другом SSH-окне:

```bash
curl -s http://127.0.0.1:3000/health
```

Ожидается JSON со статусом **ok**. Если ошибка — смотрите вывод консоли (часто это незаполненный `.env` или БД).

---

## 11. PM2: запуск и автозапуск

Установка PM2 глобально:

```bash
npm install -g pm2
mkdir -p /var/www/crystal-site/logs
```

Создайте файл `ecosystem.config.js` в корне проекта:

```bash
nano /var/www/crystal-site/ecosystem.config.js
```

Содержимое:

```javascript
module.exports = {
  apps: [
    {
      name: 'crystal-site',
      cwd: '/var/www/crystal-site',
      script: './dist/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
```

> Переменные из `.env` подхватываются приложением через `dotenv` при старте **если** `cwd` указывает на каталог с `.env` (как в примере выше).

Запуск:

```bash
cd /var/www/crystal-site
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Команда `pm2 startup` выведет **одну длинную команду** с `sudo` — скопируйте и выполните её целиком. Это включит автозапуск PM2 при перезагрузке сервера.

Проверка:

```bash
pm2 status
pm2 logs crystal-site --lines 80
```

---

## 12. Nginx как reverse proxy

Установка:

```bash
apt install -y nginx
```

Создайте конфиг сайта (имя файла может быть любым):

```bash
nano /etc/nginx/sites-available/crystal-site
```

Пример для **HTTP** (сертификат добавим на следующем шаге):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name ваш-домен.ru www.ваш-домен.ru;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        client_max_body_size 25M;
    }
}
```

Включите сайт и перезапустите Nginx:

```bash
ln -sf /etc/nginx/sites-available/crystal-site /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Проверка с сервера:

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/
```

---

## 13. HTTPS (Let's Encrypt, Certbot)

Установка Certbot с плагином для Nginx:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d ваш-домен.ru -d www.ваш-домен.ru
```

Следуйте вопросам мастера (email, согласие с ToS). Certbot **сам** допишет в конфиг Nginx **listen 443 ssl** и пути к сертификатам.

Автообновление сертификатов обычно ставится **cron**/**timer** автоматически; проверка:

```bash
certbot renew --dry-run
```

После HTTPS обновите в `.env`:

```env
DOMAIN=https://ваш-домен.ru
```

и перезапустите приложение:

```bash
pm2 restart crystal-site
```

---

## 14. Файрвол (UFW)

Рекомендуемая схема: наружу только **SSH, HTTP, HTTPS**; порт **3000** с интернета **не открывать** (доступ только через Nginx на localhost).

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

Если SSH не на стандартном порту — разрешите свой порт вместо `OpenSSH`.

---

## 15. Telegram: webhook после HTTPS

В продакшене с `NODE_ENV=production` и `ENABLE_BOT_POLLING=false` боты рассчитыва на **webhook** (см. логи при старте в `src/index.ts`).

Публичный HTTPS-URL должен вести на тот же хост, где обрабатывается маршрут **`POST /webhook/telegram-bot`**.

Пример установки webhook (выполните **на своём ПК**, подставив токен и домен):

```powershell
$token = "ВАШ_USER_BOT_TOKEN"
$url = "https://ваш-домен.ru/webhook/telegram-bot"
Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/setWebhook" -Method Post -Body @{ url = $url }
```

Проверка:

```powershell
Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/getWebhookInfo"
```

Убедитесь, что в ответе нет ошибок SSL и URL совпадает с реальным маршрутом приложения.

---

## 16. Обновление сайта после правок в коде

```bash
cd /var/www/crystal-site
git pull
npm ci
npm run build
pm2 restart crystal-site
pm2 logs crystal-site --lines 50
```

Если меняли только `.env`:

```bash
pm2 restart crystal-site
```

---

## 17. Типичные проблемы

| Симптом | Что проверить |
|--------|----------------|
| **502 Bad Gateway** | `pm2 status` — процесс online? `curl http://127.0.0.1:3000/health`. Логи: `pm2 logs crystal-site`. |
| **Сайт не открывается по IP/домену** | DNS `nslookup`, `nginx -t`, `systemctl status nginx`, UFW. |
| **Ошибка сертификата Let's Encrypt** | Домен должен указывать на этот IP; порт 80 доступен снаружи; нет конфликтующего веб-сервера на 80. |
| **Приложение падает при старте** | Неполный `.env`; неверный `DATABASE_URL`; нет прав на каталог для SQLite. |
| **Сессии/авторизация странно ведут себя за прокси** | Уже учтено `trust proxy` в приложении; для Nginx важны заголовки `X-Forwarded-Proto` (см. конфиг выше). |

Полезные команды:

```bash
journalctl -u nginx -n 50 --no-pager
ss -tlnp | grep 3000
```

---

## 18. Вариант с панелью FastPanel на Beget

Если на VPS **уже установлена FastPanel**:

1. Создайте сайт в панели с вашим доменом (или привяжите домен к существующему).
2. В настройках сайта найдите **проксирование на Node.js** или **пользовательский фрагмент Nginx** и добавьте блок `location /` с `proxy_pass http://127.0.0.1:3000;` как в [разделе 12](#12-nginx-как-reverse-proxy).
3. SSL часто проще включить **из панели** (Let's Encrypt), затем не забудьте `DOMAIN=https://...` в `.env` и `pm2 restart`.

Код по-прежнему размещается в `/var/www/...` (или в каталоге пользователя панели — главное, чтобы `cwd` в PM2 совпадал с папкой, где лежит `.env` и `dist`).

---

## Краткий чеклист перед сдачей «в прод»

- [ ] DNS **A** на IP VPS
- [ ] `npm run build` без ошибок
- [ ] `pm2 status` — **online**, `pm2 save` и `pm2 startup` выполнены
- [ ] `curl https://ваш-домен.ru/health` возвращает **ok**
- [ ] HTTPS открывается без предупреждений браузера
- [ ] `.env` не попал в git и не светится в публичных логах
- [ ] Telegram webhook указывает на **HTTPS**-URL
- [ ] Настроен **бэкап** БД (особенно для SQLite — копия файлов; для PostgreSQL — `pg_dump`)

Если опишете в письме в поддержку Beget: ОС, наличие FastPanel и вывод `node -v` / `nginx -t`, вам смогут быстрее сузить проблему на стороне хостинга.
