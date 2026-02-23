import { Router } from 'express';
import { requireAuth } from '../../core/middlewares/auth';
import { requireCompany, getCompanyId } from '../../core/middlewares/companyContext';
import { requireRoles } from '../../core/middlewares/rbac';
import { prisma } from '../../core/db/prisma';

export const usersRouter = Router();

usersRouter.get('/', requireAuth, requireCompany, requireRoles('ADMIN'), async (req, res) => {
  const companyId = getCompanyId(req);
  const users = await prisma.userCompany.findMany({
    where: { companyId },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({
    items: users.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      createdAt: m.createdAt,
    })),
  });
});
