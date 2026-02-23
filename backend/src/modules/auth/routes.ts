import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validateBody } from '../../core/middlewares/validate';
import { loginSchema, registerSchema, refreshSchema } from './schemas';
import { login, register, refresh } from './service';

export const authRouter = Router();

// stricter limit for login
const loginLimiter = rateLimit({ windowMs: 60_000, limit: 20 });

authRouter.post('/register', validateBody(registerSchema), async (req, res) => {
  const result = await register(req.body);
  res.status(201).json(result);
});

authRouter.post('/login', loginLimiter, validateBody(loginSchema), async (req, res) => {
  const ip = req.ip;
  const result = await login(req.body, ip);
  res.json(result);
});

authRouter.post('/refresh', validateBody(refreshSchema), async (req, res) => {
  const result = await refresh(req.body);
  res.json(result);
});
