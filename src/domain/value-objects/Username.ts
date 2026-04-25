import { ValidationError } from '../errors';

export class Username {
  private readonly value: string;

  private constructor(username: string) {
    this.value = username;
  }

  public static create(username: string): Username {
    if (!username || typeof username !== 'string') {
      throw new ValidationError('Username is required');
    }

    const trimmed = username.trim();

    if (trimmed.length < 3) {
      throw new ValidationError('Username must be at least 3 characters');
    }

    if (trimmed.length > 50) {
      throw new ValidationError('Username must be at most 50 characters');
    }

    // Allow letters, numbers, underscores, hyphens
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(trimmed)) {
      throw new ValidationError('Username can only contain letters, numbers, underscores, and hyphens');
    }

    return new Username(trimmed);
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: Username): boolean {
    return this.value.toLowerCase() === other.value.toLowerCase();
  }

  public toString(): string {
    return this.value;
  }
}
