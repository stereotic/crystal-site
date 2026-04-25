import { inject, injectable } from 'tsyringe';
import { ISupportRepository } from '../../domain/repositories';
import { SendSupportMessageDTO } from '../dtos';
import { TelegramSupportBot } from '../../infrastructure/telegram';
import { configService } from '../../../config';
import { logger } from '../../infrastructure/logger';

@injectable()
export class SendSupportMessageUseCase {
  constructor(
    @inject('ISupportRepository') private supportRepository: ISupportRepository,
    @inject(TelegramSupportBot) private telegramBot: TelegramSupportBot
  ) {}

  async execute(dto: SendSupportMessageDTO): Promise<void> {
    try {
      // Save message to database
      await this.supportRepository.saveMessage({
        userEmail: dto.userEmail,
        role: 'user',
        text: dto.message,
        fileId: dto.fileId,
        fileType: dto.fileType,
        timestamp: new Date(),
      });

      logger.info('Support message saved to DB', { userEmail: dto.userEmail });

      // Send to Telegram admin
      const config = configService.get();
      const adminIds = config.telegram.adminIds;

      logger.info('Admin IDs configuration', {
        adminIds,
        count: adminIds.length,
        raw: process.env.ADMIN_IDS
      });

      if (!adminIds || adminIds.length === 0) {
        logger.error('No admin IDs configured! Check ADMIN_IDS environment variable');
        throw new Error('No admin IDs configured for support messages');
      }

      const adminId = adminIds[0];

      if (!adminId || adminId.trim() === '') {
        logger.error('First admin ID is empty or invalid', { adminId, adminIds });
        throw new Error('Invalid admin ID configuration');
      }

      try {
        await this.telegramBot.sendMessageToAdmin(dto.userEmail, dto.message, adminId);
        logger.info('Support message sent to Telegram successfully', {
          userEmail: dto.userEmail,
          adminId,
          messagePreview: dto.message.substring(0, 50)
        });
      } catch (error) {
        logger.error('Failed to send to Telegram, but message saved in DB', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          userEmail: dto.userEmail,
          adminId
        });
        // Re-throw to notify user of the issue
        throw new Error('Failed to send message to support. Please try again later.');
      }
    } catch (error) {
      logger.error('Failed to process support message', {
        error: error instanceof Error ? error.message : String(error),
        dto
      });
      throw error;
    }
  }
}
