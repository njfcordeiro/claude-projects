/**
 * Cria (ou atualiza a password de) o primeiro utilizador ADMIN_RH.
 * Não há self-registo nesta app (docs/02-arquitetura-tecnica.md secção
 * 4.1) — é assim que a primeira conta é criada.
 *
 * Uso:
 *   ADMIN_EMAIL=admin@empresa.pt ADMIN_PASSWORD="uma-password-forte" npm run seed:admin
 */
import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Define ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 8 caracteres) antes de correr este script.');
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD tem de ter pelo menos 8 caracteres.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, role: 'ADMIN_RH' },
    update: { passwordHash, role: 'ADMIN_RH', isActive: true },
  });

  console.log(`Utilizador ADMIN_RH pronto: ${user.email} (id=${user.id}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
