import { Router, Request, Response, NextFunction } from 'express';
import { container } from '../../container';
import { RegisterUserUseCase, LoginUserUseCase } from '../../application/use-cases';
import { RegisterUserDTO, LoginUserDTO } from '../../application/dtos';

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
      user,
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

    res.json({
      success: true,
      user,
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

export default router;
