import { Request, Response, NextFunction } from 'express';
import { HttpError } from './errorHandler';
import { getAuth } from './auth';

export function requireRoles(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const u = getAuth(req);
    if (!u.role) throw new HttpError(403, 'Missing role');
    if (!roles.includes(u.role)) throw new HttpError(403, 'Forbidden');
    next();
  };
}
