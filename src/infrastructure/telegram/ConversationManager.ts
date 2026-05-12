import { injectable, inject } from 'tsyringe';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { logger } from '../logger';

export interface Conversation {
  id: number;
  userIdentifier: string;
  chatType: 'support' | 'premium';
  status: 'open' | 'closed';
  lastMessageAt: number;
  createdAt: number;
  closedAt?: number;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderType: 'user' | 'admin';
  senderId: string;
  message: string;
  telegramMessageId?: number;
  createdAt: number;
}

@injectable()
export class ConversationManager {
  constructor(
    @inject(DatabaseConnection) private db: DatabaseConnection
  ) {}

  /**
   * Get or create an active conversation for a user
   */
  async getOrCreateConversation(
    userIdentifier: string,
    chatType: 'support' | 'premium'
  ): Promise<Conversation> {
    // Try to find an open conversation
    const existing = await this.db.get<{
      id: number;
      user_identifier: string;
      chat_type: string;
      status: string;
      last_message_at: number;
      created_at: number;
      closed_at: number | null;
    }>(
      `SELECT * FROM conversations
       WHERE user_identifier = ? AND chat_type = ? AND status = 'open'
       ORDER BY created_at DESC LIMIT 1`,
      [userIdentifier, chatType]
    );

    if (existing) {
      return {
        id: existing.id,
        userIdentifier: existing.user_identifier,
        chatType: existing.chat_type as 'support' | 'premium',
        status: existing.status as 'open' | 'closed',
        lastMessageAt: existing.last_message_at,
        createdAt: existing.created_at,
        closedAt: existing.closed_at || undefined
      };
    }

    // Create new conversation
    const now = Date.now();
    const result = await this.db.run(
      `INSERT INTO conversations (user_identifier, chat_type, status, last_message_at, created_at)
       VALUES (?, ?, 'open', ?, ?)`,
      [userIdentifier, chatType, now, now]
    );

    logger.info('New conversation created', {
      conversationId: result.lastID,
      userIdentifier,
      chatType
    });

    return {
      id: result.lastID!,
      userIdentifier,
      chatType,
      status: 'open',
      lastMessageAt: now,
      createdAt: now
    };
  }

  /**
   * Save a message to a conversation
   */
  async saveMessage(
    conversationId: number,
    senderType: 'user' | 'admin',
    senderId: string,
    message: string,
    telegramMessageId?: number
  ): Promise<void> {
    const now = Date.now();

    await this.db.run(
      `INSERT INTO chat_messages (conversation_id, sender_type, sender_id, message, telegram_message_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [conversationId, senderType, senderId, message, telegramMessageId || null, now]
    );

    // Update conversation last_message_at
    await this.db.run(
      `UPDATE conversations SET last_message_at = ? WHERE id = ?`,
      [now, conversationId]
    );

    logger.info('Message saved to conversation', {
      conversationId,
      senderType,
      senderId
    });
  }

  /**
   * Close a conversation
   */
  async closeConversation(conversationId: number): Promise<void> {
    const now = Date.now();

    await this.db.run(
      `UPDATE conversations SET status = 'closed', closed_at = ? WHERE id = ?`,
      [now, conversationId]
    );

    logger.info('Conversation closed', { conversationId });
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: number): Promise<Conversation | null> {
    const row = await this.db.get<{
      id: number;
      user_identifier: string;
      chat_type: string;
      status: string;
      last_message_at: number;
      created_at: number;
      closed_at: number | null;
    }>(
      `SELECT * FROM conversations WHERE id = ?`,
      [conversationId]
    );

    if (!row) return null;

    return {
      id: row.id,
      userIdentifier: row.user_identifier,
      chatType: row.chat_type as 'support' | 'premium',
      status: row.status as 'open' | 'closed',
      lastMessageAt: row.last_message_at,
      createdAt: row.created_at,
      closedAt: row.closed_at || undefined
    };
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: number, limit: number = 50): Promise<ChatMessage[]> {
    const rows = await this.db.query<{
      id: number;
      conversation_id: number;
      sender_type: string;
      sender_id: string;
      message: string;
      telegram_message_id: number | null;
      created_at: number;
    }>(
      `SELECT * FROM chat_messages
       WHERE conversation_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [conversationId, limit]
    );

    return rows.map(row => ({
      id: row.id,
      conversationId: row.conversation_id,
      senderType: row.sender_type as 'user' | 'admin',
      senderId: row.sender_id,
      message: row.message,
      telegramMessageId: row.telegram_message_id || undefined,
      createdAt: row.created_at
    })).reverse();
  }

  /**
   * Find active conversation by user identifier and chat type
   */
  async findActiveConversation(
    userIdentifier: string,
    chatType: 'support' | 'premium'
  ): Promise<Conversation | null> {
    const row = await this.db.get<{
      id: number;
      user_identifier: string;
      chat_type: string;
      status: string;
      last_message_at: number;
      created_at: number;
      closed_at: number | null;
    }>(
      `SELECT * FROM conversations
       WHERE user_identifier = ? AND chat_type = ? AND status = 'open'
       ORDER BY created_at DESC LIMIT 1`,
      [userIdentifier, chatType]
    );

    if (!row) return null;

    return {
      id: row.id,
      userIdentifier: row.user_identifier,
      chatType: row.chat_type as 'support' | 'premium',
      status: row.status as 'open' | 'closed',
      lastMessageAt: row.last_message_at,
      createdAt: row.created_at,
      closedAt: row.closed_at || undefined
    };
  }
}
