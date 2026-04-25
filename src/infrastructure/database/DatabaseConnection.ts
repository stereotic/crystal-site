import { Database } from 'sqlite3';
import { injectable } from 'tsyringe';

@injectable()
export class DatabaseConnection {
  private db: Database | null = null;

  constructor() {
    this.connect();
  }

  private connect(): void {
    this.db = new Database('./database.db', (err) => {
      if (err) {
        console.error('Database connection error:', err);
        throw err;
      }
      this.configure();
    });
  }

  private configure(): void {
    if (!this.db) return;

    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 10000;
      PRAGMA foreign_keys = ON;
      PRAGMA cache_size = -64000;
      PRAGMA temp_store = MEMORY;
      PRAGMA mmap_size = 30000000000;
    `, (err) => {
      if (err) {
        console.error('Database configuration error:', err);
      }
    });

    // Create indexes for better performance
    this.createIndexes();

    // Run migrations after indexes are created
    setTimeout(() => this.runMigrations(), 100);
  }

  private async runMigrations(): Promise<void> {
    try {
      const { runMigrations } = await import('./migrations/runMigrations');
      await runMigrations(this);
    } catch (error) {
      console.error('Migration error:', error);
    }
  }

  private createIndexes(): void {
    if (!this.db) return;

    // First ensure is_sold column exists
    this.db.run('ALTER TABLE cards ADD COLUMN is_sold INTEGER DEFAULT 0', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Column addition error:', err);
      }
    });

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_cards_is_sold ON cards(is_sold)',
      'CREATE INDEX IF NOT EXISTS idx_cards_region ON cards(region)',
      'CREATE INDEX IF NOT EXISTS idx_cards_type ON cards(type)',
      'CREATE INDEX IF NOT EXISTS idx_messages_user_email ON messages(user_email)',
      'CREATE INDEX IF NOT EXISTS idx_messages_time ON messages(time)',
      'CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id)',
    ];

    indexes.forEach(sql => {
      this.db!.exec(sql, (err) => {
        if (err) {
          console.error('Index creation error:', err);
        }
      });
    });
  }

  public getConnection(): Database {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db;
  }

  public async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject(new Error('Database not connected'));
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  public async get<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject(new Error('Database not connected'));
      }

      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve((row as T) || null);
        }
      });
    });
  }

  public async run(sql: string, params: unknown[] = []): Promise<{ changes: number; lastID: number }> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject(new Error('Database not connected'));
      }

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes, lastID: this.lastID });
        }
      });
    });
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
