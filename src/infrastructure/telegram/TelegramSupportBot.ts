import { Telegraf } from 'telegraf';
import { inject, injectable } from 'tsyringe';
import { configService } from '../../../config';
import { logger } from '../logger';
import { ISupportRepository } from '../../domain/repositories';

interface SupportBotConfig {
  token: string;
  adminIds: string[];
  webhookSecret: string;
}

@injectable()
export class TelegramSupportBot {
  private bot: Telegraf;
  private activeChats: Map<string, string> = new Map();

  constructor(
    @inject('ISupportRepository') private supportRepository: ISupportRepository
  ) {
    const config = configService.get();
    const botToken = config.telegram.supportBotToken;

    logger.info('Initializing TelegramSupportBot', {
      tokenLength: botToken?.length || 0,
      tokenPrefix: botToken?.substring(0, 10) || 'missing',
      adminIdsCount: config.telegram.adminIds.length,
      adminIds: config.telegram.adminIds
    });

    this.bot = new Telegraf(botToken);
    this.setupHandlers(config.telegram.adminIds);
  }

  private setupHandlers(adminIds: string[]): void {
    // Command: /support - show active chats
    this.bot.command('support', async (ctx): Promise<void> => {
      const chatId = String(ctx.chat.id);

      if (!adminIds.includes(chatId)) {
        return;
      }

      try {
        const messages = await this.supportRepository.getAllMessages();

        // Group by user
        const userChats = new Map<string, number>();
        messages.forEach(msg => {
          userChats.set(msg.userEmail, msg.timestamp.getTime());
        });

        if (userChats.size === 0) {
          await ctx.reply('📭 Нет активных диалогов поддержки.');
          return;
        }

        let message = '📋 Активные диалоги поддержки:\n\n';
        let index = 1;

        for (const [email, time] of userChats.entries()) {
          const date = new Date(time).toLocaleString('ru-RU');
          message += `${index}. ${email}\n   🕐 ${date}\n\n`;
          index++;
        }

        await ctx.reply(message);
      } catch (error) {
        logger.error('Error in /support command', { error });
        await ctx.reply('❌ Ошибка получения списка диалогов.');
      }
    });

    // Handle replies from admins
    this.bot.on('message', async (ctx): Promise<void> => {
      const chatId = String(ctx.chat.id);

      if (!adminIds.includes(chatId)) {
        return;
      }

      if (!ctx.message || !('reply_to_message' in ctx.message)) {
        return;
      }

      const userEmail = this.activeChats.get(chatId);
      if (!userEmail) {
        await ctx.reply('❌ Не найден активный диалог. Используйте /support для просмотра.');
        return;
      }

      try {
        let messageText = '';

        if ('text' in ctx.message) {
          messageText = ctx.message.text;
        } else if ('caption' in ctx.message) {
          messageText = ctx.message.caption || '[Медиа]';
        }

        if (!messageText) {
          return;
        }

        await this.supportRepository.saveMessage({
          userEmail,
          role: 'admin',
          text: messageText,
          timestamp: new Date(),
        });

        await ctx.reply('✅ Ответ отправлен пользователю!');
        logger.info('Admin replied to user', { userEmail, admin: chatId });
      } catch (error) {
        logger.error('Error sending admin reply', { error });
        await ctx.reply('❌ Ошибка отправки ответа.');
      }
    });
  }

  public async sendMessageToAdmin(userEmail: string, message: string, adminId: string): Promise<void> {
    try {
      if (!adminId || adminId.trim() === '') {
        logger.error('Admin ID is empty or invalid', { adminId });
        throw new Error('Invalid admin ID');
      }

      const messageToAdmin = `📨 Новое сообщение от пользователя:\n\n👤 ${userEmail}\n🕐 ${new Date().toLocaleString('ru-RU')}\n\n💬 ${message}`;

      logger.info('Attempting to send message to admin', { userEmail, adminId, messageLength: message.length });

      await this.bot.telegram.sendMessage(adminId, messageToAdmin);
      this.activeChats.set(adminId, userEmail);

      logger.info('Message sent to admin successfully', { userEmail, adminId });
    } catch (error) {
      logger.error('Failed to send message to admin', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userEmail,
        adminId
      });
      throw error;
    }
  }

  public async start(): Promise<void> {
    try {
      logger.info('Launching Telegram bot...');

      // Add timeout to prevent hanging
      const launchPromise = this.bot.launch();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Bot launch timeout after 10 seconds')), 10000)
      );

      await Promise.race([launchPromise, timeoutPromise]);
      logger.info('✅ Telegram support bot launched successfully');
    } catch (error) {
      logger.error('❌ Failed to launch Telegram bot', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  public stop(): void {
    this.bot.stop();
    logger.info('Telegram support bot stopped');
  }
}
