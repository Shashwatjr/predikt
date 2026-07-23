import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export const PILOT_ACCOUNT = {
  email: 'pilot@predikt.ai',
  password: 'PilotMvp2026!',
  name: 'MVP Pilot',
  handle: 'mvp.pilot',
  signupCredits: 30,
} as const;

async function ensurePilotUser() {
  const passwordHash = await bcrypt.hash(PILOT_ACCOUNT.password, 10);
  const existing = await prisma.user.findUnique({
    where: { email: PILOT_ACCOUNT.email },
  });

  if (existing) {
    return prisma.user.update({
      where: { userId: existing.userId },
      data: {
        name: PILOT_ACCOUNT.name,
        prediktHandle: PILOT_ACCOUNT.handle,
        passwordHash,
        status: 'active',
      },
    });
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: PILOT_ACCOUNT.email,
        name: PILOT_ACCOUNT.name,
        prediktHandle: PILOT_ACCOUNT.handle,
        passwordHash,
        creditBalance: PILOT_ACCOUNT.signupCredits,
      },
    });

    await tx.creditLedger.create({
      data: {
        userId: user.userId,
        eventType: 'signup',
        delta: PILOT_ACCOUNT.signupCredits,
        balanceAfter: PILOT_ACCOUNT.signupCredits,
        sourceType: 'auth',
        idempotencyKey: `signup:${user.userId}`,
        metadata: { label: 'Signup credit bonus', pilotSeed: true },
      },
    });

    return user;
  });
}

async function main() {
  const user = await ensurePilotUser();

  console.log('My Prediktion pilot account ready.');
  console.log('');
  console.log('  Email:    ', PILOT_ACCOUNT.email);
  console.log('  Password: ', PILOT_ACCOUNT.password);
  console.log('  Handle:   ', PILOT_ACCOUNT.handle);
  console.log('  Credits:  ', user.creditBalance);
  console.log('');
  console.log('This account has no seeded rooms, predictions, or notifications.');
  console.log('Use it for first-time MVP / pilot walkthroughs.');
  console.log('');
  console.log('For a pre-filled QA dashboard, use: npm run seed:engagement-demo');
  console.log('  Email: test@predikt.ai  Password: Password123!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
