import { BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RoomsService } from './rooms.service';

// Writes only to the disposable local wave1_test database.
describe('first room credit (disposable PostgreSQL)', () => {
  jest.setTimeout(30_000);

  const prisma = new PrismaClient();
  const roomIds: string[] = [];
  const userIds: string[] = [];
  let service: RoomsService;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.includes('wave1_test')) {
      throw new Error('Requires disposable local wave1_test database');
    }
    await prisma.$connect();
    service = new RoomsService(
      prisma as never,
      { log: jest.fn() } as never,
      {} as never,
      { grant: jest.fn() } as never,
    );
  });

  afterAll(async () => {
    if (roomIds.length || userIds.length) {
      await prisma.roomMembership.deleteMany({
        where: {
          OR: [
            ...(roomIds.length ? [{ roomId: { in: roomIds } }] : []),
            ...(userIds.length ? [{ userId: { in: userIds } }] : []),
          ],
        },
      });
      if (roomIds.length) {
        await prisma.roomMilestone.deleteMany({ where: { roomId: { in: roomIds } } });
      }
      if (userIds.length || roomIds.length) {
        await prisma.creditLedger.deleteMany({
          where: {
            OR: [
              ...(userIds.length ? [{ userId: { in: userIds } }] : []),
              ...(roomIds.length ? [{ sourceId: { in: roomIds } }] : []),
            ],
          },
        });
      }
      if (roomIds.length) {
        await prisma.predictionRoom.deleteMany({ where: { roomId: { in: roomIds } } });
      }
      if (userIds.length) {
        await prisma.user.deleteMany({ where: { userId: { in: userIds } } });
      }
    }
    await prisma.$disconnect();
  });

  it('grants exactly one +15 first_room credit and leaves signup ledger and other balances intact', async () => {
    const creator = await seedUser('grant');
    const bystander = await seedUser('bystander');

    const roomId = await createRoom(creator.userId, 'First eligible room');

    const grants = await firstRoomGrants(creator.userId);
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({
      eventType: 'first_room',
      delta: 15,
      balanceAfter: 45,
      sourceId: roomId,
      sourceType: 'room',
      idempotencyKey: `first_room:${creator.userId}`,
    });

    const creatorRow = await prisma.user.findUniqueOrThrow({ where: { userId: creator.userId } });
    expect(creatorRow.creditBalance).toBe(45);
    expect(creatorRow.roomsCreatedCount).toBe(1);

    const signup = await prisma.creditLedger.findMany({
      where: { userId: creator.userId, eventType: 'signup' },
    });
    expect(signup).toHaveLength(1);
    expect(signup[0]).toMatchObject({ delta: 30, balanceAfter: 30 });

    const untouched = await prisma.user.findUniqueOrThrow({ where: { userId: bystander.userId } });
    expect(untouched.creditBalance).toBe(30);
    expect(untouched.roomsCreatedCount).toBe(0);
    expect(await prisma.creditLedger.count({ where: { userId: bystander.userId } })).toBe(1);
    expect(await prisma.creditLedger.count({
      where: { userId: bystander.userId, eventType: 'first_room' },
    })).toBe(0);
  });

  it('does not grant again for a second room or a retried create', async () => {
    const creator = await seedUser('second');
    await createRoom(creator.userId, 'First of two');
    await createRoom(creator.userId, 'Second of two');

    expect(await prisma.creditLedger.count({
      where: { userId: creator.userId, eventType: 'first_room' },
    })).toBe(1);
    const creatorRow = await prisma.user.findUniqueOrThrow({ where: { userId: creator.userId } });
    expect(creatorRow.creditBalance).toBe(45);
    expect(creatorRow.roomsCreatedCount).toBe(2);
    expect(await prisma.creditLedger.count({
      where: { userId: creator.userId, eventType: 'signup' },
    })).toBe(1);
  });

  it('keeps a single grant when the same user creates rooms concurrently', async () => {
    const creator = await seedUser('race');
    const created = await Promise.all(
      Array.from({ length: 6 }, (_, index) => createRoom(creator.userId, `Concurrent ${index}`)),
    );

    expect(new Set(created).size).toBe(6);
    expect(await prisma.creditLedger.count({
      where: { userId: creator.userId, eventType: 'first_room' },
    })).toBe(1);
    const creatorRow = await prisma.user.findUniqueOrThrow({ where: { userId: creator.userId } });
    expect(creatorRow.creditBalance).toBe(45);
    expect(creatorRow.roomsCreatedCount).toBe(6);
    const ledger = await prisma.creditLedger.findMany({ where: { userId: creator.userId } });
    expect(ledger.map((entry) => entry.delta).sort((a, b) => a - b)).toEqual([15, 30]);
  });

  it('grants nothing when room creation is rejected', async () => {
    const creator = await seedUser('rejected');

    await expect(
      service.create(roomInput('Office wager'), { userId: creator.userId }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(await prisma.predictionRoom.count({ where: { creatorUserId: creator.userId } })).toBe(0);
    expect(await prisma.creditLedger.count({
      where: { userId: creator.userId, eventType: 'first_room' },
    })).toBe(0);
    const creatorRow = await prisma.user.findUniqueOrThrow({ where: { userId: creator.userId } });
    expect(creatorRow.creditBalance).toBe(30);
    expect(creatorRow.roomsCreatedCount).toBe(0);
    expect(await prisma.creditLedger.count({
      where: { userId: creator.userId, eventType: 'signup' },
    })).toBe(1);
  });

  async function seedUser(label: string) {
    const user = await prisma.user.create({
      data: {
        name: `First room ${label}`,
        email: `first-room-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@predikt.test`,
        creditBalance: 30,
      },
    });
    userIds.push(user.userId);
    await prisma.creditLedger.create({
      data: {
        userId: user.userId,
        eventType: 'signup',
        delta: 30,
        balanceAfter: 30,
        sourceType: 'auth',
        idempotencyKey: `signup:${user.userId}`,
        metadata: { label: 'Signup credit bonus' },
      },
    });
    return user;
  }

  async function createRoom(userId: string, roomTitle: string) {
    const room = await service.create(roomInput(roomTitle), { userId });
    roomIds.push(room.roomId);
    return room.roomId;
  }

  function roomInput(roomTitle: string) {
    return {
      roomTitle,
      eventType: 'journey',
      startingPointLabel: 'Koramangala',
      destinationLabel: 'Airport',
      predictionCloseTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
      visibility: 'invite_only' as const,
      roomCategory: 'custom' as const,
    };
  }

  function firstRoomGrants(userId: string) {
    return prisma.creditLedger.findMany({
      where: { userId, eventType: 'first_room' },
    });
  }
});
