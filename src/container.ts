import 'reflect-metadata';
import { container } from 'tsyringe';
import { DatabaseConnection, UserRepository, CardRepository, SupportRepository } from './infrastructure/database';
import { IUserRepository, ICardRepository, ISupportRepository } from './domain/repositories';
import { TelegramUnifiedBot, ConversationManager } from './infrastructure/telegram';

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

// Register conversation manager
container.registerSingleton(ConversationManager);

// Register Telegram bot
container.registerSingleton(TelegramUnifiedBot);

export { container };
