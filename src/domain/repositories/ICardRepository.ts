import { Card } from '../entities/Card';

export interface CardFilters {
  region?: string;
  type?: string;
  bank?: string;
  bin?: string;
  isNonVbv?: boolean;
  isFullz?: boolean;
  isRefundable?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export interface ICardRepository {
  findById(id: string): Promise<Card | null>;
  findAll(filters?: CardFilters): Promise<Card[]>;
  findAvailable(filters?: CardFilters): Promise<Card[]>;
  save(card: Card): Promise<void>;
  update(card: Card): Promise<void>;
  delete(id: string): Promise<void>;
  count(filters?: CardFilters): Promise<number>;
}
