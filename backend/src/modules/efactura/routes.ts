import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../../core/db/prisma';
import { requireAuth, getAuth } from '../../core/middlewares/auth';
import { requireCompany, getCompanyId } from '../../core/middlewares/companyContext';
import { HttpError } from '../../core/middlewares/errorHandler';

export const efacturaRouter = Router();

// NOTE: This is only a scaffold (no ANAF integration yet).

efacturaRouter.post('/submit/:id', requireAuth, requireCompany, async (req, res) => {
  const companyId = getCompanyId(req);
  const auth = getAuth(req);
  const invoiceId = req.params.id;

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { lines: true, client: true } });
  if (!invoice || invoice.companyId !== companyId) throw new HttpError(404, 'Invoice not found');

  // idempotency key based on invoice snapshot (very simplified)
  const payloadHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ invoiceId, updatedAt: invoice.updatedAt.toISOString() }))
    .digest('hex');

  const submission = await prisma.eFacturaSubmission.upsert({
    where: { invoiceId_payloadHash: { invoiceId, payloadHash } },
    update: { status: 'PENDING' },
    create: {
      companyId,
      invoiceId,
      payloadHash,
      status: 'PENDING',
      events: {
        create: [{ type: 'SUBMIT_REQUESTED', message: 'Submit requested (stub)' }],
      },
    },
    include: { events: true },
  });

  await prisma.invoice.update({ where: { id: invoiceId }, data: { efStatus: 'PENDING' } });

  await prisma.auditLog.create({
    data: { companyId, userId: auth.sub, action: 'efactura.submit', entity: 'Invoice', entityId: invoiceId, meta: { submissionId: submission.id } },
  });

  res.json({ submission });
});

efacturaRouter.get('/status/:id', requireAuth, requireCompany, async (req, res) => {
  const companyId = getCompanyId(req);
  const invoiceId = req.params.id;
  const latest = await prisma.eFacturaSubmission.findFirst({
    where: { invoiceId, companyId },
    orderBy: { createdAt: 'desc' },
    include: { events: true },
  });
  if (!latest) throw new HttpError(404, 'No submission');
  res.json({ submission: latest });
});

efacturaRouter.get('/events/:id', requireAuth, requireCompany, async (req, res) => {
  const companyId = getCompanyId(req);
  const invoiceId = req.params.id;
  const subs = await prisma.eFacturaSubmission.findMany({
    where: { invoiceId, companyId },
    include: { events: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ items: subs });
});
