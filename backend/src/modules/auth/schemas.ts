import { z } from 'zod';
import { emailSchema, passwordSchema } from '../../core/validators/common';

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1).optional(),
  companyName: z.string().min(1).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
  companyId: z.string().min(1).optional(),
});
