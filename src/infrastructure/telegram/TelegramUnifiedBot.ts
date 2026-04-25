import { Telegraf, Markup, Context } from 'telegraf';
import { inject, injectable } from 'tsyringe';
import { configService } from '../../../config';
import { logger } from '../logger';
import { DatabaseConnection } from '../database/DatabaseConnection';

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
  private bot: Telegraf;
  private controlChatId: string;
  private adminIds: string[];

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
          await this.db.run(
            'UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?',
            [request.amount * 100, request.user_id]
          );

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

    // ==================== SUPPORT CHAT HANDLERS ====================

    // Handle text messages (support chat)
    this.bot.on('text', async (ctx) => {
      const userId = ctx.from.id.toString();
      const username = ctx.from.username || ctx.from.first_name || 'Unknown';
      const text = ctx.message.text;

      // Check if message is from admin
      if (this.adminIds.includes(userId)) {
        // Admin message - handle as reply to user
        if (ctx.message.reply_to_message) {
          // This is a reply to a user message
          // Extract user ID from the original message or database
          logger.info('Admin reply received', { adminId: userId, text });
          // TODO: Implement admin reply logic
        }
        return;
      }

      // Regular user message - save to database
      try {
        await this.db.run(
          `INSERT INTO support_messages (user_id, username, message, timestamp, is_admin)
           VALUES (?, ?, ?, ?, ?)`,
          [userId, username, text, Date.now(), 0]
        );

        // Forward to admin chat
        await this.bot.telegram.sendMessage(
          this.controlChatId,
          `💬 Новое сообщение от ${username} (ID: ${userId}):\n\n${text}`
        );

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
    this.bot.stop();
    logger.info('Unified Telegram Bot stopped');
  }
}
