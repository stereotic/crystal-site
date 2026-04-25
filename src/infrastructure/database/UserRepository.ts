import { injectable, inject } from 'tsyringe';
import { IUserRepository } from '../../domain/repositories';
import { User } from '../../domain/entities';
import { Email, Username, Password, Money } from '../../domain/value-objects';
import { DatabaseConnection } from './DatabaseConnection';

interface UserRow {
  id: string;
  username: string;
  email: string | null;
  password: string;
  balance_cents: number;
  is_premium: number;
  is_worker: number;
  banned: number;
  tg_id: string | null;
  tg_username: string | null;
  worker_id: string | null;
  partner_id: string | null;
  referrer_tg_id: string | null;
  ref_code: string | null;
  created: number;
  lastLogin: number | null;
}

@injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @inject(DatabaseConnection) private db: DatabaseConnection
  ) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db.get<UserRow>(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    return row ? this.mapToDomain(row) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.db.get<UserRow>(
      'SELECT * FROM users WHERE email = ?',
      [email.getValue()]
    );

    return row ? this.mapToDomain(row) : null;
  }

  async findByUsername(username: Username): Promise<User | null> {
    const row = await this.db.get<UserRow>(
      'SELECT * FROM users WHERE LOWER(username) = LOWER(?)',
      [username.getValue()]
    );

    return row ? this.mapToDomain(row) : null;
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    const row = await this.db.get<UserRow>(
      'SELECT * FROM users WHERE tg_id = ?',
      [telegramId]
    );

    return row ? this.mapToDomain(row) : null;
  }

  async save(user: User): Promise<void> {
    await this.db.run(
      `INSERT INTO users (
        id, username, email, password, balance_cents, is_premium, is_worker,
        banned, tg_id, tg_username, worker_id, partner_id, referrer_tg_id,
        ref_code, created, lastLogin
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.getId(),
        user.getUsername().getValue(),
        user.getEmail()?.getValue() || null,
        user.getPassword().getHash(),
        user.getBalance().getCents(),
        user.isPremium() ? 1 : 0,
        user.isWorker() ? 1 : 0,
        user.isBanned() ? 1 : 0,
        user.getTelegramId(),
        user.getTelegramUsername(),
        user.getWorkerId(),
        user.getPartnerId(),
        user.getReferrerId(),
        user.getReferralCode(),
        user.getCreatedAt().getTime(),
        user.getLastLoginAt()?.getTime() || null,
      ]
    );
  }

  async update(user: User): Promise<void> {
    await this.db.run(
      `UPDATE users SET
        username = ?, email = ?, password = ?, balance_cents = ?,
        is_premium = ?, is_worker = ?, banned = ?, tg_id = ?,
        tg_username = ?, worker_id = ?, partner_id = ?, referrer_tg_id = ?,
        ref_code = ?, lastLogin = ?
      WHERE id = ?`,
      [
        user.getUsername().getValue(),
        user.getEmail()?.getValue() || null,
        user.getPassword().getHash(),
        user.getBalance().getCents(),
        user.isPremium() ? 1 : 0,
        user.isWorker() ? 1 : 0,
        user.isBanned() ? 1 : 0,
        user.getTelegramId(),
        user.getTelegramUsername(),
        user.getWorkerId(),
        user.getPartnerId(),
        user.getReferrerId(),
        user.getReferralCode(),
        user.getLastLoginAt()?.getTime() || null,
        user.getId(),
      ]
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM users WHERE id = ?', [id]);
  }

  async exists(username: Username, email: Email | null): Promise<boolean> {
    if (email) {
      const row = await this.db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM users WHERE LOWER(username) = LOWER(?) OR email = ?',
        [username.getValue(), email.getValue()]
      );
      return (row?.count || 0) > 0;
    } else {
      const row = await this.db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM users WHERE LOWER(username) = LOWER(?)',
        [username.getValue()]
      );
      return (row?.count || 0) > 0;
    }
  }

  private mapToDomain(row: UserRow): User {
    return User.reconstitute({
      id: row.id,
      username: Username.create(row.username),
      email: row.email ? Email.create(row.email) : null,
      password: Password.fromHash(row.password),
      balance: Money.fromCents(row.balance_cents),
      isPremium: row.is_premium === 1,
      isWorker: row.is_worker === 1,
      isBanned: row.banned === 1,
      telegramId: row.tg_id,
      telegramUsername: row.tg_username,
      workerId: row.worker_id,
      partnerId: row.partner_id,
      referrerId: row.referrer_tg_id,
      referralCode: row.ref_code,
      createdAt: new Date(row.created),
      lastLoginAt: row.lastLogin ? new Date(row.lastLogin) : null,
    });
  }
}
