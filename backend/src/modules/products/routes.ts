import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/db/prisma';
import { requireAuth, getAuth } from '../../core/middlewares/auth';
import { requireCompany, getCompanyId } from '../../core/middlewares/companyContext';
import { validateBody } from '../../core/middlewares/validate';
import { HttpError } from '../../core/middlewares/errorHandler';

export const productsRouter = Router();

const productSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1).default('buc'),
  price: z.number().nonnegative(),
  vatRate: z.number().nonnegative().max(100).default(19),
});

productsRouter.get('/', requireAuth, requireCompany, async (req, res) => {
  const companyId = getCompanyId(req);
  const items = await prisma.product.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  res.json({ items });
});

productsRouter.post('/', requireAuth, requireCompany, validateBody(productSchema), async (req, res) => {
  const companyId = getCompanyId(req);
  const auth = getAuth(req);
  const product = await prisma.product.create({
    data: {
      companyId,
      name: req.body.name,
      unit: req.body.unit,
      price: req.body.price,
      vatRate: req.body.vatRate,
    },
  });
  await prisma.auditLog.create({ data: { companyId, userId: auth.sub, action: 'product.create', entity: 'Product', entityId: product.id } });
  res.status(201).json({ product });
});

productsRouter.put('/:id', requireAuth, requireCompany, validateBody(productSchema.partial()), async (req, res) => {
  const companyId = getCompanyId(req);
  const auth = getAuth(req);
  const product = await prisma.product.update({ where: { id: req.params.id }, data: req.body });
  if (product.companyId !== companyId) throw new HttpError(403, 'Cross-tenant update blocked');
  await prisma.auditLog.create({ data: { companyId, userId: auth.sub, action: 'product.update', entity: 'Product', entityId: product.id } });
  res.json({ product });
});

productsRouter.delete('/:id', requireAuth, requireCompany, async (req, res) => {
  const companyId = getCompanyId(req);
  const auth = getAuth(req);
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product || product.companyId !== companyId) return res.status(404).json({ error: { message: 'Not found' } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.auditLog.create({ data: { companyId, userId: auth.sub, action: 'product.delete', entity: 'Product', entityId: product.id } });
  res.status(204).send();
});
