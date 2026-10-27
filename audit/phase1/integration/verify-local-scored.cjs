// Read-only verifier. Requires an already-completed HTTP journey; never writes scores/history.
const { PrismaClient } = require('../../../backend/node_modules/@prisma/client');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const url = new URL(process.env.DATABASE_URL);
assert(['localhost', '127.0.0.1'].includes(url.hostname), 'Local DB only');
assert(/test|ui/.test(url.pathname), 'Test database required');
const db = new PrismaClient();
const roomId = process.env.TEST_ROOM_ID;
const deliveryRoomId = process.env.TEST_DELIVERY_ROOM_ID;
(async () => {
  const room = await db.predictionRoom.findUniqueOrThrow({ where: { roomId }, include: { milestones: true } });
  assert.equal(room.status, 'completed');
  assert(room.journeyStartedAt < room.noStartCutoffAt);
  assert(room.actualEndTime && room.arrivalConfirmedAt);
  assert.equal(room.outcomeSource, 'arrival_confirmed');
  const predictions = await db.milestonePrediction.findMany({ where: { roomId, revokedAt: null }, include: { user: { select: { userId: true, prediktHandle: true, name: true } } } });
  const results = await db.roomResult.findMany({ where: { roomId }, orderBy: { overallRank: 'asc' } });
  const aura = await db.auraTransaction.findMany({ where: { roomId } });
  const clout = await db.cloutTransaction.findMany({ where: { roomId } });
  const forwards = await db.inviteForward.findMany({ where: { roomId } });
  assert.equal(forwards.length, 1);
  assert.notEqual(forwards[0].forwarderUserId, 'user-1');
  const rewardEntries = await db.rewardLedgerEntry.findMany({ where: { sourceId: { in: [roomId, ...room.milestones.map(m => m.milestoneId)] } } });
  for (const p of predictions) {
    const actual = room.milestones.find(m => m.milestoneId === p.milestoneId).actualReachedTime;
    const diff = Math.abs(Math.round((p.predictedReachedTime - actual) / 1000));
    assert.equal(p.differenceFromActualSeconds, diff);
    assert(Math.abs(p.differenceFromActualMinutes - diff / 60) < 1e-9);
    assert.equal(aura.filter(a => a.userId === p.userId).reduce((n,a) => n+a.amount,0), p.totalAuraAwarded);
    const grants = rewardEntries.filter(e => e.idempotencyKey === `aura_ms:${p.milestoneId}:${p.userId}`);
    assert.equal(grants.length, 1);
    assert.equal(grants[0].amount, p.totalAuraAwarded);
    const expectedClout = 20 + p.cloutAwarded + 10 + (results[0].userId === p.userId ? 150 : 0);
    assert.equal(clout.filter(c => c.userId === p.userId).reduce((n,c) => n+c.amount,0), expectedClout);
    const rank = p.rankForMilestone;
    const base = diff > 300 ? 5 : ({1:100,2:70,3:40}[rank] ?? 10);
    const bonus = diff === 0 ? 50 : diff <= 10 ? 35 : diff <= 30 ? 25 : diff <= 60 ? 15 : diff <= 120 ? 10 : diff <= 300 ? 5 : 0;
    // Default v1, no AI ETA on this seeded room; scoring uses the pre-end room confidence.
    assert.equal(p.totalAuraAwarded, Math.round((base + bonus) * Number(p.multiplier) * 1.25));
  }
  const firstWin = rewardEntries.filter(e => e.reasonCode === 'GEM_FIRST_WIN');
  assert.equal(firstWin.length, 1);
  assert.equal(firstWin[0].userId, results[0].userId);
  assert.equal(firstWin[0].amount, 50);
  const predictingIds = new Set(predictions.map(p => p.userId));
  assert(aura.every(a => predictingIds.has(a.userId)));
  assert(clout.every(c => predictingIds.has(c.userId)));
  const closest = [...predictions].sort((a,b) => a.differenceFromActualSeconds-b.differenceFromActualSeconds)[0];
  assert.equal(results[0].userId, closest.userId);
  const delivery = await db.milestonePrediction.findMany({ where: { roomId: deliveryRoomId } });
  assert.equal(delivery.length, 1);
  const deliveryRoom = await db.predictionRoom.findUniqueOrThrow({ where: { roomId: deliveryRoomId } });
  assert.equal(delivery[0].predictedReachedTime.toISOString(), deliveryRoom.scoringRule.creatorPredictionIso);
  const evidence = { status: 'PASS', featureCheckpointLeaderboardV2: false, roomId,
    startedAt: room.journeyStartedAt, noStartCutoffAt: room.noStartCutoffAt,
    actualArrival: room.actualEndTime, arrivalConfirmedAt: room.arrivalConfirmedAt,
    winner: closest.user, predictions, results, aura, clout, rewardEntries, forwards,
    delivery: { roomId: deliveryRoomId, creatorPredictionIso: deliveryRoom.scoringRule.creatorPredictionIso, persisted: delivery } };
  fs.writeFileSync(process.env.TEST_EVIDENCE_PATH, JSON.stringify(evidence,null,2)+'\n');
  console.log('PASS: HTTP-persisted arrival, per-guess scoring, reward ledgers, real forward and delivery prediction');
})().finally(() => db.$disconnect()).catch(e => { console.error(e.message); process.exitCode = 1; });
