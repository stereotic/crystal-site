import { User } from '../../../src/domain/entities/User';
import { Username, Email, Password, Money } from '../../../src/domain/value-objects';
import { ValidationError } from '../../../src/domain/errors';

describe('User Entity', () => {
  let password: Password;

  beforeAll(async () => {
    password = await Password.create('password123');
  });

  describe('create', () => {
    it('should create a new user', () => {
      const user = User.create({
        username: Username.create('testuser'),
        email: Email.create('test@example.com'),
        password,
        balance: Money.zero(),
        isPremium: false,
        isWorker: false,
        isBanned: false,
        telegramId: null,
        telegramUsername: null,
        workerId: null,
        partnerId: null,
        referrerId: null,
        referralCode: 'ABC123',
        lastLoginAt: null,
      });

      expect(user.getId()).toBeDefined();
      expect(user.getUsername().getValue()).toBe('testuser');
      expect(user.getBalance().getCents()).toBe(0);
    });
  });

  describe('balance operations', () => {
    it('should add balance', () => {
      const user = User.create({
        username: Username.create('testuser'),
        email: null,
        password,
        balance: Money.fromCents(1000),
        isPremium: false,
        isWorker: false,
        isBanned: false,
        telegramId: null,
        telegramUsername: null,
        workerId: null,
        partnerId: null,
        referrerId: null,
        referralCode: null,
        lastLoginAt: null,
      });

      user.addBalance(Money.fromCents(500));
      expect(user.getBalance().getCents()).toBe(1500);
    });

    it('should deduct balance', () => {
      const user = User.create({
        username: Username.create('testuser'),
        email: null,
        password,
        balance: Money.fromCents(1000),
        isPremium: false,
        isWorker: false,
        isBanned: false,
        telegramId: null,
        telegramUsername: null,
        workerId: null,
        partnerId: null,
        referrerId: null,
        referralCode: null,
        lastLoginAt: null,
      });

      user.deductBalance(Money.fromCents(300));
      expect(user.getBalance().getCents()).toBe(700);
    });

    it('should throw error when deducting more than balance', () => {
      const user = User.create({
        username: Username.create('testuser'),
        email: null,
        password,
        balance: Money.fromCents(500),
        isPremium: false,
        isWorker: false,
        isBanned: false,
        telegramId: null,
        telegramUsername: null,
        workerId: null,
        partnerId: null,
        referrerId: null,
        referralCode: null,
        lastLoginAt: null,
      });

      expect(() => user.deductBalance(Money.fromCents(1000))).toThrow(ValidationError);
    });
  });

  describe('premium operations', () => {
    it('should upgrade to premium', () => {
      const user = User.create({
        username: Username.create('testuser'),
        email: null,
        password,
        balance: Money.zero(),
        isPremium: false,
        isWorker: false,
        isBanned: false,
        telegramId: null,
        telegramUsername: null,
        workerId: null,
        partnerId: null,
        referrerId: null,
        referralCode: null,
        lastLoginAt: null,
      });

      user.upgradeToPremium();
      expect(user.isPremium()).toBe(true);
    });

    it('should throw error when already premium', () => {
      const user = User.create({
        username: Username.create('testuser'),
        email: null,
        password,
        balance: Money.zero(),
        isPremium: true,
        isWorker: false,
        isBanned: false,
        telegramId: null,
        telegramUsername: null,
        workerId: null,
        partnerId: null,
        referrerId: null,
        referralCode: null,
        lastLoginAt: null,
      });

      expect(() => user.upgradeToPremium()).toThrow(ValidationError);
    });
  });
});
