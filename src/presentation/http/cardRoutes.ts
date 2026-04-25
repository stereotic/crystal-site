import { Router, Request, Response, NextFunction } from 'express';
import { container } from '../../container';
import { GetAvailableCardsUseCase, PurchaseCardUseCase } from '../../application/use-cases';
import { CardFilterDTO } from '../../application/dtos';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters: CardFilterDTO = {
      region: req.query.region as string,
      type: req.query.type as string,
      bank: req.query.bank as string,
      bin: req.query.bin as string,
      isNonVbv: req.query.isNonVbv === 'true',
      isFullz: req.query.isFullz === 'true',
      isRefundable: req.query.isRefundable === 'true',
      minPrice: req.query.minPrice ? parseInt(req.query.minPrice as string, 10) : undefined,
      maxPrice: req.query.maxPrice ? parseInt(req.query.maxPrice as string, 10) : undefined,
    };

    const useCase = container.resolve(GetAvailableCardsUseCase);
    const cards = await useCase.execute(filters);

    res.json({
      success: true,
      cards,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:cardId/purchase', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId!;
    const cardId = req.params.cardId;

    const useCase = container.resolve(PurchaseCardUseCase);
    const card = await useCase.execute(userId, cardId);

    res.json({
      success: true,
      card,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
