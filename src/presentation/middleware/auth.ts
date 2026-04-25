import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../domain/errors';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    isWorker?: boolean;
    isAdmin?: boolean;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    throw new UnauthorizedError('Authentication required');
  }
  next();
}

export function requireWorker(req: Request, _res: Response, next: NextFunction): void {
  if (!req.session.userId || !req.session.isWorker) {
    throw new UnauthorizedError('Worker access required');
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.session.userId || !req.session.isAdmin) {
    throw new UnauthorizedError('Admin access required');
  }
  next();
}
