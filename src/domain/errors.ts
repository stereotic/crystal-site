export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends DomainError {}
export class NotFoundError extends DomainError {}
export class UnauthorizedError extends DomainError {}
export class ForbiddenError extends DomainError {}
export class ConflictError extends DomainError {}
export class InsufficientFundsError extends DomainError {}
