import { Router } from 'express';
import { requireAuth, getAuth } from '../../core/middlewares/auth';
import { requireCompany, getCompanyId } from '../../core/middlewares/companyContext';
import { validateBody } from '../../core/middlewares/validate';
import { createInvoiceSchema } from './schemas';
import { createInvoiceAtomic } from './service';
import { prisma } from '../../core/db/prisma';

export const invoicesRouter = Router();

invoicesRouter.get('/', requireAuth, requireCompany, async (req, res) => {
  const companyId = getCompanyId(req);
  const items = await prisma.invoice.findMany({
    where: { companyId },
    include: { client: true },
    orderBy: { issueDate: 'desc' },
    take: 200,
  });
  res.json({ items });
});

invoicesRouter.get('/:id', requireAuth, requireCompany, async (req, res) => {
  const companyId = getCompanyId(req);
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { client: true, lines: true, payments: true, efSubmissions: { include: { events: true } } },
  });
  if (!invoice || invoice.companyId !== companyId) return res.status(404).json({ error: { message: 'Not found' } });
  res.json({ invoice });
});

invoicesRouter.post('/create', requireAuth, requireCompany, validateBody(createInvoiceSchema), async (req, res) => {
  const companyId = getCompanyId(req);
  const auth = getAuth(req);

  const invoice = await createInvoiceAtomic({
    companyId,
    userId: auth.sub,
    clientId: req.body.clientId,
    series: req.body.series,
    issueDate: req.body.issueDate ? new Date(req.body.issueDate) : undefined,
    dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
    currency: req.body.currency,
    lines: req.body.lines,
  });

  res.status(201).json({ invoice });
});

// Placeholder for PDF generation (to be implemented with storage)
invoicesRouter.get('/:id/pdf', requireAuth, requireCompany, async (req, res) => {
  res.status(501).json({ error: { message: 'PDF generator not implemented in this step' } });
});
