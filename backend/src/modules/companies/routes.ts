import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, getAuth } from '../../core/middlewares/auth';
import { validateBody } from '../../core/middlewares/validate';
import { prisma } from '../../core/db/prisma';
import { HttpError } from '../../core/middlewares/errorHandler';

export const companiesRouter = Router();

companiesRouter.get('/mine', requireAuth, async (req, res) => {
  const auth = getAuth(req);
  const memberships = await prisma.userCompany.findMany({
    where: { userId: auth.sub },
    include: { company: true },
  });
  res.json({
    items: memberships.map((m) => ({
      company: { id: m.company.id, name: m.company.name },
      role: m.role,
    })),
  });
});

const createSchema = z.object({
  name: z.string().min(1),
  cui: z.string().min(2).optional(),
  address: z.string().min(1).optional(),
  vatPayer: z.boolean().optional(),
});

companiesRouter.post('/', requireAuth, validateBody(createSchema), async (req, res) => {
  const auth = getAuth(req);

  // Only ADMIN can create extra companies for now.
  if (auth.role !== 'ADMIN') throw new HttpError(403, 'Only ADMIN can create companies');

  const company = await prisma.company.create({ data: req.body });
  await prisma.userCompany.create({ data: { userId: auth.sub, companyId: company.id, role: 'ADMIN' } });

  await prisma.auditLog.create({
    data: { companyId: company.id, userId: auth.sub, action: 'company.create', meta: { name: company.name } },
  });

  res.status(201).json({ company });
});
