import { injectable, inject } from 'tsyringe';
import { ISupportRepository, SupportMessage } from '../../domain/repositories';
import { DatabaseConnection } from './DatabaseConnection';

interface MessageRow {
  id: string;
  user_email: string;
  role: string;
  text: string;
  file_id: string | null;
  file_type: string | null;
  time: number;
}

@injectable()
export class SupportRepository implements ISupportRepository {
  constructor(
    @inject(DatabaseConnection) private db: DatabaseConnection
  ) {}

  async saveMessage(message: Omit<SupportMessage, 'id'>): Promise<void> {
    const id = crypto.randomUUID();
    await this.db.run(
      `INSERT INTO messages (id, user_email, role, text, file_id, file_type, time)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        message.userEmail,
        message.role,
        message.text,
        message.fileId || null,
        message.fileType || null,
        message.timestamp.getTime(),
      ]
    );
  }

  async getMessagesByUser(userEmail: string): Promise<SupportMessage[]> {
    const rows = await this.db.query<MessageRow>(
      'SELECT * FROM messages WHERE user_email = ? ORDER BY time ASC',
      [userEmail]
    );

    return rows.map(this.mapToDomain);
  }

  async getAllMessages(): Promise<SupportMessage[]> {
    const rows = await this.db.query<MessageRow>(
      'SELECT * FROM messages ORDER BY time DESC LIMIT 100'
    );

    return rows.map(this.mapToDomain);
  }

  private mapToDomain(row: MessageRow): SupportMessage {
    return {
      id: row.id,
      userEmail: row.user_email,
      role: row.role as 'user' | 'admin',
      text: row.text,
      fileId: row.file_id || undefined,
      fileType: row.file_type || undefined,
      timestamp: new Date(row.time),
    };
  }
}
