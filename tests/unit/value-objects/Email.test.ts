import { Email } from '../../../src/domain/value-objects/Email';
import { ValidationError } from '../../../src/domain/errors';

describe('Email Value Object', () => {
  it('should create valid email', () => {
    const email = Email.create('test@example.com');
    expect(email.getValue()).toBe('test@example.com');
  });

  it('should normalize email to lowercase', () => {
    const email = Email.create('Test@Example.COM');
    expect(email.getValue()).toBe('test@example.com');
  });

  it('should trim whitespace', () => {
    const email = Email.create('  test@example.com  ');
    expect(email.getValue()).toBe('test@example.com');
  });

  it('should throw error for invalid email format', () => {
    expect(() => Email.create('invalid')).toThrow(ValidationError);
    expect(() => Email.create('invalid@')).toThrow(ValidationError);
    expect(() => Email.create('@example.com')).toThrow(ValidationError);
  });

  it('should throw error for empty email', () => {
    expect(() => Email.create('')).toThrow(ValidationError);
  });

  it('should compare emails correctly', () => {
    const email1 = Email.create('test@example.com');
    const email2 = Email.create('test@example.com');
    const email3 = Email.create('other@example.com');

    expect(email1.equals(email2)).toBe(true);
    expect(email1.equals(email3)).toBe(false);
  });
});
