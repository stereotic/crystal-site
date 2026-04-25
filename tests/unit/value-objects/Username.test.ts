import { Username } from '../../../src/domain/value-objects/Username';
import { ValidationError } from '../../../src/domain/errors';

describe('Username Value Object', () => {
  it('should create valid username', () => {
    const username = Username.create('testuser');
    expect(username.getValue()).toBe('testuser');
  });

  it('should accept underscores and hyphens', () => {
    const username = Username.create('test_user-123');
    expect(username.getValue()).toBe('test_user-123');
  });

  it('should throw error for too short username', () => {
    expect(() => Username.create('ab')).toThrow(ValidationError);
  });

  it('should throw error for too long username', () => {
    const longName = 'a'.repeat(51);
    expect(() => Username.create(longName)).toThrow(ValidationError);
  });

  it('should throw error for invalid characters', () => {
    expect(() => Username.create('test user')).toThrow(ValidationError);
    expect(() => Username.create('test@user')).toThrow(ValidationError);
  });

  it('should compare usernames case-insensitively', () => {
    const username1 = Username.create('TestUser');
    const username2 = Username.create('testuser');
    expect(username1.equals(username2)).toBe(true);
  });
});
