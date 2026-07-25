/* eslint-disable no-console */
/** Verify live leaderboard: hidden before lock, ranked vs snapshot ETA after lock. */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RoomsService } from '../src/rooms/rooms.service';
import { LeaderboardsService } from '../src/leaderboards/leaderboards.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const rooms = app.get(RoomsService);
  const boards = app.get(LeaderboardsService);
  const s = Date.now();

  const creator = await prisma.user.create({ data: { name: 'C', prediktHandle: `lbc_${s}`, status: 'active' } });
  const g1 = await prisma.user.create({ data: { name: 'Aisha', prediktHandle: `aisha_${s}`, status: 'active' } });
  const g2 = await prisma.user.create({ data: { name: 'Dev', prediktHandle: `dev_${s}`, status: 'active' } });

  const room = await rooms.create(
    {
      roomTitle: 'LB Room', eventType: 'arrival_time', category: 'arrival_time', templateKey: 'arrival_time',
      question: 'When?', mode: 'friends', roomCategory: 'journey', answerType: 'exact_time',
      startingPointLabel: 'A', destinationLabel: 'B', startingLat: 12.97, startingLng: 77.64, destinationLat: 12.93, destinationLng: 77.62,
      predictionCloseTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(), visibility: 'invite_only',
    } as never,
    { userId: creator.userId, name: creator.name, isGuest: false } as never,
  );
  const startTime = new Date(Date.now() - 20 * 60 * 1000);
  await prisma.predictionRoom.update({ where: { roomId: room.roomId }, data: { status: 'live', journeyStatus: 'live', startTime, journeyStartedAt: startTime } });
  const milestone = await prisma.roomMilestone.findFirstOrThrow({ where: { roomId: room.roomId, milestoneType: 'final_destination' } });

  // Projected actual arrival = startTime + 30 min. g1 guesses 29 min (closer), g2 guesses 40 min.
  const arrival = new Date(startTime.getTime() + 30 * 60 * 1000);
  await prisma.milestonePrediction.create({ data: { milestoneId: milestone.milestoneId, roomId: room.roomId, userId: g1.userId, predictedReachedTime: new Date(startTime.getTime() + 29 * 60 * 1000), submittedAt: new Date(), hotTake: 'Traffic clears after 8pm' } });
  await prisma.milestonePrediction.create({ data: { milestoneId: milestone.milestoneId, roomId: room.roomId, userId: g2.userId, predictedReachedTime: new Date(startTime.getTime() + 40 * 60 * 1000), submittedAt: new Date() } });

  // BEFORE lock: must be hidden.
  const before = await boards.liveLeaderboard(room.roomId, creator as never);
  console.log('BEFORE LOCK -> revealed:', before.revealed, '| reason:', (before as any).reason);

  // Lock + a snapshot whose ETA projects arrival ~= startTime+30min (captured now, eta = arrival-now).
  const now = new Date();
  await prisma.predictionRoom.update({ where: { roomId: room.roomId }, data: { predictionsLockedAt: now, revealedAt: now, status: 'predictions_locked' } });
  await prisma.roomMilestoneSnapshot.create({ data: { roomId: room.roomId, checkpointPercent: 60, capturedAt: now, etaSeconds: Math.round((arrival.getTime() - now.getTime()) / 1000), remainingMeters: 4000, source: 'google' } });

  const after = await boards.liveLeaderboard(room.roomId, creator as never);
  console.log('AFTER LOCK  -> revealed:', after.revealed, '| basis:', (after as any).basis);
  (after as any).standings.forEach((r: any) =>
    console.log(`  #${r.rank}${r.isWinnerSoFar ? ' 🏆' : '  '} @${r.prediktHandle} delta_from_best=${r.deltaFromBestSeconds}s hotTake=${r.hotTake ?? '-'}`),
  );

  await app.close();
}
main().catch((e) => { console.error('HARNESS ERROR:', e); process.exit(1); });
