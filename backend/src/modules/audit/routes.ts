import { Router } from 'express';
import { prisma } from '../../core/db/prisma';
import { requireAuth } from '../../core/middlewares/auth';
import { requireCompany, getCompanyId } from '../../core/middlewares/companyContext';
import { requireRoles } from '../../core/middlewares/rbac';

export const auditRouter = Router();

auditRouter.get('/', requireAuth, requireCompany, requireRoles('ADMIN', 'CONTABIL'), async (req, res) => {
  const companyId = getCompanyId(req);
  const items = await prisma.auditLog.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 200 });
  res.json({ items });
});
