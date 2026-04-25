import { ValidationError } from '../errors';
import bcrypt from 'bcryptjs';

export class Password {
  private readonly hash: string;

  private constructor(hash: string) {
    this.hash = hash;
  }

  public static async create(plainPassword: string): Promise<Password> {
    if (!plainPassword || typeof plainPassword !== 'string') {
      throw new ValidationError('Password is required');
    }

    if (plainPassword.length < 6) {
      throw new ValidationError('Password must be at least 6 characters');
    }

    if (plainPassword.length > 128) {
      throw new ValidationError('Password is too long');
    }

    const hash = await bcrypt.hash(plainPassword, 10);
    return new Password(hash);
  }

  public static fromHash(hash: string): Password {
    if (!hash || typeof hash !== 'string') {
      throw new ValidationError('Invalid password hash');
    }
    return new Password(hash);
  }

  public async compare(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this.hash);
  }

  public getHash(): string {
    return this.hash;
  }
}
