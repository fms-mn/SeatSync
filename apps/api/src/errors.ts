import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(400).json({ message: 'Invalid request', code: 'VALIDATION_ERROR', issues: error.issues });
  }
  if (error instanceof AppError) {
    return res.status(error.status).json({ message: error.message, code: error.code });
  }
  console.error(error);
  return res.status(500).json({ message: 'An unexpected error occurred', code: 'INTERNAL_ERROR' });
}
