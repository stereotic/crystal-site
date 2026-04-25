import { Money } from '../value-objects/Money';
import { ValidationError } from '../errors';

export interface CardProps {
  id: string;
  region: string;
  type: string;
  cardNumber: string;
  exp: string;
  cvv: string;
  holderName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  bank: string;
  bin: string;
  price: Money;
  isNonVbv: boolean;
  isFullz: boolean;
  isRefundable: boolean;
  isActive: boolean;
  createdAt: Date;
  deletedAt: Date | null;
}

export class Card {
  private constructor(private props: CardProps) {}

  public static create(props: Omit<CardProps, 'id' | 'createdAt' | 'deletedAt' | 'isActive'>): Card {
    return new Card({
      ...props,
      id: crypto.randomUUID(),
      isActive: true,
      createdAt: new Date(),
      deletedAt: null,
    });
  }

  public static reconstitute(props: CardProps): Card {
    return new Card(props);
  }

  // Getters
  public getId(): string {
    return this.props.id;
  }

  public getRegion(): string {
    return this.props.region;
  }

  public getType(): string {
    return this.props.type;
  }

  public getCardNumber(): string {
    return this.props.cardNumber;
  }

  public getExp(): string {
    return this.props.exp;
  }

  public getCvv(): string {
    return this.props.cvv;
  }

  public getHolderName(): string {
    return this.props.holderName;
  }

  public getAddress(): string {
    return this.props.address;
  }

  public getCity(): string {
    return this.props.city;
  }

  public getState(): string {
    return this.props.state;
  }

  public getZip(): string {
    return this.props.zip;
  }

  public getPhone(): string {
    return this.props.phone;
  }

  public getBank(): string {
    return this.props.bank;
  }

  public getBin(): string {
    return this.props.bin;
  }

  public getPrice(): Money {
    return this.props.price;
  }

  public isNonVbv(): boolean {
    return this.props.isNonVbv;
  }

  public isFullz(): boolean {
    return this.props.isFullz;
  }

  public isRefundable(): boolean {
    return this.props.isRefundable;
  }

  public isActive(): boolean {
    return this.props.isActive;
  }

  public getCreatedAt(): Date {
    return this.props.createdAt;
  }

  public getDeletedAt(): Date | null {
    return this.props.deletedAt;
  }

  // Business methods
  public deactivate(): void {
    if (!this.props.isActive) {
      throw new ValidationError('Card is already inactive');
    }
    this.props.isActive = false;
    this.props.deletedAt = new Date();
  }

  public getMaskedCardNumber(): string {
    const last4 = this.props.cardNumber.slice(-4);
    return `****-****-****-${last4}`;
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      region: this.props.region,
      type: this.props.type,
      cardNumber: this.getMaskedCardNumber(),
      exp: this.props.exp,
      holderName: this.props.holderName,
      bank: this.props.bank,
      bin: this.props.bin,
      price: this.props.price.getCents(),
      isNonVbv: this.props.isNonVbv,
      isFullz: this.props.isFullz,
      isRefundable: this.props.isRefundable,
      isActive: this.props.isActive,
      createdAt: this.props.createdAt.toISOString(),
    };
  }

  public toFullJSON(): Record<string, unknown> {
    return {
      ...this.toJSON(),
      cardNumber: this.props.cardNumber,
      cvv: this.props.cvv,
      address: this.props.address,
      city: this.props.city,
      state: this.props.state,
      zip: this.props.zip,
      phone: this.props.phone,
    };
  }
}
