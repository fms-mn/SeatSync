import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { AppError } from './errors.js';

export interface TokenUser { id: string; name: string; email: string; role: 'USER' | 'ADMIN' }
// Express request properties are extended through declaration merging.
// eslint-disable-next-line @typescript-eslint/no-namespace
declare global { namespace Express { interface Request { user?: TokenUser } } }

const COOKIE = 'seatsync_session';

export function issueSession(res: Response, user: TokenUser) {
  const token = jwt.sign(user, config.JWT_SECRET, { expiresIn: '7d', issuer: 'seatsync' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSession(res: Response) { res.clearCookie(COOKIE, { path: '/' }); }

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try { req.user = jwt.verify(token, config.JWT_SECRET, { issuer: 'seatsync' }) as TokenUser; } catch { /* anonymous */ }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') return next(new AppError(403, 'Administrator access required', 'FORBIDDEN'));
  next();
}
