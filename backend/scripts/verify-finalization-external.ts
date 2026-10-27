import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { LifecycleService } from '../src/lifecycle/lifecycle.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { BadgeService } from '../src/badges/badge.service';

// Supplemental real-Postgres checks only for previously uncovered external effects.
const target = new URL(process.env.TEST_DATABASE_URL ?? '');
assert(['127.0.0.1', 'localhost'].includes(target.hostname), 'Loopback DB only');
assert(/test|ui|reconcile/.test(target.pathname), 'Disposable test DB required');
const db = new PrismaClient({ datasources: { db: { url: target.href } } });
const noop = { log: async () => undefined, notifyRoomMembers: async () => undefined };
const service = (client: any) => new LifecycleService(client, noop as any, noop as any, {} as any, {} as any) as any;
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
async function main() {
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
  await scenario('terminal_retry_gap_reproduced_not_fixed', async () => {
    const { user, room } = await fixture();
    await db.predictionRoom.update({ where: { roomId: room.roomId }, data: { status: 'live' } });
    const notifications = { notifyRoomMembers: async () => { throw new Error('injected post-completion notification failure'); } };
    const s = new LifecycleService(db as any, noop as any, notifications as any, {} as any, {} as any);
    await assert.rejects(s.end(room.roomId, {}, user), /injected post-completion/);
    assert.equal((await db.predictionRoom.findUniqueOrThrow({ where: { roomId: room.roomId } })).status, 'completed');
    await assert.rejects(s.end(room.roomId, {}, user), /completed|terminal|already/i);
    assert.equal((await db.user.findUniqueOrThrow({ where: { userId: user.userId } })).creditBalance, 15);
    report.terminal_retry_release_blocker = 'REPRODUCED: end marks completed before external failure; normal retry is rejected. Requires durable recovery/outbox design.';
  });
  console.log(JSON.stringify(report, null, 2));
}
main().finally(() => db.$disconnect()).catch(e => { console.error(e.message); process.exitCode = 1; });
