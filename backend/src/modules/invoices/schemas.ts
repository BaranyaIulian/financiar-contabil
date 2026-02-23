import { z } from 'zod';

export const invoiceLineSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1).default('buc'),
  qty: z.number().positive(),
  price: z.number().nonnegative(),
  vatRate: z.number().nonnegative().max(100).default(19),
  discount: z.number().min(0).max(100).default(0),
});

export const createInvoiceSchema = z.object({
  clientId: z.string().min(1),
  series: z.string().min(1).default('F'),
  issueDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  currency: z.string().min(1).default('RON'),
  lines: z.array(invoiceLineSchema).min(1),
});
