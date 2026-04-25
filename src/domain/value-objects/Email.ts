import { ValidationError } from '../errors';

export class Email {
  private readonly value: string;

  private constructor(email: string) {
    this.value = email;
  }

  public static create(email: string): Email {
    if (!email || typeof email !== 'string') {
      throw new ValidationError('Email is required');
    }

    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmed)) {
      throw new ValidationError('Invalid email format');
    }

    if (trimmed.length > 255) {
      throw new ValidationError('Email is too long');
    }

    return new Email(trimmed);
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: Email): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}
