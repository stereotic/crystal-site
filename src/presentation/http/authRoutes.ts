import { Router, Request, Response, NextFunction } from 'express';
import { container } from '../../container';
import { RegisterUserUseCase, LoginUserUseCase } from '../../application/use-cases';
import { RegisterUserDTO, LoginUserDTO } from '../../application/dtos';
import { IUserRepository } from '../../domain/repositories';

const router = Router();

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto: RegisterUserDTO = {
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      referralCode: req.body.referralCode,
    };

    const useCase = container.resolve(RegisterUserUseCase);
    const user = await useCase.execute(dto);

    // Set session
    req.session.userId = user.id;
    req.session.isWorker = user.isWorker;
    req.session.isAdmin = false;

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance_usd: user.balanceUsd,
        is_premium: user.isPremium,
        is_worker: user.isWorker,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto: LoginUserDTO = {
      login: req.body.login || req.body.username || req.body.email,
      password: req.body.password,
    };

    const useCase = container.resolve(LoginUserUseCase);
    const user = await useCase.execute(dto);

    // Set session
    req.session.userId = user.id;
    req.session.isWorker = user.isWorker;
    req.session.isAdmin = false; // TODO: Check admin status

    // Log for debugging
    console.log('[/login] User logged in:', {
      sessionId: req.sessionID?.substring(0, 10) + '...',
      userId: user.id,
      username: user.username,
      balance_usd: user.balanceUsd
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance_usd: user.balanceUsd,
        is_premium: user.isPremium,
        is_worker: user.isWorker,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ success: false, message: 'Logout failed' });
    } else {
      res.json({ success: true });
    }
  });
});

router.get('/session', (req: Request, res: Response) => {
  if (req.session.userId) {
    res.json({
      loggedIn: true,
      userId: req.session.userId,
      isWorker: req.session.isWorker,
      isAdmin: req.session.isAdmin,
    });
  } else {
    res.json({ loggedIn: false });
  }
});

// /me endpoint for getting current user data
router.get('/me', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.session.userId) {
      res.json({ loggedIn: false });
      return;
    }

    const userRepository = container.resolve<IUserRepository>('IUserRepository');
    const user = await userRepository.findById(req.session.userId);

    if (!user) {
      req.session.destroy(() => {});
      res.json({ loggedIn: false });
      return;
    }

    const responseData = {
      loggedIn: true,
      id: user.getId(),
      username: user.getUsername().getValue(),
      email: user.getEmail()?.getValue() || null,
      balance_usd: user.getBalance().getDollars(),
      is_premium: user.isPremium(),
      is_worker: user.isWorker(),
    };

    // Log for debugging balance issues
    console.log('[/me] User data:', {
      sessionId: req.sessionID?.substring(0, 10) + '...',
      userId: responseData.id,
      username: responseData.username,
      balance_usd: responseData.balance_usd
    });

    res.json(responseData);
  } catch (error) {
    next(error);
  }
});

export default router;
