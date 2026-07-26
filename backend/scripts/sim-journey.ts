/* eslint-disable no-console */
/**
 * End-to-end simulated Bangalore journey against the LOCAL dev DB, exercising the
 * full Travel ETA overhaul through the real services (no HTTP, no real device):
 *   create -> creator predicts -> forwarded invites -> guests predict (hot takes)
 *   -> lock -> dynamic checkpoint recompute (20/40/60/80/90) -> live leaderboard
 *   updates -> arrival -> winner broadcast + in-app notifications.
 *
 * Run: FEATURE_CHECKPOINT_LEADERBOARD_V2=true npx ts-node scripts/sim-journey.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RoomsService } from '../src/rooms/rooms.service';
import { PredictionsService } from '../src/predictions/predictions.service';
import { LifecycleService } from '../src/lifecycle/lifecycle.service';
import { LiveProgressService } from '../src/live-progress/live-progress.service';
import { LeaderboardsService } from '../src/leaderboards/leaderboards.service';

const banner = (t: string) => console.log(`\n=== ${t} ===`);

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const rooms = app.get(RoomsService);
  const predictions = app.get(PredictionsService);
  const lifecycle = app.get(LifecycleService);
  const live = app.get(LiveProgressService);
  const boards = app.get(LeaderboardsService);
  const s = Date.now();

  // Indiranagar -> Koramangala, ~30 min. Route waypoints for checkpoints.
  const START = { lat: 12.9719, lng: 77.6412 };
  const DEST = { lat: 12.9352, lng: 77.6245 };
  const leg = (f: number) => ({ lat: START.lat + (DEST.lat - START.lat) * f, lng: START.lng + (DEST.lng - START.lng) * f });

  banner('CAST');
  const creator = await prisma.user.create({ data: { name: 'Meera (creator)', prediktHandle: `meera_${s}`, status: 'active' } });
  const rohan = await prisma.user.create({ data: { name: 'Rohan', prediktHandle: `rohan_${s}`, isGuest: true, guestKey: `r_${s}`, status: 'active' } });
  const aisha = await prisma.user.create({ data: { name: 'Aisha', prediktHandle: `aisha_${s}`, isGuest: true, guestKey: `a_${s}`, status: 'active' } });
  const dev = await prisma.user.create({ data: { name: 'Dev', prediktHandle: `dev_${s}`, isGuest: true, guestKey: `d_${s}`, status: 'active' } });
  console.log('creator=Meera, guests=Rohan, Aisha, Dev');

  banner('1. CREATE ROOM (Indiranagar -> Koramangala)');
  const room = await rooms.create(
    {
      roomTitle: 'Arrival PREDIKT: Indiranagar → Koramangala', eventType: 'arrival_time', category: 'arrival_time',
      templateKey: 'arrival_time', question: 'When will I reach Koramangala?', mode: 'friends', roomCategory: 'journey',
      answerType: 'exact_time', predictionMode: 'milestone', journeyStatus: 'scheduled', expectedDurationSeconds: 1800,
      gracePeriodSeconds: 900, startingPointLabel: 'Indiranagar, Bengaluru', destinationLabel: 'Koramangala, Bengaluru',
      startingLat: START.lat, startingLng: START.lng, destinationLat: DEST.lat, destinationLng: DEST.lng,
      predictionCloseTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), visibility: 'invite_only',
    } as never,
    { userId: creator.userId, name: creator.name, isGuest: false } as never,
  );
  const milestone = await prisma.roomMilestone.findFirstOrThrow({ where: { roomId: room.roomId, milestoneType: 'final_destination' } });
  console.log('roomId=', room.roomId, 'inviteCode=', room.inviteCode);

  const baseTime = new Date(Date.now() - 25 * 60 * 1000); // journey started 25 min ago
  const arrival = new Date(baseTime.getTime() + 30 * 60 * 1000); // actual ~30 min trip
  const predictAt = (mins: number, hotTake?: string) => ({ predictions: [{ milestoneId: milestone.milestoneId, predictedReachedTime: new Date(baseTime.getTime() + mins * 60 * 1000).toISOString(), hotTake }] });

  banner('2. CREATOR PREDICTS OWN ROOM (recorded, cannot win)');
  await predictions.submitMilestonePredictions(room.roomId, predictAt(31) as never, creator as never);
  console.log('Meera predicts 31 min (on record; excluded from winning)');

  banner('3. FORWARDED INVITES (Rohan forwards to Aisha + Dev)');
  await rooms.join(room.roomId, rohan as never); // rohan joins from creator's link
  await rooms.join(room.roomId, aisha as never, rohan.userId); // forwarded by Rohan
  await rooms.join(room.roomId, dev as never, rohan.userId); // forwarded by Rohan
  const fwd = await prisma.userNotification.findMany({ where: { roomId: room.roomId, type: 'invite_forwarded' }, orderBy: { createdAt: 'asc' } });
  fwd.forEach((n) => console.log('  creator sees:', n.body));

  banner('4. GUESTS PREDICT (with hot takes)');
  await predictions.submitMilestonePredictions(room.roomId, predictAt(29, 'Traffic clears after 8pm 🚗') as never, aisha as never);
  await predictions.submitMilestonePredictions(room.roomId, predictAt(36, 'Silk Board will eat 6 minutes') as never, dev as never);
  await predictions.submitMilestonePredictions(room.roomId, predictAt(27) as never, rohan as never);
  console.log('Aisha 29m, Dev 36m, Rohan 27m');

  banner('5. LEADERBOARD BEFORE LOCK (must be hidden)');
  const pre = await boards.liveLeaderboard(room.roomId, aisha as never);
  console.log('revealed=', pre.revealed, 'reason=', (pre as any).reason);

  banner('6. LOCK NOW (Aisha locks -> instant reveal)');
  await predictions.lockNow(room.roomId, aisha as never);
  await prisma.predictionRoom.update({ where: { roomId: room.roomId }, data: { status: 'live', journeyStatus: 'live', startTime: baseTime, journeyStartedAt: baseTime } });

  banner('7. DYNAMIC CHECKPOINTS (GPS at 20/40/60/80/90 -> recompute + snapshots)');
  for (const pct of [20, 40, 60, 80, 90]) {
    const p = leg(pct / 100);
    const res: any = await live.recordClientCheckpoint(room.roomId, { checkpointPct: pct, lat: p.lat, lng: p.lng } as never, creator as never);
    const lb: any = await boards.liveLeaderboard(room.roomId, dev as never);
    const leader = lb.standings?.find((r: any) => r.isWinnerSoFar);
    const topRaw = lb.standings?.[0];
    console.log(`  @${pct}%  eta=${res.etaSeconds}s src=${res.source} recompDur=${res.recomputedDurationSeconds}s | winner-so-far=@${leader?.prediktHandle} (${leader?.diffFromProjectedSeconds}s off) | closest-overall=@${topRaw?.prediktHandle}${topRaw?.isHost ? ' (host, excluded)' : ''}`);
  }
  const snaps = await prisma.roomMilestoneSnapshot.count({ where: { roomId: room.roomId } });
  const billable = await prisma.roomMilestoneSnapshot.count({ where: { roomId: room.roomId, source: { notIn: ['derived', 'fallback'] } } });
  console.log(`  snapshots=${snaps}, billable Maps calls=${billable} (cap 5)`);

  banner('8. CONFIRM ARRIVAL (within 2km geofence -> finalize + winner)');
  await lifecycle.previewArrivalConfirmation(room.roomId, creator as never, { location: { lat: DEST.lat, lng: DEST.lng }, confirmAnyway: true, actualEndTime: arrival.toISOString() } as never);

  banner('9. FINAL LEADERBOARD + WINNER BROADCAST');
  const results = await prisma.roomResult.findMany({ where: { roomId: room.roomId }, include: { user: true }, orderBy: { overallRank: 'asc' } });
  results.forEach((r) => console.log(`  #${r.overallRank} @${r.user.prediktHandle} aura=${r.totalRoomAura}`));
  const winnerNotifs = await prisma.userNotification.findMany({ where: { roomId: room.roomId, type: 'winner_declared' } });
  console.log(`  winner notifications delivered to ${winnerNotifs.length} participants:`);
  if (winnerNotifs[0]) console.log('   "' + winnerNotifs[0].body + '"');

  await app.close();
}
main().catch((e) => { console.error('SIM ERROR:', e); process.exit(1); });
