import { Router, Request, Response, NextFunction } from 'express';
import { container } from '../../container';
import { SendSupportMessageUseCase } from '../../application/use-cases';
import { SendSupportMessageDTO } from '../../application/dtos';
import { requireAuth } from '../middleware/auth';
import { ISupportRepository } from '../../domain/repositories';

const router = Router();

router.post('/send', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.session.userId!;

    // Get user email from repository
    const userRepo = container.resolve<any>('IUserRepository');
    const user = await userRepo.findById(userId);

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const userEmail = user.getEmail()?.getValue() || user.getUsername().getValue();

    const dto: SendSupportMessageDTO = {
      userEmail,
      message: req.body.message,
      fileId: req.body.fileId,
      fileType: req.body.fileType,
      chatType: req.body.chatType || 'support', // Default to 'support'
    };

    const useCase = container.resolve(SendSupportMessageUseCase);
    await useCase.execute(dto);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Premium chat endpoint
router.post('/premium', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.session.userId!;

    // Get user email from repository
    const userRepo = container.resolve<any>('IUserRepository');
    const user = await userRepo.findById(userId);

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const userEmail = user.getEmail()?.getValue() || user.getUsername().getValue();

    const dto: SendSupportMessageDTO = {
      userEmail,
      message: req.body.message,
      fileId: req.body.fileId,
      fileType: req.body.fileType,
      chatType: 'premium',
    };

    const useCase = container.resolve(SendSupportMessageUseCase);
    await useCase.execute(dto);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/history', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.session.userId!;

    // Get user email
    const userRepo = container.resolve<any>('IUserRepository');
    const user = await userRepo.findById(userId);

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const userEmail = user.getEmail()?.getValue() || user.getUsername().getValue();

    const supportRepo = container.resolve<ISupportRepository>('ISupportRepository');
    const messages = await supportRepo.getMessagesByUser(userEmail);

    res.json({
      success: true,
      messages: messages.map(m => ({
        id: m.id,
        role: m.role,
        text: m.text,
        fileId: m.fileId,
        fileType: m.fileType,
        timestamp: m.timestamp.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
