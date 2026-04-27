import { Telegraf, Markup } from 'telegraf';
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
  private activeChats: Map<string, string> = new Map(); // adminId -> "chatType_userEmail"

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

    // Handle inline button callbacks
    this.bot.action(/^reply_(support|premium)_(.+)$/, async (ctx): Promise<void> => {
      if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
        return;
      }

      const data = ctx.callbackQuery.data;
      const match = data.match(/^reply_(support|premium)_(.+)$/);

      if (!match) {
        return;
      }

      const chatType = match[1] as 'support' | 'premium';
      const userEmail = match[2];
      const chatId = String(ctx.chat?.id);

      if (!adminIds.includes(chatId)) {
        await ctx.answerCbQuery('❌ Нет доступа');
        return;
      }

      try {
        const messages = await this.supportRepository.getMessagesByUser(userEmail);

        if (messages.length === 0) {
          await ctx.answerCbQuery('📭 Нет сообщений от пользователя');
          return;
        }

        this.activeChats.set(chatId, `${chatType}_${userEmail}`);

        const chatTypeLabel = chatType === 'premium' ? '⭐ ПРЕМИУМ' : '💬 Поддержка';
        let chatHistory = `${chatTypeLabel} диалог с ${userEmail}:\n\n`;

        for (const msg of messages) {
          const time = msg.timestamp.toLocaleString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
          });
          const role = msg.role === 'user' ? '👤' : '👨‍💼';
          chatHistory += `[${time}] ${role}: ${msg.text}\n\n`;
        }

        chatHistory += '✏️ Напишите сообщение для ответа пользователю.';

        await ctx.reply(chatHistory);
        await ctx.answerCbQuery('✅ Диалог открыт');
      } catch (error) {
        logger.error('Error opening chat', { error });
        await ctx.answerCbQuery('❌ Ошибка открытия диалога');
      }
    });

    this.bot.action(/^close_(support|premium)_(.+)$/, async (ctx): Promise<void> => {
      if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
        return;
      }

      const chatId = String(ctx.chat?.id);

      if (!adminIds.includes(chatId)) {
        await ctx.answerCbQuery('❌ Нет доступа');
        return;
      }

      try {
        this.activeChats.delete(chatId);
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        await ctx.answerCbQuery('✅ Диалог закрыт');
      } catch (error) {
        logger.error('Error closing chat', { error });
        await ctx.answerCbQuery('❌ Ошибка закрытия диалога');
      }
    });

    // Handle text messages from admins
    this.bot.on('text', async (ctx): Promise<void> => {
      const chatId = String(ctx.chat.id);

      if (!adminIds.includes(chatId)) {
        return;
      }

      const messageText = ctx.message.text;

      if (!messageText) {
        return;
      }

      const activeChatKey = this.activeChats.get(chatId);

      if (!activeChatKey) {
        return;
      }

      // Parse chat type and email
      const [chatType, ...emailParts] = activeChatKey.split('_');
      const userEmail = emailParts.join('_');

      try {
        await this.supportRepository.saveMessage({
          userEmail,
          role: 'admin',
          text: messageText,
          timestamp: new Date(),
        });

        await ctx.reply('✅ Ответ отправлен пользователю!');
        logger.info('Admin replied to user', { userEmail, chatType, admin: chatId });
      } catch (error) {
        logger.error('Error sending admin reply', { error });
        await ctx.reply('❌ Ошибка отправки ответа.');
      }
    });
  }

  public async sendMessageToAdmin(userEmail: string, message: string, adminId: string, chatType: 'support' | 'premium' = 'support'): Promise<void> {
    try {
      if (!adminId || adminId.trim() === '') {
        logger.error('Admin ID is empty or invalid', { adminId });
        throw new Error('Invalid admin ID');
      }

      const chatTypeLabel = chatType === 'premium' ? '⭐ ПРЕМИУМ' : '💬 Поддержка';
      const messageToAdmin =
        `📨 Новое сообщение в ${chatTypeLabel}!\n\n` +
        `👤 От: ${userEmail}\n` +
        `🕐 ${new Date().toLocaleString('ru-RU')}\n\n` +
        `💬 ${message}`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('💬 Ответить', `reply_${chatType}_${userEmail}`),
          Markup.button.callback('❌ Закрыть', `close_${chatType}_${userEmail}`)
        ]
      ]);

      logger.info('Attempting to send message to admin', { userEmail, adminId, chatType, messageLength: message.length });

      await this.bot.telegram.sendMessage(adminId, messageToAdmin, keyboard);

      logger.info('Message sent to admin successfully', { userEmail, adminId, chatType });
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

      // Test connection first
      try {
        const botInfo = await this.bot.telegram.getMe();
        logger.info('Bot token is valid', { botInfo: botInfo.username });
      } catch (error) {
        logger.error('Bot token validation failed', { error });
        throw new Error('Invalid bot token or Telegram API is unreachable');
      }

      // Launch bot with polling to handle button callbacks
      await this.bot.launch();
      logger.info('✅ Telegram support bot started with polling');
    } catch (error) {
      logger.error('❌ Failed to launch Telegram bot', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      logger.warn('⚠️ Application will continue without Telegram bot support');
    }
  }

  public stop(): void {
    this.bot.stop();
    logger.info('Telegram support bot stopped');
  }
}
