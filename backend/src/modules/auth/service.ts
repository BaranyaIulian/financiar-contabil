import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../core/db/prisma';
import { env } from '../../core/config/env';
import { HttpError } from '../../core/middlewares/errorHandler';
import { Role } from '@prisma/client';

function signAccessToken(payload: { sub: string; email: string; companyId?: string; role?: string }) {
  return jwt.sign(payload, env.jwtAccessSecret, { expiresIn: env.jwtAccessExpiresIn as any });
}

function signRefreshToken(payload: { sub: string; email: string }) {
  return jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: env.jwtRefreshExpiresIn as any });
}

export async function register(input: { email: string; password: string; name?: string; companyName?: string }) {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw new HttpError(409, 'Email already registered');

  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: input.email, password: passwordHash, name: input.name },
    });

    // For MVP: create a default company for the new user.
    const company = await tx.company.create({
      data: { name: input.companyName ?? 'Firma mea' },
    });

    await tx.userCompany.create({
      data: { userId: user.id, companyId: company.id, role: Role.ADMIN },
    });

    await tx.auditLog.create({
      data: { userId: user.id, companyId: company.id, action: 'auth.register', meta: { email: user.email } },
    });

    return { user: { id: user.id, email: user.email, name: user.name }, company };
  });
}

export async function login(input: { email: string; password: string }, ip?: string) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { memberships: { include: { company: true } } },
  });
  if (!user) throw new HttpError(401, 'Invalid credentials');

  const ok = await bcrypt.compare(input.password, user.password);
  if (!ok) {
    await prisma.auditLog.create({ data: { userId: user.id, action: 'auth.login_failed', meta: { email: user.email }, ip } });
    throw new HttpError(401, 'Invalid credentials');
  }

  const membership = user.memberships[0];
  const companyId = membership?.companyId;
  const role = membership?.role;

  const accessToken = signAccessToken({ sub: user.id, email: user.email, companyId, role });
  const refreshToken = signRefreshToken({ sub: user.id, email: user.email });

  const refreshHash = await bcrypt.hash(refreshToken, 12);
  await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: refreshHash } });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      companyId,
      action: 'auth.login',
      meta: { email: user.email },
      ip,
    },
  });

  return {
    user: { id: user.id, email: user.email, name: user.name },
    company: membership?.company ? { id: membership.company.id, name: membership.company.name } : null,
    role: role ?? null,
    accessToken,
    refreshToken,
  };
}

export async function refresh(input: { refreshToken: string; companyId?: string }) {
  let decoded: any;
  try {
    decoded = jwt.verify(input.refreshToken, env.jwtRefreshSecret);
  } catch {
    throw new HttpError(401, 'Invalid refresh token');
  }

  const userId = decoded.sub as string;

  // Find a non-revoked refresh token record that matches this token.
  const candidates = await prisma.refreshToken.findMany({ where: { userId, revokedAt: null }, orderBy: { createdAt: 'desc' }, take: 20 });
  const match = await (async () => {
    for (const c of candidates) {
      const ok = await bcrypt.compare(input.refreshToken, c.tokenHash);
      if (ok) return c;
    }
    return null;
  })();

  if (!match) throw new HttpError(401, 'Refresh token not recognized');

  const memberships = await prisma.userCompany.findMany({ where: { userId }, include: { company: true } });
  if (memberships.length === 0) throw new HttpError(403, 'No company membership');

  const chosen = input.companyId ? memberships.find((m) => m.companyId === input.companyId) : memberships[0];
  if (!chosen) throw new HttpError(403, 'Invalid company');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, 'User not found');

  const accessToken = signAccessToken({ sub: user.id, email: user.email, companyId: chosen.companyId, role: chosen.role });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      companyId: chosen.companyId,
      action: 'auth.refresh',
    },
  });

  return { accessToken, company: { id: chosen.company.id, name: chosen.company.name }, role: chosen.role };
}
