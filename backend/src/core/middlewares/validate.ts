import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { HttpError } from './errorHandler';

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Validation error', parsed.error.flatten());
    }
    req.body = parsed.data;
    next();
  };
}
