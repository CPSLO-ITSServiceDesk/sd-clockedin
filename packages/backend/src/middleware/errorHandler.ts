import { Request, Response, NextFunction } from 'express';

/**
 * An error with an associated HTTP status code.
 * Throw this from services/controllers to control the response status.
 */
export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'HttpError';
  }
}

/**
 * Centralized error-handling middleware. Must be registered last,
 * after all routes. Express identifies it by its four arguments.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const statusCode = err instanceof HttpError ? err.statusCode : 500;

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
}
