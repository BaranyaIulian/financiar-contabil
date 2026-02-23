import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';

import { env } from './core/config/env';
import { logger } from './core/utils/logger';
import { requestId } from './core/middlewares/requestId';
import { errorHandler } from './core/middlewares/errorHandler';

import { authRouter } from './modules/auth/routes';
import { usersRouter } from './modules/users/routes';
import { companiesRouter } from './modules/companies/routes';
import { clientsRouter } from './modules/clients/routes';
import { productsRouter } from './modules/products/routes';
import { invoicesRouter } from './modules/invoices/routes';
import { paymentsRouter } from './modules/payments/routes';
import { auditRouter } from './modules/audit/routes';
import { efacturaRouter } from './modules/efactura/routes';
import { sagaRouter } from './modules/saga/routes';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin === '*' ? true : env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(requestId);
app.use(pinoHttp({ logger }));

// Baseline rate limit
app.use(rateLimit({ windowMs: 60_000, limit: 300 }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/companies', companiesRouter);
app.use('/clients', clientsRouter);
app.use('/products', productsRouter);
app.use('/invoices', invoicesRouter);
app.use('/payments', paymentsRouter);
app.use('/audit', auditRouter);
app.use('/efactura', efacturaRouter);
app.use('/saga', sagaRouter);

app.use(errorHandler);

app.listen(env.port, () => {
  logger.info({ port: env.port }, 'API listening');
});
