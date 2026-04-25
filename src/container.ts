import 'reflect-metadata';
import { container } from 'tsyringe';
import { DatabaseConnection, UserRepository, CardRepository, SupportRepository } from './infrastructure/database';
import { IUserRepository, ICardRepository, ISupportRepository } from './domain/repositories';
import { TelegramSupportBot } from './infrastructure/telegram';

// Register database connection
container.registerSingleton(DatabaseConnection);

// Register repositories
container.register<IUserRepository>('IUserRepository', {
  useClass: UserRepository,
});

container.register<ICardRepository>('ICardRepository', {
  useClass: CardRepository,
});

container.register<ISupportRepository>('ISupportRepository', {
  useClass: SupportRepository,
});

// Register Telegram bot
container.registerSingleton(TelegramSupportBot);

export { container };
