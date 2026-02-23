import { prisma } from '../../core/db/prisma';
import { HttpError } from '../../core/middlewares/errorHandler';

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeTotals(lines: Array<{ qty: number; price: number; vatRate: number; discount: number }>) {
  let totalNet = 0;
  let totalVat = 0;

  for (const l of lines) {
    const discountedPrice = l.price * (1 - (l.discount ?? 0) / 100);
    const lineNet = l.qty * discountedPrice;
    const lineVat = lineNet * ((l.vatRate ?? 0) / 100);
    totalNet += lineNet;
    totalVat += lineVat;
  }

  totalNet = round2(totalNet);
  totalVat = round2(totalVat);
  const totalGross = round2(totalNet + totalVat);

  return { totalNet, totalVat, totalGross };
}

export async function createInvoiceAtomic(params: {
  companyId: string;
  userId: string;
  clientId: string;
  series: string;
  issueDate?: Date;
  dueDate?: Date;
  currency: string;
  lines: Array<{ name: string; unit: string; qty: number; price: number; vatRate: number; discount: number }>;
}) {
  // validate client belongs to company
  const client = await prisma.client.findUnique({ where: { id: params.clientId } });
  if (!client || client.companyId !== params.companyId) throw new HttpError(400, 'Invalid client');

  const totals = computeTotals(params.lines);

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const last = await tx.invoice.findFirst({
          where: { companyId: params.companyId, series: params.series },
          orderBy: { number: 'desc' },
          select: { number: true },
        });
        const nextNumber = (last?.number ?? 0) + 1;

        const invoice = await tx.invoice.create({
          data: {
            companyId: params.companyId,
            clientId: params.clientId,
            series: params.series,
            number: nextNumber,
            issueDate: params.issueDate ?? new Date(),
            dueDate: params.dueDate,
            currency: params.currency,
            totalNet: totals.totalNet,
            totalVat: totals.totalVat,
            totalGross: totals.totalGross,
            lines: {
              create: params.lines.map((l) => ({
                name: l.name,
                unit: l.unit,
                qty: l.qty,
                price: l.price,
                vatRate: l.vatRate,
                discount: l.discount,
              })),
            },
          },
          include: { lines: true, client: true },
        });

        await tx.auditLog.create({
          data: {
            companyId: params.companyId,
            userId: params.userId,
            action: 'invoice.create',
            entity: 'Invoice',
            entityId: invoice.id,
            meta: { series: invoice.series, number: invoice.number },
          },
        });

        return invoice;
      });

      return result;
    } catch (e: any) {
      // Prisma unique constraint violation => retry
      if (e?.code === 'P2002') continue;
      throw e;
    }
  }

  throw new HttpError(409, 'Could not allocate invoice number (concurrency)');
}
