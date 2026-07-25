/* eslint-disable no-console */
/**
 * Local reproduction harness for the "Confirm Arrival 500" bug.
 * Boots the Nest application context against the LOCAL dev DB, seeds a realistic
 * live arrival journey with one guest prediction, then drives the exact
 * confirm-arrival service path and prints the full error stack if it throws.
 *
 * Run: npx ts-node scripts/repro-arrival-500.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RoomsService } from '../src/rooms/rooms.service';
import { LifecycleService } from '../src/lifecycle/lifecycle.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const rooms = app.get(RoomsService);
  const lifecycle = app.get(LifecycleService);

  const stamp = Date.now();
  const creator = await prisma.user.create({
    data: { name: 'Repro Creator', prediktHandle: `repro_creator_${stamp}`, status: 'active' },
  });
  const guest = await prisma.user.create({
    data: { name: 'Repro Guest', prediktHandle: `repro_guest_${stamp}`, isGuest: true, guestKey: `gk_${stamp}`, status: 'active' },
  });

  // Bengaluru: Indiranagar -> Koramangala, ~30 min drive.
  const startLat = 12.9719, startLng = 77.6412;
  const destLat = 12.9352, destLng = 77.6245;

  const room = await rooms.create(
    {
      roomTitle: 'Repro Arrival PREDIKT',
      eventType: 'arrival_time',
      category: 'arrival_time',
      templateKey: 'arrival_time',
      question: 'When will I reach Koramangala?',
      roomType: 'single_target',
      mode: 'friends',
      roomCategory: 'journey',
      answerType: 'exact_time',
      predictionMode: 'milestone',
      journeyStatus: 'scheduled',
      expectedDurationSeconds: 1800,
      gracePeriodSeconds: 900,
      startingPointLabel: 'Indiranagar, Bengaluru',
      destinationLabel: 'Koramangala, Bengaluru',
      startingLat: startLat,
      startingLng: startLng,
      destinationLat: destLat,
      destinationLng: destLng,
      predictionCloseTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      visibility: 'invite_only',
    } as never,
    { userId: creator.userId, name: creator.name, isGuest: false } as never,
  );

  // Drive it live and give it a final_destination milestone + a guest prediction.
  const startTime = new Date(Date.now() - 20 * 60 * 1000);
  await prisma.predictionRoom.update({
    where: { roomId: room.roomId },
    data: { status: 'live', journeyStatus: 'live', startTime, journeyStartedAt: startTime },
  });

  // rooms.create auto-provisions the final_destination milestone; reuse it.
  let milestone = await prisma.roomMilestone.findFirst({
    where: { roomId: room.roomId, milestoneType: 'final_destination' },
  });
  if (!milestone) {
    milestone = await prisma.roomMilestone.create({
      data: {
        roomId: room.roomId,
        milestoneOrder: 1,
        milestoneName: 'Koramangala',
        milestoneType: 'final_destination',
        status: 'pending',
      },
    });
  }

  await prisma.roomMembership.createMany({
    data: [
      { roomId: room.roomId, userId: creator.userId, role: 'creator', status: 'joined', joinedAt: new Date() },
      { roomId: room.roomId, userId: guest.userId, role: 'guest', status: 'joined', joinedAt: new Date() },
    ],
    skipDuplicates: true,
  });

  await prisma.milestonePrediction.create({
    data: {
      milestoneId: milestone.milestoneId,
      roomId: room.roomId,
      userId: guest.userId,
      predictedReachedTime: new Date(startTime.getTime() + 28 * 60 * 1000),
      submittedAt: new Date(),
    },
  });

  console.log('Seeded room', room.roomId, '- calling previewArrivalConfirmation...');

  try {
    const result = await lifecycle.previewArrivalConfirmation(
      room.roomId,
      creator as never,
      { location: { lat: destLat, lng: destLng }, confirmAnyway: true } as never,
    );
    console.log('CONFIRM-ARRIVAL OK. Result keys:', Object.keys(result ?? {}));
    const winnerNotifs = await prisma.userNotification.findMany({
      where: { roomId: room.roomId, type: 'winner_declared' },
      select: { userId: true, title: true, body: true },
    });
    console.log('WINNER NOTIFICATIONS (', winnerNotifs.length, '):');
    winnerNotifs.forEach((n) => console.log('  ->', n.userId.slice(0, 8), '|', n.title, '|', n.body));
    const roomFinal = await prisma.predictionRoom.findUnique({
      where: { roomId: room.roomId },
      select: { status: true, journeyStatus: true },
    });
    console.log('ROOM FINAL STATE:', roomFinal);
  } catch (err: any) {
    console.error('CONFIRM-ARRIVAL THREW:');
    console.error('  name:', err?.name);
    console.error('  message:', err?.message);
    console.error('  status:', err?.status);
    console.error('  stack:\n', err?.stack);
  } finally {
    // Cleanup seeded rows (best-effort).
    await prisma.milestonePrediction.deleteMany({ where: { roomId: room.roomId } }).catch(() => {});
    await prisma.roomMembership.deleteMany({ where: { roomId: room.roomId } }).catch(() => {});
    await app.close();
  }
}

main().catch((e) => {
  console.error('HARNESS ERROR:', e);
  process.exit(1);
});
