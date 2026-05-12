import { Telegraf, Markup, Context } from 'telegraf';
import { inject, injectable } from 'tsyringe';
import { configService } from '../../../config';
import { logger } from '../logger';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { ConversationManager } from './ConversationManager';

interface DepositRequest {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  wallet_address: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: Date;
}

interface AdminSession {
  activeConversationId?: number;
  pendingWalletChange?: string;
}

@injectable()
export class TelegramUnifiedBot {
  private bot: Telegraf;
  private controlChatId: string;
  private adminIds: string[];
  private adminSessions: Map<string, AdminSession> = new Map();

  constructor(
    @inject(DatabaseConnection) private db: DatabaseConnection,
    @inject(ConversationManager) private conversationManager: ConversationManager
  ) {
    const config = configService.get();
    const botToken = config.telegram.supportBotToken;
    this.controlChatId = config.telegram.controlChatId;
    this.adminIds = config.telegram.adminIds;

    logger.info('Initializing Unified Telegram Bot', {
      tokenLength: botToken?.length || 0,
      controlChatId: this.controlChatId,
      adminIdsCount: this.adminIds.length
    });

    this.bot = new Telegraf(botToken);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Set bot commands
    this.bot.telegram.setMyCommands([
      { command: 'start', description: '👋 Start bot' },
      { command: 'wallets', description: '💼 Manage wallet addresses' },
      { command: 'cancel', description: '❌ Cancel current operation' }
    ]).catch(err => logger.error('Failed to set bot commands', { err }));

    // Log all updates for debugging
    this.bot.use(async (ctx, next) => {
      logger.info('Bot update received', {
        updateType: ctx.updateType,
        hasCallbackQuery: !!ctx.callbackQuery,
        callbackData: (ctx.callbackQuery && 'data' in ctx.callbackQuery) ? ctx.callbackQuery.data : undefined,
        from: ctx.from?.id
      });
      return next();
    });

    // ==================== START COMMAND ====================
    this.bot.command('start', async (ctx) => {
      const userId = ctx.from.id.toString();

      if (this.adminIds.includes(userId)) {
        await ctx.reply(
          '👋 <b>Welcome, Admin!</b>\n\n' +
          '🎛 <b>Available Commands:</b>\n' +
          '/wallets - Manage deposit addresses\n' +
          '/cancel - Cancel current operation\n\n' +
          '💡 You will receive notifications for:\n' +
          '• Support messages\n' +
          '• Premium chat messages\n' +
          '• Payment verification requests',
          { parse_mode: 'HTML' }
        );
      } else {
        await ctx.reply(
          '👋 <b>Welcome to Crystal Cards Support!</b>\n\n' +
          'Send your message and we will respond shortly.',
          { parse_mode: 'HTML' }
        );
      }
    });

    // ==================== CANCEL COMMAND ====================
    this.bot.command('cancel', async (ctx) => {
      const userId = ctx.from.id.toString();

      if (this.adminIds.includes(userId)) {
        const session = this.adminSessions.get(userId);
        if (session) {
          session.activeConversationId = undefined;
          session.pendingWalletChange = undefined;
          this.adminSessions.set(userId, session);
        }
        await ctx.reply('✅ Operation cancelled');
      }
    });

    // ==================== WALLET MANAGEMENT ====================
    this.bot.command('wallets', async (ctx) => {
      const userId = ctx.from.id.toString();

      if (!this.adminIds.includes(userId)) {
        await ctx.reply('❌ Access denied');
        return;
      }

      try {
        const wallets = await this.db.query<{ id: number; currency: string; address: string }>(
          'SELECT * FROM wallets ORDER BY id'
        );

        let message = '💼 <b>Wallet Management</b>\n\n';

        if (wallets.length === 0) {
          message += '⚠️ No wallets configured';
        } else {
          wallets.forEach(wallet => {
            const currencyEmoji = this.getCurrencyEmoji(wallet.currency);
            message += `${currencyEmoji} <b>${wallet.currency}</b>\n`;
            message += `<code>${wallet.address}</code>\n\n`;
          });
        }

        message += '👇 Select a currency to update:';

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('₿ BTC', 'wallet_BTC')],
          [Markup.button.callback('Ξ ETH', 'wallet_ETH')],
          [Markup.button.callback('💵 USDT (TRC20)', 'wallet_USDT_TRC20')],
          [Markup.button.callback('💵 USDT (BEP20)', 'wallet_USDT_BEP20')]
        ]);

        await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
      } catch (error) {
        logger.error('Error showing wallets', { error });
        await ctx.reply('❌ Error loading wallets');
      }
    });

    // Handle wallet selection
    this.bot.action(/^wallet_(.+)$/, async (ctx) => {
      try {
        const currency = ctx.match[1];
        const userId = ctx.from.id.toString();

        if (!this.adminIds.includes(userId)) {
          await ctx.answerCbQuery('❌ Access denied');
          return;
        }

        // Store pending wallet change in session
        let session = this.adminSessions.get(userId) || {};
        session.pendingWalletChange = currency;
        this.adminSessions.set(userId, session);

        await ctx.answerCbQuery();
        await ctx.reply(
          `✏️ <b>Update ${currency} Address</b>\n\n` +
          `Send the new wallet address in your next message.\n\n` +
          `Use /cancel to abort.`,
          { parse_mode: 'HTML' }
        );
      } catch (error) {
        logger.error('Error handling wallet selection', { error });
        await ctx.answerCbQuery('❌ Error');
      }
    });

    // ==================== PAYMENT NOTIFICATIONS ====================

    // Add callback_query logging (with next() to pass to other handlers)
    this.bot.on('callback_query', async (ctx, next) => {
      logger.info('Callback query received', {
        data: 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined,
        from: ctx.from.id,
        messageId: ctx.callbackQuery.message?.message_id
      });
      return next(); // IMPORTANT: pass to next handler
    });

    this.bot.action(/^(approve|reject)_(.+)$/, async (ctx) => {
      try {
        const action = ctx.match[1];
        const requestId = ctx.match[2];

        logger.info('Payment action received', { action, requestId });

        const request = await this.db.get<DepositRequest>(
          'SELECT * FROM deposit_requests WHERE id = ?',
          [requestId]
        );

        if (!request) {
          await ctx.answerCbQuery('❌ Request not found');
          return;
        }

        if (request.status !== 'pending') {
          await ctx.answerCbQuery('⚠️ Already processed');
          return;
        }

        // Get user info
        const user = await this.db.get<{ username: string; worker_id: string | null }>(
          'SELECT username, worker_id FROM users WHERE id = ?',
          [request.user_id]
        );

        if (action === 'approve') {
          await this.db.run(
            'UPDATE deposit_requests SET status = ? WHERE id = ?',
            ['approved', requestId]
          );

          await this.db.run(
            'UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?',
            [request.amount * 100, request.user_id]
          );

          const updatedUser = await this.db.get<{ id: string; username: string; balance_cents: number }>(
            'SELECT id, username, balance_cents FROM users WHERE id = ?',
            [request.user_id]
          );

          logger.info('Payment approved', {
            requestId,
            userId: request.user_id,
            amount: request.amount,
            newBalance: updatedUser?.balance_cents
          });

          await ctx.editMessageText(
            `✅ <b>Payment Approved</b>\n\n` +
            `👤 User: ${user?.username || 'Unknown'}\n` +
            `💰 Amount: $${request.amount}\n` +
            `📍 Address: <code>${request.wallet_address}</code>\n` +
            `👨‍💼 Worker: ${user?.worker_id ? `@${user.worker_id}` : 'None'}\n` +
            `💳 New Balance: $${(updatedUser?.balance_cents || 0) / 100}\n\n` +
            `✅ <b>STATUS: APPROVED</b>`,
            { parse_mode: 'HTML' }
          );

          await ctx.answerCbQuery('✅ Payment approved');
        } else {
          await this.db.run(
            'UPDATE deposit_requests SET status = ? WHERE id = ?',
            ['rejected', requestId]
          );

          logger.info('Payment rejected', { requestId, userId: request.user_id });

          await ctx.editMessageText(
            `❌ <b>Payment Rejected</b>\n\n` +
            `👤 User: ${user?.username || 'Unknown'}\n` +
            `💰 Amount: $${request.amount}\n` +
            `📍 Address: <code>${request.wallet_address}</code>\n` +
            `👨‍💼 Worker: ${user?.worker_id ? `@${user.worker_id}` : 'None'}\n\n` +
            `❌ <b>STATUS: REJECTED</b>`,
            { parse_mode: 'HTML' }
          );

          await ctx.answerCbQuery('❌ Payment rejected');
        }
      } catch (error) {
        logger.error('Error handling payment action', { error });
        await ctx.answerCbQuery('❌ Error processing');
      }
    });

    // ==================== CHAT HANDLERS ====================

    // Handle reply button
    this.bot.action(/^reply_(\d+)$/, async (ctx) => {
      try {
        const conversationId = parseInt(ctx.match[1]);
        const adminId = ctx.from.id.toString();

        if (!this.adminIds.includes(adminId)) {
          await ctx.answerCbQuery('❌ Access denied');
          return;
        }

        const conversation = await this.conversationManager.getConversation(conversationId);

        if (!conversation) {
          await ctx.answerCbQuery('❌ Conversation not found');
          return;
        }

        if (conversation.status === 'closed') {
          await ctx.answerCbQuery('⚠️ Conversation is closed');
          return;
        }

        // Set active conversation in session
        let session = this.adminSessions.get(adminId) || {};
        session.activeConversationId = conversationId;
        this.adminSessions.set(adminId, session);

        await ctx.answerCbQuery('✅ Reply mode activated');
        await ctx.reply(
          `✏️ <b>Reply Mode Active</b>\n\n` +
          `📝 Conversation ID: ${conversationId}\n` +
          `👤 User: ${conversation.userIdentifier}\n` +
          `💬 Type: ${conversation.chatType}\n\n` +
          `Send your message now. Use /cancel to exit reply mode.`,
          { parse_mode: 'HTML' }
        );
      } catch (error) {
        logger.error('Error handling reply button', { error });
        await ctx.answerCbQuery('❌ Error');
      }
    });

    // Handle close button
    this.bot.action(/^close_(\d+)$/, async (ctx) => {
      try {
        const conversationId = parseInt(ctx.match[1]);
        const adminId = ctx.from.id.toString();

        if (!this.adminIds.includes(adminId)) {
          await ctx.answerCbQuery('❌ Access denied');
          return;
        }

        await this.conversationManager.closeConversation(conversationId);

        // Clear active conversation if it was this one
        const session = this.adminSessions.get(adminId);
        if (session?.activeConversationId === conversationId) {
          session.activeConversationId = undefined;
          this.adminSessions.set(adminId, session);
        }

        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        await ctx.answerCbQuery('✅ Conversation closed');

        logger.info('Conversation closed by admin', { conversationId, adminId });
      } catch (error) {
        logger.error('Error handling close button', { error });
        await ctx.answerCbQuery('❌ Error');
      }
    });

    // ==================== TEXT MESSAGE HANDLER ====================
    this.bot.on('text', async (ctx) => {
      const userId = ctx.from.id.toString();
      const username = ctx.from.username || ctx.from.first_name || 'Unknown';
      const text = ctx.message.text;

      // Check if user is admin
      if (this.adminIds.includes(userId)) {
        const session = this.adminSessions.get(userId);

        // Handle wallet address update
        if (session?.pendingWalletChange) {
          const currency = session.pendingWalletChange;
          const newAddress = text.trim();

          if (newAddress.length < 10) {
            await ctx.reply('❌ Address too short. Please try again or use /cancel');
            return;
          }

          try {
            const result = await this.db.run(
              'UPDATE wallets SET address = ? WHERE currency = ?',
              [newAddress, currency]
            );

            if (result.changes === 0) {
              await this.db.run(
                'INSERT INTO wallets (currency, address) VALUES (?, ?)',
                [currency, newAddress]
              );
            }

            session.pendingWalletChange = undefined;
            this.adminSessions.set(userId, session);

            logger.info('Wallet address updated', { currency, newAddress });

            await ctx.reply(
              `✅ <b>${currency} Address Updated</b>\n\n` +
              `<b>New Address:</b>\n<code>${newAddress}</code>\n\n` +
              `The website will now show this address to users.`,
              { parse_mode: 'HTML' }
            );
            return;
          } catch (error) {
            logger.error('Error updating wallet address', { error });
            await ctx.reply('❌ Error updating address');
            return;
          }
        }

        // Handle reply to conversation
        if (session?.activeConversationId) {
          const conversationId = session.activeConversationId;

          try {
            const conversation = await this.conversationManager.getConversation(conversationId);

            if (!conversation) {
              await ctx.reply('❌ Conversation not found. Use /cancel to exit reply mode.');
              return;
            }

            if (conversation.status === 'closed') {
              await ctx.reply('⚠️ This conversation is closed. Use /cancel to exit reply mode.');
              return;
            }

            // Save admin message
            await this.conversationManager.saveMessage(
              conversationId,
              'admin',
              userId,
              text,
              ctx.message.message_id
            );

            // Also save to legacy tables for website compatibility
            if (conversation.chatType === 'support') {
              await this.db.run(
                'INSERT INTO messages (user_email, role, text, time) VALUES (?, ?, ?, ?)',
                [conversation.userIdentifier, 'admin', text, Date.now()]
              );
            } else if (conversation.chatType === 'premium') {
              await this.db.run(
                'INSERT INTO premium_messages (user_id, username, message, time) VALUES (?, ?, ?, ?)',
                [conversation.userIdentifier, 'Admin', text, new Date().toISOString()]
              );
            }

            await ctx.reply(
              `✅ <b>Message Sent</b>\n\n` +
              `Your reply has been delivered to the user.\n\n` +
              `Send another message or use /cancel to exit reply mode.`,
              { parse_mode: 'HTML' }
            );

            logger.info('Admin reply sent', {
              conversationId,
              adminId: userId,
              chatType: conversation.chatType
            });
          } catch (error) {
            logger.error('Error sending admin reply', { error });
            await ctx.reply('❌ Error sending message');
          }
          return;
        }

        // Admin message without active session - ignore
        return;
      }

      // ==================== USER MESSAGE (SUPPORT) ====================
      try {
        // Create or get conversation
        const conversation = await this.conversationManager.getOrCreateConversation(
          userId,
          'support'
        );

        // Save user message
        await this.conversationManager.saveMessage(
          conversation.id,
          'user',
          userId,
          text,
          ctx.message.message_id
        );

        // Send notification to admins
        const notificationText =
          `💬 <b>New Support Message</b>\n\n` +
          `👤 User: ${username}\n` +
          `🆔 ID: ${userId}\n` +
          `📝 Conversation: #${conversation.id}\n\n` +
          `💬 <i>${text}</i>`;

        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback('💬 Reply', `reply_${conversation.id}`),
            Markup.button.callback('❌ Close', `close_${conversation.id}`)
          ]
        ]);

        for (const adminId of this.adminIds) {
          await this.bot.telegram.sendMessage(adminId, notificationText, {
            parse_mode: 'HTML',
            ...keyboard
          });
        }

        await ctx.reply(
          '✅ Your message has been sent to support. We will respond shortly.',
          { parse_mode: 'HTML' }
        );

        logger.info('Support message received', {
          userId,
          username,
          conversationId: conversation.id
        });
      } catch (error) {
        logger.error('Error handling user message', { error });
        await ctx.reply('❌ Error sending message. Please try again later.');
      }
    });
  }

  /**
   * Send payment notification to control chat
   */
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
        `💰 <b>New Payment Request</b>\n\n` +
        `👤 User: ${username}\n` +
        `💵 Amount: $${amount}\n` +
        `📍 Address: <code>${walletAddress}</code>\n` +
        `👨‍💼 Worker: ${workerId ? `@${workerId}` : 'None'}`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Approve', `approve_${requestId}`),
          Markup.button.callback('❌ Reject', `reject_${requestId}`)
        ]
      ]);

      logger.info('Sending payment notification', {
        requestId,
        username,
        amount,
        controlChatId: this.controlChatId,
        keyboard: keyboard.reply_markup
      });

      const sentMessage = await this.bot.telegram.sendMessage(this.controlChatId, message, {
        parse_mode: 'HTML',
        ...keyboard
      });

      logger.info('Payment notification sent successfully', {
        requestId,
        messageId: sentMessage.message_id,
        hasReplyMarkup: !!sentMessage.reply_markup
      });
    } catch (error) {
      logger.error('Failed to send payment notification', {
        error: error instanceof Error ? error.message : String(error),
        requestId,
        username
      });
      throw error;
    }
  }

  /**
   * Notify admins about premium chat message
   */
  public async notifyPremiumMessage(userId: string, username: string, message: string): Promise<void> {
    try {
      // Create or get conversation
      const conversation = await this.conversationManager.getOrCreateConversation(
        userId,
        'premium'
      );

      // Save user message
      await this.conversationManager.saveMessage(
        conversation.id,
        'user',
        userId,
        message
      );

      const text =
        `⭐ <b>Premium Chat Message</b>\n\n` +
        `👤 User: ${username}\n` +
        `🆔 ID: ${userId}\n` +
        `📝 Conversation: #${conversation.id}\n\n` +
        `💬 <i>${message}</i>`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('💬 Reply', `reply_${conversation.id}`),
          Markup.button.callback('❌ Close', `close_${conversation.id}`)
        ]
      ]);

      for (const adminId of this.adminIds) {
        await this.bot.telegram.sendMessage(adminId, text, {
          parse_mode: 'HTML',
          ...keyboard
        });
      }

      logger.info('Premium message notification sent', { userId, username, conversationId: conversation.id });
    } catch (error) {
      logger.error('Failed to send premium message notification', { error });
      throw error;
    }
  }

  /**
   * Send message to admin (legacy method for compatibility)
   */
  public async sendMessageToAdmin(
    userEmail: string,
    message: string,
    adminId: string,
    chatType: 'support' | 'premium' = 'support'
  ): Promise<void> {
    try {
      // Create or get conversation
      const conversation = await this.conversationManager.getOrCreateConversation(
        userEmail,
        chatType
      );

      // Save user message
      await this.conversationManager.saveMessage(
        conversation.id,
        'user',
        userEmail,
        message
      );

      const chatTypeLabel = chatType === 'premium' ? '⭐ Premium' : '💬 Support';
      const text =
        `📨 <b>New ${chatTypeLabel} Message</b>\n\n` +
        `👤 From: ${userEmail}\n` +
        `📝 Conversation: #${conversation.id}\n` +
        `🕐 ${new Date().toLocaleString('en-US')}\n\n` +
        `💬 <i>${message}</i>`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('💬 Reply', `reply_${conversation.id}`),
          Markup.button.callback('❌ Close', `close_${conversation.id}`)
        ]
      ]);

      for (const adminId of this.adminIds) {
        await this.bot.telegram.sendMessage(adminId, text, {
          parse_mode: 'HTML',
          ...keyboard
        });
      }

      logger.info('Message sent to admin successfully', { userEmail, chatType, conversationId: conversation.id });
    } catch (error) {
      logger.error('Failed to send message to admin', { error, userEmail });
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
      const config = configService.get();
      const usePolling = config.nodeEnv === 'development' || process.env.ENABLE_BOT_POLLING === 'true';

      logger.info(`Launching Unified Telegram Bot in ${usePolling ? 'POLLING' : 'WEBHOOK'} mode...`);

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

      if (usePolling) {
        logger.info('🔄 Launching bot in polling mode...');

        // Launch with timeout to prevent hanging
        const launchPromise = this.bot.launch({
          dropPendingUpdates: true,
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Bot launch timeout')), 10000)
        );

        try {
          await Promise.race([launchPromise, timeoutPromise]);
          logger.info('✅ Unified Telegram Bot started in POLLING mode');
        } catch (error) {
          logger.warn('⚠️ Bot launch timed out or failed, but bot may still work', { error });
          logger.info('✅ Unified Telegram Bot initialized (polling may be active)');
        }
      } else {
        logger.info('✅ Unified Telegram Bot initialized successfully (webhook mode)');
        logger.info('🔗 Webhook endpoint: /webhook/telegram-bot');
      }

      logger.info('📱 Bot features: Support Chat | Premium Chat | Payment Verification | Wallet Management');
    } catch (error) {
      logger.error('❌ Failed to initialize Unified Telegram Bot', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
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

  private getCurrencyEmoji(currency: string): string {
    const emojiMap: Record<string, string> = {
      'BTC': '₿',
      'ETH': 'Ξ',
      'USDT_TRC20': '💵',
      'USDT_BEP20': '💵'
    };
    return emojiMap[currency] || '💰';
  }
}
