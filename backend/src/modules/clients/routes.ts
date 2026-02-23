import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/db/prisma';
import { requireAuth, getAuth } from '../../core/middlewares/auth';
import { requireCompany, getCompanyId } from '../../core/middlewares/companyContext';
import { validateBody } from '../../core/middlewares/validate';
import { HttpError } from '../../core/middlewares/errorHandler';

export const clientsRouter = Router();

const clientSchema = z.object({
  type: z.enum(['PJ', 'PF']).default('PJ'),
  name: z.string().min(1),
  cui: z.string().min(2).optional(),
  address: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

clientsRouter.get('/', requireAuth, requireCompany, async (req, res) => {
  const companyId = getCompanyId(req);
  const items = await prisma.client.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  res.json({ items });
});

clientsRouter.post('/', requireAuth, requireCompany, validateBody(clientSchema), async (req, res) => {
  const companyId = getCompanyId(req);
  const auth = getAuth(req);
  const client = await prisma.client.create({ data: { ...req.body, companyId } });
  await prisma.auditLog.create({ data: { companyId, userId: auth.sub, action: 'client.create', entity: 'Client', entityId: client.id } });
  res.status(201).json({ client });
});

clientsRouter.put('/:id', requireAuth, requireCompany, validateBody(clientSchema.partial()), async (req, res) => {
  const companyId = getCompanyId(req);
  const auth = getAuth(req);
  const client = await prisma.client.update({ where: { id: req.params.id }, data: req.body });
  if (client.companyId !== companyId) {
    // safety: prevent cross-tenant write via guessed ID
    throw new HttpError(403, 'Cross-tenant update blocked');
  }
  await prisma.auditLog.create({ data: { companyId, userId: auth.sub, action: 'client.update', entity: 'Client', entityId: client.id } });
  res.json({ client });
});

clientsRouter.delete('/:id', requireAuth, requireCompany, async (req, res) => {
  const companyId = getCompanyId(req);
  const auth = getAuth(req);
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client || client.companyId !== companyId) return res.status(404).json({ error: { message: 'Not found' } });
  await prisma.client.delete({ where: { id: client.id } });
  await prisma.auditLog.create({ data: { companyId, userId: auth.sub, action: 'client.delete', entity: 'Client', entityId: client.id } });
  res.status(204).send();
});
