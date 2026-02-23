import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/db/prisma';
import { requireAuth, getAuth } from '../../core/middlewares/auth';
import { requireCompany, getCompanyId } from '../../core/middlewares/companyContext';
import { validateBody } from '../../core/middlewares/validate';

export const sagaRouter = Router();

const exportSchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});

// NOTE: Scaffold only; no real SAGA format generation in this step.
sagaRouter.post('/export', requireAuth, requireCompany, validateBody(exportSchema), async (req, res) => {
  const companyId = getCompanyId(req);
  const auth = getAuth(req);

  const exp = await prisma.sagaExport.create({
    data: {
      companyId,
      periodStart: new Date(req.body.periodStart),
      periodEnd: new Date(req.body.periodEnd),
      status: 'PENDING',
      reportJson: { note: 'Generator not implemented in this step' },
      createdById: auth.sub,
    },
  });

  await prisma.auditLog.create({ data: { companyId, userId: auth.sub, action: 'saga.export_generate', entity: 'SagaExport', entityId: exp.id } });

  res.status(202).json({ export: exp });
});

sagaRouter.get('/history', requireAuth, requireCompany, async (req, res) => {
  const companyId = getCompanyId(req);
  const items = await prisma.sagaExport.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 100 });
  res.json({ items });
});
