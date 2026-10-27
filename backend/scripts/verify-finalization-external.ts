import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { LifecycleService } from '../src/lifecycle/lifecycle.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { BadgeService } from '../src/badges/badge.service';
import { RewardService } from '../src/rewards/reward.service';
import { seedRewardRules } from '../src/rewards/seed-reward-rules';

// Supplemental real-Postgres checks only for previously uncovered external effects.
const target = new URL(process.env.TEST_DATABASE_URL ?? '');
assert(['127.0.0.1', 'localhost'].includes(target.hostname), 'Loopback DB only');
assert(/test|ui|reconcile/.test(target.pathname), 'Disposable test DB required');
const db = new PrismaClient({ datasources: { db: { url: target.href } } });
const db2 = new PrismaClient({ datasources: { db: { url: target.href } } });
const noop = { log: async () => undefined, notifyRoomMembers: async () => undefined };
const service = (client: any) => new LifecycleService(client, noop as any, noop as any, {} as any, {} as any) as any;
const fullService = (client: any, notifications?: any) => {
  const audit = { log: async () => undefined };
  return new LifecycleService(
    client,
    audit as any,
    notifications ?? new NotificationsService(client),
    new BadgeService(client, audit as any),
    new RewardService(client),
  );
};
const report: Record<string, unknown> = {};
async function scenario(name: string, fn: () => Promise<void>) {
  try { await fn(); report[name] = 'PASS'; } catch (e) { report[name] = `FAIL: ${(e as Error).message}`; process.exitCode = 1; }
}
async function fixture() {
  const user = await db.user.create({ data: { name: 'Local external effects test' } });
  const room = await db.predictionRoom.create({ data: {
    creatorUserId: user.userId, roomTitle: 'Local external effects test', eventType: 'arrival_time',
    startingPointLabel: 'Hidden', destinationLabel: 'Hidden', inviteCode: `T${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`,
    predictionCloseTime: new Date(),
  } });
  return { user, room };
}
const ACTUAL = new Date('2026-10-27T12:00:00.000Z');
async function scoredRoom() {
  const host = await db.user.create({ data: { name: 'Local recovery host' } });
  const alice = await db.user.create({ data: { name: 'Local recovery alice' } });
  const bob = await db.user.create({ data: { name: 'Local recovery bob' } });
  const room = await db.predictionRoom.create({ data: {
    creatorUserId: host.userId, roomTitle: 'Local recovery room', eventType: 'arrival_time', category: 'arrival_time',
    startingPointLabel: 'Hidden', destinationLabel: 'Hidden', inviteCode: `R${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    predictionCloseTime: ACTUAL, status: 'live',
  } });
  const milestone = await db.roomMilestone.create({ data: {
    roomId: room.roomId, milestoneOrder: 1, milestoneName: 'Destination', milestoneType: 'final_destination', status: 'pending',
  } });
  await db.milestonePrediction.create({ data: {
    milestoneId: milestone.milestoneId, roomId: room.roomId, userId: alice.userId,
    predictedReachedTime: new Date('2026-10-27T11:50:00.000Z'), submittedAt: new Date('2026-10-27T10:00:00.000Z'), lockedStatus: true,
  } });
  await db.milestonePrediction.create({ data: {
    milestoneId: milestone.milestoneId, roomId: room.roomId, userId: bob.userId,
    predictedReachedTime: new Date('2026-10-27T11:40:00.000Z'), submittedAt: new Date('2026-10-27T10:05:00.000Z'), lockedStatus: true,
  } });
  for (const userId of [alice.userId, bob.userId]) {
    await db.roomMembership.create({ data: { roomId: room.roomId, userId, role: 'member', status: 'joined', joinedAt: ACTUAL } });
  }
  return { host, alice, bob, room, milestone };
}
async function userEconomy(userId: string, roomId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { userId } });
  const account = await db.rewardAccount.findUnique({ where: { userId } });
  const sum = async (model: 'auraTransaction' | 'cloutTransaction', where: Record<string, string>) =>
    (await (db[model] as any).aggregate({ where, _sum: { amount: true } }))._sum.amount ?? 0;
  const reward = async (rewardType: string) => {
    const rows = await db.rewardLedgerEntry.aggregate({ where: { userId, rewardType: rewardType as any }, _sum: { amount: true }, _count: true });
    return { rows: rows._count, sum: rows._sum.amount ?? 0 };
  };
  return {
    aura: user.totalAura, clout: user.cloutBalance, credit: user.creditBalance, wins: user.winsCount,
    auraBalance: account?.auraBalance ?? 0, gemBalance: account?.gemBalance ?? 0,
    auraRows: await db.auraTransaction.count({ where: { userId, roomId } }),
    auraSum: await sum('auraTransaction', { userId, roomId }),
    cloutRows: await db.cloutTransaction.count({ where: { userId, roomId } }),
    cloutSum: await sum('cloutTransaction', { userId, roomId }),
    auraLedger: await reward('AURA'), gemLedger: await reward('GEMS'),
  };
}
function assertTimedEconomy(snapshot: { host: any; alice: any; bob: any }, scores: { aliceRank: number | null; bobRank: number | null }) {
  assert.deepEqual(snapshot.alice, {
    aura: 5, clout: 190, credit: 0, wins: 1, auraBalance: 5, gemBalance: 70,
    auraRows: 1, auraSum: 5, cloutRows: 3, cloutSum: 190, auraLedger: { rows: 1, sum: 5 }, gemLedger: { rows: 3, sum: 70 },
  });
  assert.deepEqual(snapshot.bob, {
    aura: 5, clout: 30, credit: 0, wins: 0, auraBalance: 5, gemBalance: 0,
    auraRows: 1, auraSum: 5, cloutRows: 2, cloutSum: 30, auraLedger: { rows: 1, sum: 5 }, gemLedger: { rows: 0, sum: 0 },
  });
  assert.equal(snapshot.host.credit, 15);
  assert.equal(snapshot.host.clout, 0);
  assert.equal(snapshot.host.aura, 0);
  assert.equal(scores.aliceRank, 1);
  assert.equal(scores.bobRank, 2);
}
async function main() {
  await seedRewardRules(db);
  await scenario('creator_credit_partial_failure_then_retry', async () => {
    const { user, room } = await fixture();
    let fail = true;
    const wrap = (client: any): any => new Proxy(client, { get(obj, key) {
      if (key === '$transaction') return (fn: any) => db.$transaction(tx => fn(wrap(tx)));
      if (key === 'creditLedger') return new Proxy(obj.creditLedger, { get(ledger, method) {
        if (method === 'create') return (args: any) => { if (fail) throw new Error('injected ledger failure'); return ledger.create(args); };
        const v = ledger[method]; return typeof v === 'function' ? v.bind(ledger) : v;
      } });
      const v = obj[key]; return typeof v === 'function' ? v.bind(obj) : v;
    } });
    const s = service(wrap(db));
    await assert.rejects(s.awardResultDeclaredCredits(room.roomId, user.userId), /injected ledger failure/);
    assert.equal((await db.user.findUniqueOrThrow({ where: { userId: user.userId } })).creditBalance, 0, 'balance must roll back when ledger fails');
    fail = false;
    await s.awardResultDeclaredCredits(room.roomId, user.userId);
    await s.awardResultDeclaredCredits(room.roomId, user.userId);
    assert.equal((await db.user.findUniqueOrThrow({ where: { userId: user.userId } })).creditBalance, 15);
    assert.equal(await db.creditLedger.count({ where: { sourceId: room.roomId } }), 1);
  });
  await scenario('creator_credit_eight_contenders', async () => {
    const { user, room } = await fixture();
    const settled = await Promise.allSettled(Array.from({ length: 8 }, () => service(db).awardResultDeclaredCredits(room.roomId, user.userId)));
    assert(settled.every(r => r.status === 'fulfilled'), 'all retries must complete without a unique-key error');
    assert.equal((await db.user.findUniqueOrThrow({ where: { userId: user.userId } })).creditBalance, 15);
    assert.equal(await db.creditLedger.count({ where: { sourceId: room.roomId } }), 1);
  });
  await scenario('flex_eight_contenders_and_retry', async () => {
    const { user, room } = await fixture();
    const run = () => db.$transaction(tx => service(db).ensureFlex(tx, user.userId, 'room_champion', room.roomId));
    await Promise.all(Array.from({ length: 8 }, run)); await run();
    assert.equal(await db.userFlex.count({ where: { userId: user.userId, roomId: room.roomId } }), 1);
  });
  await scenario('drop_cap_two_users_eight_contenders', async () => {
    const { user, room } = await fixture();
    const other = await db.user.create({ data: { name: 'Local second contender' } });
    const drop = await db.drop.create({ data: { title: 'Local capped test', dropType: 'flex' } });
    await db.roomDropRule.create({ data: { roomId: room.roomId, dropId: drop.dropId, ruleType: 'overall_winner', maxWinners: 1 } });
    await Promise.all(Array.from({ length: 8 }, (_, i) => db.$transaction(tx => service(db).ensureDropAwards(tx, room.roomId, i % 2 ? other.userId : user.userId, 'overall_winner'))));
    assert.equal(await db.userDrop.count({ where: { roomId: room.roomId, dropId: drop.dropId } }), 1, 'shared cap must hold across different beneficiaries');
  });
  await scenario('badge_eight_contenders_then_post_award_failure_retry', async () => {
    const { user, room } = await fixture();
    const badges = new BadgeService(db as any, noop as any);
    const input = { userId: user.userId, roomId: room.roomId, badgeKey: 'route_oracle' };
    const rows = await Promise.all(Array.from({ length: 8 }, () => badges.ensureBadge(input)));
    assert.equal(new Set(rows.map(r => r?.userBadgeId)).size, 1);
    await assert.rejects((async () => { await badges.ensureBadge(input); throw new Error('injected downstream gem failure'); })(), /injected downstream/);
    assert.equal((await badges.ensureBadge(input))?.userBadgeId, rows[0]?.userBadgeId);
    assert.equal(await db.userBadge.count({ where: { userId: user.userId, roomId: room.roomId } }), 1);
  });
  await scenario('notification_eight_contenders_and_partial_fanout_retry', async () => {
    const { user, room } = await fixture();
    const other = await db.user.create({ data: { name: 'Local notification recipient' } });
    const notifications = new NotificationsService(db as any);
    const base = { roomId: room.roomId, type: 'result_ready', title: 'Local result', body: 'Ready', idempotencyKey: `result_ready:${room.roomId}` };
    await Promise.all(Array.from({ length: 8 }, () => notifications.create({ ...base, userId: user.userId })));
    // A failed fanout may leave one recipient delivered; retry must deliver the
    // missing recipient without duplicating the successful recipient.
    await notifications.create({ ...base, userId: user.userId });
    await notifications.create({ ...base, userId: other.userId });
    assert.equal(await db.userNotification.count({ where: { roomId: room.roomId, userId: user.userId } }), 1);
    assert.equal(await db.userNotification.count({ where: { roomId: room.roomId, userId: other.userId } }), 1);
  });
  await scenario('partial_score_then_end_recovers_without_duplicating', async () => {
    const { host, alice, bob, room, milestone } = await scoredRoom();
    let failBob = true;
    const wrap = (client: any): any => new Proxy(client, { get(obj, key) {
      if (key === '$transaction') return (fn: any) => db.$transaction((tx) => fn(wrap(tx)));
      if (key === 'auraTransaction') return new Proxy(obj.auraTransaction, { get(model, method) {
        if (method === 'create') return (args: any) => {
          if (failBob && args?.data?.userId === bob.userId) throw new Error('injected scoring failure');
          return model.create(args);
        };
        const value = model[method]; return typeof value === 'function' ? value.bind(model) : value;
      } });
      const value = obj[key]; return typeof value === 'function' ? value.bind(obj) : value;
    } });
    const failing = fullService(wrap(db), new NotificationsService(db as any));
    await assert.rejects(failing.reachMilestone(room.roomId, milestone.milestoneId, { actualReachedTime: ACTUAL.toISOString() }, host), /injected scoring failure/);
    const reached = await db.roomMilestone.findUniqueOrThrow({ where: { milestoneId: milestone.milestoneId } });
    assert.equal(reached.status, 'reached', 'reached is committed before scoring finishes');
    assert.equal((await db.predictionRoom.findUniqueOrThrow({ where: { roomId: room.roomId } })).status, 'live');
    const aliceAfterFail = await userEconomy(alice.userId, room.roomId);
    const bobAfterFail = await userEconomy(bob.userId, room.roomId);
    assert.equal(aliceAfterFail.auraRows, 1);
    assert.equal(aliceAfterFail.auraSum, 5);
    assert.equal(aliceAfterFail.cloutSum, 30);
    assert.equal(bobAfterFail.auraRows, 0);
    assert.equal(bobAfterFail.cloutSum, 0);
    assert.equal((await db.milestonePrediction.findFirstOrThrow({ where: { roomId: room.roomId, userId: bob.userId } })).rankForMilestone, null);
    failBob = false;
    await fullService(db).reachMilestone(room.roomId, milestone.milestoneId, { actualReachedTime: ACTUAL.toISOString() }, host);
    assert.equal((await userEconomy(alice.userId, room.roomId)).auraRows, 1);
    assert.equal((await userEconomy(alice.userId, room.roomId)).cloutSum, 30);
    assert.equal((await userEconomy(bob.userId, room.roomId)).auraSum, 5);
    assert.equal((await db.predictionRoom.findUniqueOrThrow({ where: { roomId: room.roomId } })).status, 'live');
    await assert.rejects(fullService(db).reachMilestone(room.roomId, milestone.milestoneId, { actualReachedTime: ACTUAL.toISOString() }, host), /already reached/);
    await fullService(db).end(room.roomId, { actualEndTime: ACTUAL.toISOString() }, host);
    const scores = {
      aliceRank: (await db.milestonePrediction.findFirstOrThrow({ where: { roomId: room.roomId, userId: alice.userId } })).rankForMilestone,
      bobRank: (await db.milestonePrediction.findFirstOrThrow({ where: { roomId: room.roomId, userId: bob.userId } })).rankForMilestone,
    };
    const snapshot = { host: await userEconomy(host.userId, room.roomId), alice: await userEconomy(alice.userId, room.roomId), bob: await userEconomy(bob.userId, room.roomId) };
    assertTimedEconomy(snapshot, scores);
    assert.equal((await db.creditLedger.count({ where: { sourceId: room.roomId, delta: 15 } })), 1);
    await assert.rejects(fullService(db).reachMilestone(room.roomId, milestone.milestoneId, {}, host), /must be live/);
  });
  await scenario('terminal_retry_partial_fanout_recovers_without_rewriting_completion', async () => {
    const { host, alice, bob, room } = await scoredRoom();
    const real = new NotificationsService(db as any);
    let failFanout = true;
    const notifications = {
      create: (input: any) => real.create(input),
      notifyRoomMembers: async (input: any) => {
        if (!failFanout || input.type !== 'result_ready') return real.notifyRoomMembers(input);
        const members = await db.roomMembership.findMany({ where: { roomId: input.roomId, status: 'joined' }, select: { userId: true } });
        const ids = [...new Set([host.userId, ...members.map((member) => member.userId)])].sort();
        await real.create({ ...input, userId: ids[0], metadata: input.metadata, idempotencyKey: `${input.idempotencyKey}:${ids[0]}` });
        throw new Error('injected post-completion notification failure');
      },
    };
    const failing = fullService(db, notifications);
    await assert.rejects(failing.end(room.roomId, { actualEndTime: ACTUAL.toISOString() }, host), /injected post-completion/);
    const committed = await db.predictionRoom.findUniqueOrThrow({ where: { roomId: room.roomId } });
    assert.equal(committed.status, 'completed');
    assert.equal(committed.outcomeSource, 'host_declared');
    assert.equal(await db.userNotification.count({ where: { roomId: room.roomId, type: 'result_ready' } }), 1);
    assert.equal((await userEconomy(host.userId, room.roomId)).credit, 15);
    failFanout = false;
    const outsider = await db.user.create({ data: { name: 'Local recovery outsider' } });
    await assert.rejects(fullService(db2).end(room.roomId, {}, outsider), /creator/);
    await fullService(db2).end(room.roomId, { outcomeSource: 'arrival_confirmed', actualEndTime: '2020-01-01T00:00:00.000Z' }, host);
    const recovered = await db.predictionRoom.findUniqueOrThrow({ where: { roomId: room.roomId } });
    assert.equal(recovered.outcomeSource, 'host_declared');
    assert.equal(recovered.arrivalConfirmedAt?.toISOString(), committed.arrivalConfirmedAt?.toISOString());
    assert.equal(recovered.actualEndTime?.toISOString(), committed.actualEndTime?.toISOString());
    const beforeReplay = {
      host: await userEconomy(host.userId, room.roomId),
      alice: await userEconomy(alice.userId, room.roomId),
      bob: await userEconomy(bob.userId, room.roomId),
    };
    assertTimedEconomy(beforeReplay, {
      aliceRank: (await db.milestonePrediction.findFirstOrThrow({ where: { roomId: room.roomId, userId: alice.userId } })).rankForMilestone,
      bobRank: (await db.milestonePrediction.findFirstOrThrow({ where: { roomId: room.roomId, userId: bob.userId } })).rankForMilestone,
    });
    for (const userId of [host.userId, alice.userId, bob.userId]) {
      assert.equal(await db.userNotification.count({ where: { roomId: room.roomId, userId, type: 'result_ready' } }), 1);
    }
    const events = await db.liveLocationEvent.count({ where: { roomId: room.roomId } });
    await fullService(db).previewArrivalConfirmation(room.roomId, host, { location: { lat: 1, lng: 2 } });
    assert.equal(await db.liveLocationEvent.count({ where: { roomId: room.roomId } }), events);
    await fullService(db2).end(room.roomId, {}, host);
    const afterReplay = {
      host: await userEconomy(host.userId, room.roomId),
      alice: await userEconomy(alice.userId, room.roomId),
      bob: await userEconomy(bob.userId, room.roomId),
    };
    assert.deepEqual(afterReplay, beforeReplay);
    assert.equal(await db.creditLedger.count({ where: { sourceId: room.roomId } }), 2);
  });
  await scenario('separate_connection_score_and_finalize_contention', async () => {
    const { host, alice, bob, room, milestone } = await scoredRoom();
    const settled = await Promise.allSettled([
      fullService(db).reachMilestone(room.roomId, milestone.milestoneId, { actualReachedTime: ACTUAL.toISOString() }, host),
      fullService(db2).end(room.roomId, { actualEndTime: ACTUAL.toISOString() }, host),
    ]);
    assert(settled.some((entry) => entry.status === 'fulfilled'), 'one connection must finish');
    await fullService(db).end(room.roomId, {}, host);
    await fullService(db2).end(room.roomId, {}, host);
    assertTimedEconomy({
      host: await userEconomy(host.userId, room.roomId),
      alice: await userEconomy(alice.userId, room.roomId),
      bob: await userEconomy(bob.userId, room.roomId),
    }, {
      aliceRank: (await db.milestonePrediction.findFirstOrThrow({ where: { roomId: room.roomId, userId: alice.userId } })).rankForMilestone,
      bobRank: (await db.milestonePrediction.findFirstOrThrow({ where: { roomId: room.roomId, userId: bob.userId } })).rankForMilestone,
    });
    assert.equal(await db.userNotification.count({ where: { roomId: room.roomId, type: 'result_ready' } }), 3);
  });
  await scenario('bounded_eight_finalization_contention', async () => {
    const { host, alice, bob, room } = await scoredRoom();
    const settled = await Promise.allSettled(Array.from({ length: 8 }, (_, index) =>
      fullService(index % 2 === 0 ? db : db2).end(room.roomId, { actualEndTime: ACTUAL.toISOString() }, host)));
    report.bounded_contention_fulfilled = settled.filter((entry) => entry.status === 'fulfilled').length;
    report.bounded_contention_rejected = settled.filter((entry) => entry.status === 'rejected').map((entry) => (entry.reason as Error).message);
    assert.equal(report.bounded_contention_fulfilled, 8);
    await fullService(db).end(room.roomId, {}, host);
    await fullService(db2).end(room.roomId, {}, host);
    assertTimedEconomy({
      host: await userEconomy(host.userId, room.roomId),
      alice: await userEconomy(alice.userId, room.roomId),
      bob: await userEconomy(bob.userId, room.roomId),
    }, {
      aliceRank: (await db.milestonePrediction.findFirstOrThrow({ where: { roomId: room.roomId, userId: alice.userId } })).rankForMilestone,
      bobRank: (await db.milestonePrediction.findFirstOrThrow({ where: { roomId: room.roomId, userId: bob.userId } })).rankForMilestone,
    });
    assert.equal(await db.creditLedger.count({ where: { sourceId: room.roomId, eventType: 'result_finalization' } }), 1);
    assert.equal(await db.userNotification.count({ where: { roomId: room.roomId, type: 'result_ready' } }), 3);
    assert.equal(await db.userNotification.count({ where: { roomId: room.roomId, type: 'winner_declared' } }), 3);
  });
  await scenario('cancelled_room_does_not_recover_rewards', async () => {
    const { host, room } = await scoredRoom();
    await db.predictionRoom.update({ where: { roomId: room.roomId }, data: { status: 'cancelled' } });
    await assert.rejects(fullService(db).end(room.roomId, {}, host), /cancelled/);
    assert.equal(await db.creditLedger.count({ where: { sourceId: room.roomId } }), 0);
    assert.equal(await db.auraTransaction.count({ where: { roomId: room.roomId } }), 0);
  });
  await scenario('terminal_retry_without_predictions_recovers', async () => {
    const { user, room } = await fixture();
    await db.predictionRoom.update({ where: { roomId: room.roomId }, data: { status: 'live' } });
    let fail = true;
    const notifications = { notifyRoomMembers: async () => { if (fail) throw new Error('injected post-completion notification failure'); return []; } };
    const s = new LifecycleService(db as any, noop as any, notifications as any, { awardRoomBadges: async () => [] } as any, {} as any);
    await assert.rejects(s.end(room.roomId, {}, user), /injected post-completion/);
    assert.equal((await db.predictionRoom.findUniqueOrThrow({ where: { roomId: room.roomId } })).status, 'completed');
    assert.equal((await db.user.findUniqueOrThrow({ where: { userId: user.userId } })).creditBalance, 15);
    fail = false;
    await s.end(room.roomId, { outcomeSource: 'arrival_confirmed' }, user);
    const after = await db.predictionRoom.findUniqueOrThrow({ where: { roomId: room.roomId } });
    assert.equal(after.outcomeSource, 'host_declared');
    assert.equal((await db.user.findUniqueOrThrow({ where: { userId: user.userId } })).creditBalance, 15);
    assert.equal(await db.creditLedger.count({ where: { sourceId: room.roomId, eventType: 'result_finalization' } }), 1);
    assert.equal(await db.creditLedger.count({ where: { sourceId: room.roomId, delta: 15 } }), 1);
  });
  console.log(JSON.stringify(report, null, 2));
}
main().finally(() => Promise.all([db.$disconnect(), db2.$disconnect()])).catch(e => { console.error(e.message); process.exitCode = 1; });
