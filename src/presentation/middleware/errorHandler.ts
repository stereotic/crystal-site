import { Request, Response, NextFunction } from 'express';
import { DomainError, ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InsufficientFundsError } from '../../domain/errors';
import { logger } from '../../infrastructure/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof ValidationError) {
    res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: err.message,
    });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({
      success: false,
      error: 'Not Found',
      message: err.message,
    });
    return;
  }

  if (err instanceof UnauthorizedError) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: err.message,
    });
    return;
  }

  if (err instanceof ForbiddenError) {
    res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: err.message,
    });
    return;
  }

  if (err instanceof ConflictError) {
    res.status(409).json({
      success: false,
      error: 'Conflict',
      message: err.message,
    });
    return;
  }

  if (err instanceof InsufficientFundsError) {
    res.status(400).json({
      success: false,
      error: 'Insufficient Funds',
      message: err.message,
    });
    return;
  }

  if (err instanceof DomainError) {
    res.status(400).json({
      success: false,
      error: 'Domain Error',
      message: err.message,
    });
    return;
  }

  // Unknown error
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
  });
}
