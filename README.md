# Crystal Cards - Backend

Modern, production-ready backend for Crystal Cards marketplace built with Clean Architecture principles.

## Features

- ✅ **Clean Architecture** - Separation of concerns with domain, application, infrastructure, and presentation layers
- ✅ **TypeScript** - Full type safety
- ✅ **Dependency Injection** - Using tsyringe
- ✅ **Comprehensive Testing** - Unit and integration tests with Jest
- ✅ **Structured Logging** - Winston logger
- ✅ **Input Validation** - Joi schemas
- ✅ **Error Handling** - Centralized error handling
- ✅ **Security** - Helmet, CORS, rate limiting, session management
- ✅ **Database** - SQLite with proper connection management

## Architecture

```
src/
├── domain/              # Business logic & entities
│   ├── entities/        # Domain entities (User, Card)
│   ├── value-objects/   # Value objects (Email, Money, Password)
│   ├── repositories/    # Repository interfaces
│   └── errors.ts        # Domain errors
├── application/         # Use cases
│   ├── use-cases/       # Application use cases
│   └── dtos/            # Data transfer objects
├── infrastructure/      # External concerns
│   ├── database/        # Database implementation
│   └── logger/          # Logging
└── presentation/        # API layer
    ├── http/            # Express routes & controllers
    └── middleware/      # Express middleware
```

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:
- `SESSION_SECRET` - Secret for session encryption
- `SMTP_USER` - Email for SMTP
- `SMTP_PASS` - Password for SMTP
- `USER_BOT_TOKEN` - Telegram bot token
- `ADMIN_BOT_TOKEN` - Admin Telegram bot token
- `WEBHOOK_SECRET` - Secret for webhooks

### 3. Build the project

```bash
npm run build
```

### 4. Start the server

```bash
npm start
```

For development with hot reload:

```bash
npm run dev
```

## Testing

Run all tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run integration tests:

```bash
npm run test:integration
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/session` - Get session info

### Cards

- `GET /api/cards` - Get available cards (with filters)
- `POST /api/cards/:cardId/purchase` - Purchase a card (requires auth)

### Support

- `POST /api/support/send` - Send support message (requires auth)
- `GET /api/support/history` - Get support message history (requires auth)

## Project Structure

### Domain Layer

Contains business logic and rules. Independent of external frameworks.

- **Entities**: Core business objects (User, Card)
- **Value Objects**: Immutable objects representing concepts (Money, Email)
- **Repository Interfaces**: Contracts for data access
- **Domain Services**: Business logic that doesn't fit in entities

### Application Layer

Contains use cases and application-specific business rules.

- **Use Cases**: Application operations (RegisterUser, PurchaseCard)
- **DTOs**: Data transfer objects for API communication
- **Interfaces**: Port interfaces for external services

### Infrastructure Layer

Contains implementations of external concerns.

- **Database**: Repository implementations
- **Logger**: Logging implementation
- **External Services**: Email, Telegram, etc.

### Presentation Layer

Contains API controllers and middleware.

- **HTTP Routes**: Express route handlers
- **Middleware**: Authentication, error handling, validation
- **Validators**: Request validation schemas

## Development

### Code Style

The project uses ESLint and TypeScript for code quality:

```bash
npm run lint
npm run lint:fix
```

### Adding New Features

1. Start with domain layer (entities, value objects)
2. Define repository interfaces
3. Create use cases in application layer
4. Implement repositories in infrastructure layer
5. Add HTTP routes in presentation layer
6. Write tests

## Production Deployment

1. Build the project:
```bash
npm run build
```

2. Set `NODE_ENV=production` in your environment

3. Start the server:
```bash
npm start
```

4. Use a process manager like PM2:
```bash
pm2 start dist/index.js --name crystal-cards
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 3000) |
| `DOMAIN` | Application domain | No (default: http://localhost:3000) |
| `NODE_ENV` | Environment (development/production) | No (default: development) |
| `SESSION_SECRET` | Session encryption secret | Yes |
| `SMTP_USER` | SMTP email address | Yes |
| `SMTP_PASS` | SMTP password | Yes |
| `USER_BOT_TOKEN` | Telegram user bot token | Yes |
| `ADMIN_BOT_TOKEN` | Telegram admin bot token | Yes |
| `BOT_USERNAME` | Telegram bot username | No |
| `ADMIN_IDS` | Comma-separated admin Telegram IDs | No |
| `WEBHOOK_SECRET` | Webhook secret key | Yes |
| `SUPPORT_BOT_URL` | Support bot URL | No |

## Troubleshooting

### Database locked error

If you see "database is locked" errors, check:
- No other processes are accessing the database
- WAL mode is enabled (automatic)
- Busy timeout is set (automatic)

### Session issues

If sessions aren't persisting:
- Check `SESSION_SECRET` is set
- Verify `sessions.db` file exists and is writable
- Check cookie settings in production (secure flag)

## License

Proprietary - Crystal Cards Team

## Support

For issues and questions, contact the development team.
