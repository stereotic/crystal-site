import { Money } from '../../../src/domain/value-objects/Money';
import { ValidationError } from '../../../src/domain/errors';

describe('Money Value Object', () => {
  describe('fromCents', () => {
    it('should create money from cents', () => {
      const money = Money.fromCents(1000);
      expect(money.getCents()).toBe(1000);
      expect(money.getDollars()).toBe(10);
    });

    it('should throw error for non-integer cents', () => {
      expect(() => Money.fromCents(10.5)).toThrow(ValidationError);
    });

    it('should throw error for negative cents', () => {
      expect(() => Money.fromCents(-100)).toThrow(ValidationError);
    });
  });

  describe('fromDollars', () => {
    it('should create money from dollars', () => {
      const money = Money.fromDollars(10.50);
      expect(money.getCents()).toBe(1050);
      expect(money.getDollars()).toBe(10.50);
    });

    it('should round to nearest cent', () => {
      const money = Money.fromDollars(10.555);
      expect(money.getCents()).toBe(1056);
    });
  });

  describe('arithmetic operations', () => {
    it('should add money', () => {
      const money1 = Money.fromCents(1000);
      const money2 = Money.fromCents(500);
      const result = money1.add(money2);
      expect(result.getCents()).toBe(1500);
    });

    it('should subtract money', () => {
      const money1 = Money.fromCents(1000);
      const money2 = Money.fromCents(500);
      const result = money1.subtract(money2);
      expect(result.getCents()).toBe(500);
    });

    it('should throw error when subtracting to negative', () => {
      const money1 = Money.fromCents(500);
      const money2 = Money.fromCents(1000);
      expect(() => money1.subtract(money2)).toThrow(ValidationError);
    });

    it('should multiply money', () => {
      const money = Money.fromCents(1000);
      const result = money.multiply(2.5);
      expect(result.getCents()).toBe(2500);
    });
  });

  describe('comparison operations', () => {
    it('should compare money correctly', () => {
      const money1 = Money.fromCents(1000);
      const money2 = Money.fromCents(500);
      const money3 = Money.fromCents(1000);

      expect(money1.isGreaterThan(money2)).toBe(true);
      expect(money2.isLessThan(money1)).toBe(true);
      expect(money1.equals(money3)).toBe(true);
    });
  });
});
