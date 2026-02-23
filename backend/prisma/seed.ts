import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@corebill.local';
  const password = process.env.ADMIN_PASSWORD || 'Admin123!';
  const name = process.env.ADMIN_NAME || 'Admin';

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, password: passwordHash },
    create: { email, name, password: passwordHash },
  });

  const company = await prisma.company.upsert({
    where: { id: 'seed-company' },
    update: { name: 'Firma Demo' },
    create: { id: 'seed-company', name: 'Firma Demo', cui: 'RO12345678', address: 'București' },
  });

  await prisma.userCompany.upsert({
    where: { userId_companyId: { userId: user.id, companyId: company.id } },
    update: { role: Role.ADMIN },
    create: { userId: user.id, companyId: company.id, role: Role.ADMIN },
  });

  await prisma.auditLog.create({
    data: {
      companyId: company.id,
      userId: user.id,
      action: 'seed.admin',
      meta: { email }
    }
  });

  console.log('Seed OK:', { adminEmail: email, companyId: company.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
