import { User } from '../entities/User';
import { Email } from '../value-objects/Email';
import { Username } from '../value-objects/Username';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  findByUsername(username: Username): Promise<User | null>;
  findByTelegramId(telegramId: string): Promise<User | null>;
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
  delete(id: string): Promise<void>;
  exists(username: Username, email: Email | null): Promise<boolean>;
}
