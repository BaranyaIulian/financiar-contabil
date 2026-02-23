import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class HttpError extends Error {
  status: number;
  details?: any;
  constructor(status: number, message: string, details?: any) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = err?.status || 500;
  const requestId = (req as any).requestId;

  logger.error({ err, requestId, path: req.path, method: req.method }, 'request error');

  res.status(status).json({
    error: {
      message: status === 500 ? 'Internal Server Error' : err.message,
      details: err.details,
      requestId,
    },
  });
}
