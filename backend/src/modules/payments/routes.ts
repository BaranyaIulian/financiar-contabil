import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/db/prisma';
import { requireAuth, getAuth } from '../../core/middlewares/auth';
import { requireCompany, getCompanyId } from '../../core/middlewares/companyContext';
import { validateBody } from '../../core/middlewares/validate';
import { HttpError } from '../../core/middlewares/errorHandler';

export const paymentsRouter = Router();

const addSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(['CASH', 'OP', 'CARD']).default('OP'),
  paidAt: z.string().datetime().optional(),
  reference: z.string().optional(),
});

paymentsRouter.post('/add', requireAuth, requireCompany, validateBody(addSchema), async (req, res) => {
  const companyId = getCompanyId(req);
  const auth = getAuth(req);

  const invoice = await prisma.invoice.findUnique({ where: { id: req.body.invoiceId } });
  if (!invoice || invoice.companyId !== companyId) throw new HttpError(400, 'Invalid invoice');

  const payment = await prisma.payment.create({
    data: {
      companyId,
      invoiceId: req.body.invoiceId,
      amount: req.body.amount,
      method: req.body.method,
      paidAt: req.body.paidAt ? new Date(req.body.paidAt) : new Date(),
      reference: req.body.reference,
    },
  });

  await prisma.auditLog.create({
    data: { companyId, userId: auth.sub, action: 'invoice.payment_record', entity: 'Payment', entityId: payment.id, meta: { invoiceId: invoice.id } },
  });

  res.status(201).json({ payment });
});

paymentsRouter.get('/list', requireAuth, requireCompany, async (req, res) => {
  const companyId = getCompanyId(req);
  const items = await prisma.payment.findMany({ where: { companyId }, orderBy: { paidAt: 'desc' }, take: 200 });
  res.json({ items });
});
