import { Telegraf, Markup } from 'telegraf';
import { inject, injectable } from 'tsyringe';
import { configService } from '../../../config';
import { logger } from '../logger';
import { DatabaseConnection } from '../database/DatabaseConnection';

interface DepositRequest {
  id: string;
  userId: string;
  username: string;
  amount: number;
  currency: string;
  walletAddress: string;
  workerId: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
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
            [request.amount * 100, request.userId]
          );

          // Update message
          await ctx.editMessageText(
            `✅ Платеж подтвержден!\n\n` +
            `Мамонт: ${request.username}\n` +
            `Сумма: $${request.amount}\n` +
            `Адрес: ${request.walletAddress}\n` +
            `Воркер: ${request.workerId ? `@${request.workerId}` : 'Не назначен'}\n\n` +
            `Статус: ОДОБРЕН`,
            { parse_mode: 'HTML' }
          );

          await ctx.answerCbQuery('✅ Платеж подтвержден');
          logger.info('Deposit approved', { requestId, userId: request.userId, amount: request.amount });
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
            `Адрес: ${request.walletAddress}\n` +
            `Воркер: ${request.workerId ? `@${request.workerId}` : 'Не назначен'}\n\n` +
            `Статус: ОТКЛОНЕН`,
            { parse_mode: 'HTML' }
          );

          await ctx.answerCbQuery('❌ Платеж отклонен');
          logger.info('Deposit rejected', { requestId, userId: request.userId });
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

  public async start(): Promise<void> {
    try {
      logger.info('Launching Telegram control bot...');

      const launchPromise = this.bot.launch();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Bot launch timeout after 10 seconds')), 10000)
      );

      await Promise.race([launchPromise, timeoutPromise]);
      logger.info('✅ Telegram control bot launched successfully');
    } catch (error) {
      logger.error('❌ Failed to launch Telegram control bot', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  public stop(): void {
    this.bot.stop();
    logger.info('Telegram control bot stopped');
  }
}
