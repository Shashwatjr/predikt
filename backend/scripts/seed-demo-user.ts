/**
 * Upserts the QA demo account used by docs and local quick-login.
 * Password: Password123!
 *
 * Usage:
 *   DATABASE_URL=... npx ts-node scripts/seed-demo-user.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'test@predikt.ai';
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'My Prediktion Demo',
      prediktHandle: 'predikt.demo',
      passwordHash,
      isGuest: false,
    },
    create: {
      email,
      name: 'My Prediktion Demo',
      prediktHandle: 'predikt.demo',
      passwordHash,
      isGuest: false,
    },
  });
  console.log(`Demo user ready: ${user.email} (@${user.prediktHandle}) id=${user.userId}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
