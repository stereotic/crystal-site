import { Telegraf, Markup } from 'telegraf';
import { inject, injectable } from 'tsyringe';
import { configService } from '../../../config';
import { logger } from '../logger';
import { DatabaseConnection } from '../database/DatabaseConnection';

interface DepositRequest {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  wallet_address: string;
  worker_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: number;
  notification_sent: number;
}

@injectable()
export class TelegramControlBot {
  private bot: Telegraf;
  private controlChatId: string;

  constructor(
    @inject(DatabaseConnection) private db: DatabaseConnection
  ) {
    const config = configService.get();
    const botToken = config.telegram.controlBotToken;
    this.controlChatId = config.telegram.controlChatId;

    logger.info('Initializing TelegramControlBot', {
      tokenLength: botToken?.length || 0,
      tokenPrefix: botToken?.substring(0, 10) || 'missing',
      controlChatId: this.controlChatId
    });

    this.bot = new Telegraf(botToken);
    this.setupHandlers();
  }

  private setupHandlers(): void {
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

          // Get username for message
          const user = await this.db.get<{ username: string }>(
            'SELECT username FROM users WHERE id = ?',
            [request.user_id]
          );

          // Update message
          await ctx.editMessageText(
            `✅ Платеж подтвержден!\n\n` +
            `Мамонт: ${user?.username || 'Unknown'}\n` +
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

          // Get username for message
          const user = await this.db.get<{ username: string }>(
            'SELECT username FROM users WHERE id = ?',
            [request.user_id]
          );

          // Update message
          await ctx.editMessageText(
            `❌ Платеж отклонен!\n\n` +
            `Мамонт: ${user?.username || 'Unknown'}\n` +
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
      logger.info('Launching Telegram control bot...');

      // Test connection with retry
      let retries = 3;
      let botInfo;
      while (retries > 0) {
        try {
          botInfo = await this.bot.telegram.getMe();
          logger.info('Control bot token is valid', { botInfo: botInfo.username });
          break;
        } catch (error) {
          retries--;
          if (retries === 0) {
            logger.error('Control bot token validation failed after retries', { error });
            throw new Error('Invalid bot token or Telegram API is unreachable');
          }
          logger.warn(`Retrying bot connection... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Launch bot in polling mode to receive callback queries
      await this.bot.launch({
        dropPendingUpdates: true, // Ignore old updates
      });
      logger.info('✅ Telegram control bot started in polling mode');
    } catch (error) {
      logger.error('❌ Failed to initialize Telegram control bot', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      logger.warn('⚠️ Application will continue without Telegram control bot support');
      logger.warn('💡 Note: Bot can still send messages, but buttons may not work without polling');
    }
  }

  public stop(): void {
    this.bot.stop();
    logger.info('Telegram control bot stopped');
  }
}
