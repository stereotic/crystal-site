import { Email } from '../value-objects/Email';
import { Username } from '../value-objects/Username';
import { Password } from '../value-objects/Password';
import { Money } from '../value-objects/Money';
import { ValidationError } from '../errors';

export interface UserProps {
  id: string;
  username: Username;
  email: Email | null;
  password: Password;
  balance: Money;
  isPremium: boolean;
  isWorker: boolean;
  isBanned: boolean;
  telegramId: string | null;
  telegramUsername: string | null;
  workerId: string | null;
  partnerId: string | null;
  referrerId: string | null;
  referralCode: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export class User {
  private constructor(private props: UserProps) {}

  public static create(props: Omit<UserProps, 'id' | 'createdAt'>): User {
    return new User({
      ...props,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    });
  }

  public static reconstitute(props: UserProps): User {
    return new User(props);
  }

  // Getters
  public getId(): string {
    return this.props.id;
  }

  public getUsername(): Username {
    return this.props.username;
  }

  public getEmail(): Email | null {
    return this.props.email;
  }

  public getPassword(): Password {
    return this.props.password;
  }

  public getBalance(): Money {
    return this.props.balance;
  }

  public isPremium(): boolean {
    return this.props.isPremium;
  }

  public isWorker(): boolean {
    return this.props.isWorker;
  }

  public isBanned(): boolean {
    return this.props.isBanned;
  }

  public getTelegramId(): string | null {
    return this.props.telegramId;
  }

  public getTelegramUsername(): string | null {
    return this.props.telegramUsername;
  }

  public getWorkerId(): string | null {
    return this.props.workerId;
  }

  public getPartnerId(): string | null {
    return this.props.partnerId;
  }

  public getReferrerId(): string | null {
    return this.props.referrerId;
  }

  public getReferralCode(): string | null {
    return this.props.referralCode;
  }

  public getCreatedAt(): Date {
    return this.props.createdAt;
  }

  public getLastLoginAt(): Date | null {
    return this.props.lastLoginAt;
  }

  // Business methods
  public async authenticate(plainPassword: string): Promise<boolean> {
    if (this.props.isBanned) {
      throw new ValidationError('User is banned');
    }
    return this.props.password.compare(plainPassword);
  }

  public addBalance(amount: Money): void {
    this.props.balance = this.props.balance.add(amount);
  }

  public deductBalance(amount: Money): void {
    if (this.props.balance.isLessThan(amount)) {
      throw new ValidationError('Insufficient balance');
    }
    this.props.balance = this.props.balance.subtract(amount);
  }

  public upgradeToPremium(): void {
    if (this.props.isPremium) {
      throw new ValidationError('User is already premium');
    }
    this.props.isPremium = true;
  }

  public ban(): void {
    this.props.isBanned = true;
  }

  public unban(): void {
    this.props.isBanned = false;
  }

  public updateLastLogin(): void {
    this.props.lastLoginAt = new Date();
  }

  public linkTelegram(telegramId: string, telegramUsername: string | null): void {
    this.props.telegramId = telegramId;
    this.props.telegramUsername = telegramUsername;
  }

  public attachToWorker(workerId: string): void {
    this.props.workerId = workerId;
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      username: this.props.username.getValue(),
      email: this.props.email?.getValue() || null,
      balance: this.props.balance.getCents(),
      isPremium: this.props.isPremium,
      isWorker: this.props.isWorker,
      isBanned: this.props.isBanned,
      telegramId: this.props.telegramId,
      telegramUsername: this.props.telegramUsername,
      workerId: this.props.workerId,
      partnerId: this.props.partnerId,
      referrerId: this.props.referrerId,
      referralCode: this.props.referralCode,
      createdAt: this.props.createdAt.toISOString(),
      lastLoginAt: this.props.lastLoginAt?.toISOString() || null,
    };
  }
}
