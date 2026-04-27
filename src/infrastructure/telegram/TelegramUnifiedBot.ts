import { Telegraf, Markup, Context, session } from 'telegraf';
import { inject, injectable } from 'tsyringe';
import { configService } from '../../../config';
import { logger } from '../logger';
import { DatabaseConnection } from '../database/DatabaseConnection';

interface SessionData {
  replyTo?: string;
}

interface BotContext extends Context {
  session?: SessionData;
}

interface DepositRequest {
  id: string;
  user_id: string;
  username: string;
  amount: number;
  currency: string;
  wallet_address: string;
  worker_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: Date;
}

@injectable()
export class TelegramUnifiedBot {
  private bot: Telegraf<BotContext>;
  private controlChatId: string;
  private adminIds: string[];
  private replyMode: Map<string, string> = new Map(); // adminId -> targetUsername

  constructor(
    @inject(DatabaseConnection) private db: DatabaseConnection
  ) {
    const config = configService.get();
    const botToken = config.telegram.supportBotToken; // Используем один токен
    this.controlChatId = config.telegram.controlChatId;
    this.adminIds = config.telegram.adminIds;

    logger.info('Initializing Unified Telegram Bot', {
      tokenLength: botToken?.length || 0,
      tokenPrefix: botToken?.substring(0, 10) || 'missing',
      controlChatId: this.controlChatId,
      adminIdsCount: this.adminIds.length
    });

    this.bot = new Telegraf(botToken);
    this.bot.use(session());
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // ==================== DEPOSIT CONTROL HANDLERS ====================

    // Handle callback queries for approve/reject buttons
    this.bot.action(/^(approve|reject)_(.+)$/, async (ctx) => {
      try {
        const action = ctx.match[1];
        const requestId = ctx.match[2];

        logger.info('Payment action received', { action, requestId });

        // Get deposit request from database
        const request = await this.db.get<DepositRequest>(
          'SELECT * FROM deposit_requests WHERE id = ?',
          [requestId]
        );

        if (!request) {
          await ctx.answerCbQuery('❌ Запрос не найден');
          return;
        }

        if (request.status !== 'pending') {
          await ctx.answerCbQuery('⚠️ Запрос уже обработан');
          return;
        }

        if (action === 'approve') {
          // Update deposit status
          await this.db.run(
            'UPDATE deposit_requests SET status = ? WHERE id = ?',
            ['approved', requestId]
          );

          // Add balance to user
          logger.info('Updating user balance', {
            userId: request.user_id,
            username: request.username,
            amountCents: request.amount * 100,
            sql: 'UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?'
          });

          await this.db.run(
            'UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?',
            [request.amount * 100, request.user_id]
          );

          // Verify the update
          const updatedUser = await this.db.get<{ id: string; username: string; balance_cents: number }>(
            'SELECT id, username, balance_cents FROM users WHERE id = ?',
            [request.user_id]
          );

          logger.info('Balance updated successfully', {
            userId: updatedUser?.id,
            username: updatedUser?.username,
            newBalanceCents: updatedUser?.balance_cents
          });

          // Update message
          await ctx.editMessageText(
            `✅ Платеж подтвержден!\n\n` +
            `Мамонт: ${request.username}\n` +
            `Сумма: $${request.amount}\n` +
            `Адрес: ${request.wallet_address}\n` +
            `Воркер: ${request.worker_id ? `@${request.worker_id}` : 'Не назначен'}\n\n` +
            `Статус: ОДОБРЕН`,
            { parse_mode: 'HTML' }
          );

          await ctx.answerCbQuery('✅ Платеж подтвержден');
          logger.info('Deposit approved', { requestId, userId: request.user_id, amount: request.amount });
        } else {
          // Update deposit status
          await this.db.run(
            'UPDATE deposit_requests SET status = ? WHERE id = ?',
            ['rejected', requestId]
          );

          // Update message
          await ctx.editMessageText(
            `❌ Платеж отклонен!\n\n` +
            `Мамонт: ${request.username}\n` +
            `Сумма: $${request.amount}\n` +
            `Адрес: ${request.wallet_address}\n` +
            `Воркер: ${request.worker_id ? `@${request.worker_id}` : 'Не назначен'}\n\n` +
            `Статус: ОТКЛОНЕН`,
            { parse_mode: 'HTML' }
          );

          await ctx.answerCbQuery('❌ Платеж отклонен');
          logger.info('Deposit rejected', { requestId, userId: request.user_id });
        }
      } catch (error) {
        logger.error('Error handling payment action', { error });
        await ctx.answerCbQuery('❌ Ошибка обработки');
      }
    });

    // ==================== PREMIUM CHAT HANDLERS ====================

    // Handle /reply command for premium messages
    this.bot.command('reply', async (ctx) => {
      try {
        // Extract message after /reply command
        const text = ctx.message.text;
        const replyMessage = text.replace('/reply', '').trim();

        if (!replyMessage) {
          await ctx.reply('❌ Использование: /reply <ваше сообщение>');
          return;
        }

        logger.info('Admin reply via command', { message: replyMessage });

        // Save admin reply to database
        await this.db.run(
          'INSERT INTO premium_messages (user_id, username, message, time) VALUES (?, ?, ?, ?)',
          [0, 'Admin', replyMessage, new Date().toISOString()]
        );

        await ctx.reply('✅ Ваш ответ отправлен в премиум чат');
        logger.info('Admin reply sent to premium chat', { message: replyMessage });
      } catch (error) {
        logger.error('Error handling admin reply command', { error });
        await ctx.reply('❌ Ошибка при отправке сообщения');
      }
    });

    // ==================== PREMIUM CHAT HANDLERS ====================

    // Handle inline button for premium chat replies
    this.bot.action(/^reply_premium_(.+)$/, async (ctx) => {
      try {
        const targetUserId = ctx.match[1];
        const adminId = ctx.from.id.toString();

        logger.info('Admin clicked reply button for premium chat', { adminId, targetUserId });

        // Set reply mode
        this.replyMode.set(adminId, `premium_${targetUserId}`);

        await ctx.answerCbQuery('✅ Режим ответа активирован');
        await ctx.reply(
          `✏️ Режим ответа активирован для пользователя (ID: ${targetUserId})\n\n` +
          `Отправьте ваше сообщение, и оно будет доставлено в премиум чат.`
        );
      } catch (error) {
        logger.error('Error handling premium reply button', { error });
        await ctx.answerCbQuery('❌ Ошибка');
      }
    });

    // Handle close button for premium chat
    this.bot.action(/^close_premium_(.+)$/, async (ctx) => {
      try {
        const userId = ctx.from.id.toString();

        // Clear reply mode if active
        this.replyMode.delete(userId);

        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        await ctx.answerCbQuery('✅ Диалог закрыт');
      } catch (error) {
        logger.error('Error handling premium close button', { error });
        await ctx.answerCbQuery('❌ Ошибка');
      }
    });

    // Handle inline button for support chat replies
    this.bot.action(/^reply_support_(.+)$/, async (ctx) => {
      try {
        const targetUserEmail = ctx.match[1];
        const adminId = ctx.from.id.toString();

        logger.info('Admin clicked reply button for support', { adminId, targetUserEmail });

        // Set reply mode
        this.replyMode.set(adminId, `support_${targetUserEmail}`);

        await ctx.answerCbQuery('✅ Режим ответа активирован');
        await ctx.reply(
          `✏️ Режим ответа активирован для пользователя: ${targetUserEmail}\n\n` +
          `Отправьте ваше сообщение, и оно будет доставлено в техподдержку.`
        );
      } catch (error) {
        logger.error('Error handling support reply button', { error });
        await ctx.answerCbQuery('❌ Ошибка');
      }
    });

    // Handle close button for support chat
    this.bot.action(/^close_support_(.+)$/, async (ctx) => {
      try {
        const adminId = ctx.from.id.toString();

        // Clear reply mode if active
        this.replyMode.delete(adminId);

        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        await ctx.answerCbQuery('✅ Диалог закрыт');
      } catch (error) {
        logger.error('Error handling support close button', { error });
        await ctx.answerCbQuery('❌ Ошибка');
      }
    });

    // ==================== SUPPORT CHAT HANDLERS ====================

    // Handle text messages (support chat and admin replies)
    this.bot.on('text', async (ctx) => {
      const userId = ctx.from.id.toString();
      const username = ctx.from.username || ctx.from.first_name || 'Unknown';
      const text = ctx.message.text;

      // Check if message is from admin
      if (this.adminIds.includes(userId)) {
        // Check if admin is in reply mode
        const replyTarget = this.replyMode.get(userId);

        if (replyTarget) {
          try {
            // Check if replying to premium chat or support
            if (replyTarget.startsWith('premium_')) {
              const targetUserId = replyTarget.replace('premium_', '');

              // Save admin reply to premium_messages with target user_id (keep as string for UUID support)
              await this.db.run(
                'INSERT INTO premium_messages (user_id, username, message, time) VALUES (?, ?, ?, ?)',
                [targetUserId, 'Admin', text, new Date().toISOString()]
              );

              await ctx.reply('✅ Ваш ответ отправлен в премиум чат');
              logger.info('Admin reply sent to premium chat', { targetUserId, message: text });
            } else if (replyTarget.startsWith('support_')) {
              const targetUserEmail = replyTarget.replace('support_', '');

              // Save admin reply to messages table
              await this.db.run(
                'INSERT INTO messages (user_email, role, text, time) VALUES (?, ?, ?, ?)',
                [targetUserEmail, 'admin', text, Date.now()]
              );

              await ctx.reply('✅ Ваш ответ отправлен в техподдержку');
              logger.info('Admin reply sent to support', { targetUserEmail, message: text });
            }

            // Clear reply mode
            this.replyMode.delete(userId);
          } catch (error) {
            logger.error('Error sending admin reply', { error });
            await ctx.reply('❌ Ошибка при отправке сообщения');
          }
          return;
        }

        // Admin message without reply mode - ignore
        return;
      }

      // Regular user message - save to support_messages
      try {
        await this.db.run(
          `INSERT INTO support_messages (user_id, username, message, timestamp, is_admin)
           VALUES (?, ?, ?, ?, ?)`,
          [userId, username, text, Date.now(), 0]
        );

        // Send notification with inline buttons to all admins
        const notificationText = `💬 Новое сообщение в техподдержку\n\n` +
          `👤 От: ${username} (ID: ${userId})\n` +
          `💬 Сообщение: ${text}`;

        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback('💬 Ответить', `reply_support_${userId}`),
            Markup.button.callback('❌ Закрыть', `close_support_${userId}`)
          ]
        ]);

        // Send to all admins
        for (const adminId of this.adminIds) {
          await this.bot.telegram.sendMessage(adminId, notificationText, keyboard);
        }

        await ctx.reply('✅ Ваше сообщение отправлено в поддержку. Мы ответим в ближайшее время.');
        logger.info('Support message received', { userId, username });
      } catch (error) {
        logger.error('Error handling support message', { error });
        await ctx.reply('❌ Ошибка отправки сообщения. Попробуйте позже.');
      }
    });

    // Handle /start command
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        '👋 Добро пожаловать в поддержку Crystal Cards!\n\n' +
        'Отправьте ваше сообщение, и мы ответим в ближайшее время.'
      );
    });
  }

  public async sendPaymentNotification(
    requestId: string,
    username: string,
    amount: number,
    walletAddress: string,
    workerId: string | null
  ): Promise<void> {
    try {
      if (!this.controlChatId || this.controlChatId.trim() === '') {
        logger.error('Control chat ID is empty or invalid');
        throw new Error('Invalid control chat ID');
      }

      const message =
        `💰 Новый платеж!\n\n` +
        `Мамонт: ${username}\n` +
        `Сумма: $${amount}\n` +
        `Адрес: ${walletAddress}\n` +
        `Воркер: ${workerId ? `@${workerId}` : 'Не назначен'}`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Подтвердить', `approve_${requestId}`),
          Markup.button.callback('❌ Отклонить', `reject_${requestId}`)
        ]
      ]);

      logger.info('Sending payment notification', {
        requestId,
        username,
        amount,
        controlChatId: this.controlChatId
      });

      await this.bot.telegram.sendMessage(this.controlChatId, message, keyboard);

      logger.info('Payment notification sent successfully', { requestId });
    } catch (error) {
      logger.error('Failed to send payment notification', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        requestId,
        username
      });
      throw error;
    }
  }

  public async handleUpdate(update: any): Promise<void> {
    try {
      await this.bot.handleUpdate(update);
    } catch (error) {
      logger.error('Error handling webhook update', { error });
    }
  }

  public async start(): Promise<void> {
    try {
      logger.info('Launching Unified Telegram Bot...');

      // Test connection with retry
      let retries = 3;
      let botInfo;
      while (retries > 0) {
        try {
          botInfo = await this.bot.telegram.getMe();
          logger.info('Bot token is valid', { botInfo: botInfo.username });
          break;
        } catch (error) {
          retries--;
          if (retries === 0) {
            logger.error('Bot token validation failed after retries', { error });
            throw new Error('Invalid bot token or Telegram API is unreachable');
          }
          logger.warn(`Retrying bot connection... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Launch bot in polling mode
      await this.bot.launch({
        dropPendingUpdates: true, // Ignore old updates
      });

      // Handle graceful shutdown
      process.once('SIGINT', () => this.bot.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot.stop('SIGTERM'));

      logger.info('✅ Unified Telegram Bot started in polling mode');
      logger.info('📱 Bot handles: deposit approvals + support chat');
    } catch (error) {
      logger.error('❌ Failed to initialize Unified Telegram Bot', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      logger.warn('⚠️ Application will continue without Telegram bot support');
      logger.warn('💡 Note: Bot can still send messages, but interactive features may not work');
    }
  }

  public stop(): void {
    try {
      this.bot.stop();
      logger.info('Unified Telegram Bot stopped');
    } catch (error) {
      logger.error('Error stopping bot', { error });
    }
  }

  // Notify about premium chat message
  public async notifyPremiumMessage(userId: string | number, username: string, message: string): Promise<void> {
    try {
      const text = `⭐ ПРЕМИУМ чат\n\n` +
        `👤 User: ${username}\n` +
        `💬 Message: ${message}`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('💬 Ответить', `reply_premium_${userId}`),
          Markup.button.callback('❌ Закрыть', `close_premium_${userId}`)
        ]
      ]);

      // Send to all admins
      for (const adminId of this.adminIds) {
        await this.bot.telegram.sendMessage(adminId, text, keyboard);
      }

      logger.info('Premium message notification sent to Telegram', { userId, username });
    } catch (error) {
      logger.error('Failed to send premium message notification', { error });
      throw error;
    }
  }

  // Send message to admin (for support messages from website)
  public async sendMessageToAdmin(userEmail: string, message: string, adminId: string, chatType: 'support' | 'premium' = 'support'): Promise<void> {
    try {
      const chatTypeLabel = chatType === 'premium' ? '⭐ ПРЕМИУМ' : '💬 Поддержка';
      const text = `📨 Новое сообщение в ${chatTypeLabel}!\n\n` +
        `👤 От: ${userEmail}\n` +
        `🕐 ${new Date().toLocaleString('ru-RU')}\n\n` +
        `💬 ${message}`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('💬 Ответить', `reply_${chatType}_${userEmail}`),
          Markup.button.callback('❌ Закрыть', `close_${chatType}_${userEmail}`)
        ]
      ]);

      // Send to all admins
      for (const adminId of this.adminIds) {
        await this.bot.telegram.sendMessage(adminId, text, keyboard);
      }

      logger.info('Message sent to admin successfully', { userEmail, chatType });
    } catch (error) {
      logger.error('Failed to send message to admin', { error, userEmail });
      throw error;
    }
  }
}
