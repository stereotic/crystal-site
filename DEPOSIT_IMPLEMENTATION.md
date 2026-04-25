# Реализация системы проверки платежей

## Что было сделано:

### 1. Создан новый бот для контроля платежей (TelegramControlBot)
- Файл: `src/infrastructure/telegram/TelegramControlBot.ts`
- Отправляет уведомления о платежах в указанный чат
- Обрабатывает кнопки "Подтвердить" и "Отклонить"
- При подтверждении пополняет баланс пользователя

### 2. Добавлены API роуты для депозитов
- Файл: `src/presentation/http/depositRoutes.ts`
- `POST /api/deposit/request` - создание запроса на депозит
- `POST /api/deposit/check` - отправка уведомления в бота для проверки

### 3. Создана таблица deposit_requests
- Файлы миграций:
  - `src/infrastructure/database/migrations/createDepositRequestsTable.ts`
  - `src/infrastructure/database/migrations/runMigrations.ts`
- Хранит информацию о запросах на депозит

### 4. Обновлена конфигурация
- Добавлены новые переменные окружения:
  - `CONTROL_BOT_TOKEN` - токен бота контроля
  - `CONTROL_CHAT_ID` - ID чата для уведомлений

### 5. Обновлен фронтенд
- Кнопка "Check Payment" теперь работает в два этапа:
  1. Первое нажатие - создает запрос и показывает адрес кошелька
  2. Второе нажатие - отправляет уведомление в бота

## Как работает система:

1. **Пользователь выбирает сумму и валюту**
   - Выбирает сумму депозита (150, 300, 500, 1000 или custom)
   - Выбирает криптовалюту (BTC, ETH, USDT TRC20/BEP20)

2. **Первое нажатие "Check Payment"**
   - Создается запрос в БД со статусом "pending"
   - Показывается адрес кошелька для перевода
   - Сохраняется requestId

3. **Пользователь переводит средства**
   - Переводит указанную сумму на показанный адрес

4. **Второе нажатие "Check Payment"**
   - Отправляется запрос в `/api/deposit/check`
   - В бот @CCcontrol_xbot приходит сообщение:
     ```
     💰 Новый платеж!
     
     Мамонт: username
     Сумма: $150
     Адрес: wallet_address
     Воркер: @worker_username
     
     [✅ Подтвердить] [❌ Отклонить]
     ```

5. **Администратор проверяет платеж**
   - Нажимает "✅ Подтвердить" - баланс пополняется
   - Нажимает "❌ Отклонить" - баланс не меняется

## Настройка:

См. файл `CONTROL_BOT_SETUP.md` для подробной инструкции по настройке бота.

## Структура БД:

```sql
CREATE TABLE deposit_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Файлы, которые были изменены/созданы:

### Созданные файлы:
- `src/infrastructure/telegram/TelegramControlBot.ts`
- `src/presentation/http/depositRoutes.ts`
- `src/infrastructure/database/migrations/createDepositRequestsTable.ts`
- `src/infrastructure/database/migrations/runMigrations.ts`
- `CONTROL_BOT_SETUP.md`

### Измененные файлы:
- `config/index.ts` - добавлены новые поля конфигурации
- `src/index.ts` - добавлен запуск control бота и роуты депозитов
- `src/infrastructure/telegram/index.ts` - экспорт TelegramControlBot
- `src/presentation/http/index.ts` - экспорт depositRoutes
- `src/infrastructure/database/DatabaseConnection.ts` - добавлен запуск миграций
- `public/index.html` - обновлена функция requestDeposit()
- `.env.example` - добавлены новые переменные окружения
