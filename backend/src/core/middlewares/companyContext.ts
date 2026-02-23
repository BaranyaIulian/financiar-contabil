import { Request, Response, NextFunction } from 'express';
import { HttpError } from './errorHandler';
import { getAuth } from './auth';

// companyId can be in token OR provided via header x-company-id.
// For MVP, we accept either and normalize to req.companyId.
export function requireCompany(req: Request, _res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const companyId = auth.companyId || (req.headers['x-company-id'] as string | undefined);
  if (!companyId) throw new HttpError(400, 'Missing company context (token.companyId or x-company-id)');
  (req as any).companyId = companyId;
  next();
}

export function getCompanyId(req: Request): string {
  const c = (req as any).companyId as string | undefined;
  if (!c) throw new HttpError(400, 'Missing company context');
  return c;
}
