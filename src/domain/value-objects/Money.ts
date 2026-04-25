import { ValidationError } from '../errors';

export class Money {
  private readonly cents: number;

  private constructor(cents: number) {
    this.cents = cents;
  }

  public static fromCents(cents: number): Money {
    if (!Number.isInteger(cents)) {
      throw new ValidationError('Amount must be an integer (cents)');
    }

    if (cents < 0) {
      throw new ValidationError('Amount cannot be negative');
    }

    if (cents > Number.MAX_SAFE_INTEGER) {
      throw new ValidationError('Amount is too large');
    }

    return new Money(cents);
  }

  public static fromDollars(dollars: number): Money {
    if (typeof dollars !== 'number' || isNaN(dollars)) {
      throw new ValidationError('Invalid dollar amount');
    }

    const cents = Math.round(dollars * 100);
    return Money.fromCents(cents);
  }

  public static zero(): Money {
    return new Money(0);
  }

  public getCents(): number {
    return this.cents;
  }

  public getDollars(): number {
    return this.cents / 100;
  }

  public add(other: Money): Money {
    return Money.fromCents(this.cents + other.cents);
  }

  public subtract(other: Money): Money {
    const result = this.cents - other.cents;
    if (result < 0) {
      throw new ValidationError('Cannot subtract to negative amount');
    }
    return Money.fromCents(result);
  }

  public multiply(factor: number): Money {
    if (typeof factor !== 'number' || isNaN(factor) || factor < 0) {
      throw new ValidationError('Invalid multiplication factor');
    }
    return Money.fromCents(Math.round(this.cents * factor));
  }

  public isGreaterThan(other: Money): boolean {
    return this.cents > other.cents;
  }

  public isGreaterThanOrEqual(other: Money): boolean {
    return this.cents >= other.cents;
  }

  public isLessThan(other: Money): boolean {
    return this.cents < other.cents;
  }

  public equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  public toString(): string {
    return `$${this.getDollars().toFixed(2)}`;
  }
}
