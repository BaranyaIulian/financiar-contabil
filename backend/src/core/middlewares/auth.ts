import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { HttpError } from './errorHandler';

export type JwtPayload = {
  sub: string;
  email: string;
  companyId?: string;
  role?: string;
};

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Missing Authorization header');

  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as JwtPayload;
    (req as any).user = payload;
    next();
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
}

export function getAuth(req: Request): JwtPayload {
  const u = (req as any).user as JwtPayload | undefined;
  if (!u) throw new HttpError(401, 'Unauthorized');
  return u;
}
