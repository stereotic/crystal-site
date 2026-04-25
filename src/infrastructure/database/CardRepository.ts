import { injectable, inject } from 'tsyringe';
import { ICardRepository, CardFilters } from '../../domain/repositories';
import { Card } from '../../domain/entities';
import { Money } from '../../domain/value-objects';
import { DatabaseConnection } from './DatabaseConnection';

interface CardRow {
  id: string;
  region: string;
  type: string;
  card_number: string;
  exp: string;
  cvv: string;
  holder_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  bank: string;
  bin: string;
  price_cents: number;
  non_vbv: number;
  fullz: number;
  refundable: number;
  is_active: number;
  created_at: number;
  deleted_at: number | null;
}

@injectable()
export class CardRepository implements ICardRepository {
  constructor(
    @inject(DatabaseConnection) private db: DatabaseConnection
  ) {}

  async findById(id: string): Promise<Card | null> {
    const row = await this.db.get<CardRow>(
      'SELECT * FROM cards WHERE id = ?',
      [id]
    );

    return row ? this.mapToDomain(row) : null;
  }

  async findAll(filters?: CardFilters): Promise<Card[]> {
    const { sql, params } = this.buildQuery(filters, false);
    const rows = await this.db.query<CardRow>(sql, params);
    return rows.map(row => this.mapToDomain(row));
  }

  async findAvailable(filters?: CardFilters): Promise<Card[]> {
    const { sql, params } = this.buildQuery(filters, true);
    const rows = await this.db.query<CardRow>(sql, params);
    return rows.map(row => this.mapToDomain(row));
  }

  async save(card: Card): Promise<void> {
    await this.db.run(
      `INSERT INTO cards (
        id, region, type, card_number, exp, cvv, holder_name, address,
        city, state, zip, phone, bank, bin, price_cents, non_vbv, fullz,
        refundable, is_active, created_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        card.getId(),
        card.getRegion(),
        card.getType(),
        card.getCardNumber(),
        card.getExp(),
        card.getCvv(),
        card.getHolderName(),
        card.getAddress(),
        card.getCity(),
        card.getState(),
        card.getZip(),
        card.getPhone(),
        card.getBank(),
        card.getBin(),
        card.getPrice().getCents(),
        card.isNonVbv() ? 1 : 0,
        card.isFullz() ? 1 : 0,
        card.isRefundable() ? 1 : 0,
        card.isActive() ? 1 : 0,
        card.getCreatedAt().getTime(),
        card.getDeletedAt()?.getTime() || null,
      ]
    );
  }

  async update(card: Card): Promise<void> {
    await this.db.run(
      `UPDATE cards SET
        region = ?, type = ?, card_number = ?, exp = ?, cvv = ?,
        holder_name = ?, address = ?, city = ?, state = ?, zip = ?,
        phone = ?, bank = ?, bin = ?, price_cents = ?, non_vbv = ?,
        fullz = ?, refundable = ?, is_active = ?, deleted_at = ?
      WHERE id = ?`,
      [
        card.getRegion(),
        card.getType(),
        card.getCardNumber(),
        card.getExp(),
        card.getCvv(),
        card.getHolderName(),
        card.getAddress(),
        card.getCity(),
        card.getState(),
        card.getZip(),
        card.getPhone(),
        card.getBank(),
        card.getBin(),
        card.getPrice().getCents(),
        card.isNonVbv() ? 1 : 0,
        card.isFullz() ? 1 : 0,
        card.isRefundable() ? 1 : 0,
        card.isActive() ? 1 : 0,
        card.getDeletedAt()?.getTime() || null,
        card.getId(),
      ]
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM cards WHERE id = ?', [id]);
  }

  async count(filters?: CardFilters): Promise<number> {
    const { sql, params } = this.buildQuery(filters, false, true);
    const row = await this.db.get<{ count: number }>(sql, params);
    return row?.count || 0;
  }

  private buildQuery(filters?: CardFilters, onlyActive = false, count = false): { sql: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (onlyActive) {
      conditions.push('is_active = 1');
    }

    if (filters?.region) {
      conditions.push('region = ?');
      params.push(filters.region);
    }

    if (filters?.type) {
      conditions.push('type = ?');
      params.push(filters.type);
    }

    if (filters?.bank) {
      conditions.push('bank = ?');
      params.push(filters.bank);
    }

    if (filters?.bin) {
      conditions.push('bin = ?');
      params.push(filters.bin);
    }

    if (filters?.isNonVbv !== undefined) {
      conditions.push('non_vbv = ?');
      params.push(filters.isNonVbv ? 1 : 0);
    }

    if (filters?.isFullz !== undefined) {
      conditions.push('fullz = ?');
      params.push(filters.isFullz ? 1 : 0);
    }

    if (filters?.isRefundable !== undefined) {
      conditions.push('refundable = ?');
      params.push(filters.isRefundable ? 1 : 0);
    }

    if (filters?.minPrice !== undefined) {
      conditions.push('price_cents >= ?');
      params.push(filters.minPrice);
    }

    if (filters?.maxPrice !== undefined) {
      conditions.push('price_cents <= ?');
      params.push(filters.maxPrice);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const selectClause = count ? 'SELECT COUNT(*) as count' : 'SELECT *';
    const sql = `${selectClause} FROM cards ${whereClause} ORDER BY created_at DESC`;

    return { sql, params };
  }

  private mapToDomain(row: CardRow): Card {
    return Card.reconstitute({
      id: row.id,
      region: row.region,
      type: row.type,
      cardNumber: row.card_number,
      exp: row.exp,
      cvv: row.cvv,
      holderName: row.holder_name,
      address: row.address,
      city: row.city,
      state: row.state,
      zip: row.zip,
      phone: row.phone,
      bank: row.bank,
      bin: row.bin,
      price: Money.fromCents(row.price_cents),
      isNonVbv: row.non_vbv === 1,
      isFullz: row.fullz === 1,
      isRefundable: row.refundable === 1,
      isActive: row.is_active === 1,
      createdAt: new Date(row.created_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    });
  }
}
