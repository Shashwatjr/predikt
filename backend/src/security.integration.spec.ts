import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from './app.module';
import { configureApp } from './app.bootstrap';

type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  user: { userId: string; email?: string | null };
};

describe('Security And Enterprise Hardening (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let creatorAuth: AuthPayload;
  let participantAuth: AuthPayload;
  let secondParticipantAuth: AuthPayload;
  let createdRoomIds: string[] = [];
  let createdUserIds: string[] = [];
  let createdAdminUserId: string | null = null;
  let createdAdminRoleId: string | null = null;

  const runId = `hardening-${Date.now()}`;
  const handleSuffix = `${Date.now()}`.slice(-8);

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = process.env.PORT ?? '3000';
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-1234567890';
    process.env.ADMIN_JWT_SECRET =
      process.env.ADMIN_JWT_SECRET ?? 'test-admin-jwt-secret-1234567890';
    process.env.JWT_ACCESS_TTL_SECONDS = process.env.JWT_ACCESS_TTL_SECONDS ?? '900';
    process.env.JWT_REFRESH_TTL_DAYS = process.env.JWT_REFRESH_TTL_DAYS ?? '30';
    process.env.ADMIN_JWT_TTL_SECONDS = process.env.ADMIN_JWT_TTL_SECONDS ?? '3600';
    process.env.CORS_ORIGINS =
      process.env.CORS_ORIGINS ??
      'http://localhost:8081,http://localhost:8082,http://127.0.0.1:8081,http://127.0.0.1:8082';

    prisma = new PrismaClient();
    await prisma.$connect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, app.get(ConfigService));
    await app.init();

    await seedAdmin();
    adminToken = await loginAdmin();

    creatorAuth = await registerUser(
      'Creator Person',
      `${runId}-creator@predikt.test`,
      `creator.${handleSuffix}`,
    );
    participantAuth = await registerUser(
      'Participant One',
      `${runId}-participant1@predikt.test`,
      `participant.${handleSuffix}a`,
    );
    secondParticipantAuth = await registerUser(
      'Participant Two',
      `${runId}-participant2@predikt.test`,
      `participant.${handleSuffix}b`,
    );
    createdUserIds = [
      creatorAuth.user.userId,
      participantAuth.user.userId,
      secondParticipantAuth.user.userId,
    ];
  });

  afterAll(async () => {
    if (createdRoomIds.length) {
      await prisma.userNotification.deleteMany({ where: { roomId: { in: createdRoomIds } } });
      await prisma.roomMembership.deleteMany({ where: { roomId: { in: createdRoomIds } } });
      await prisma.resultReaction.deleteMany({ where: { roomId: { in: createdRoomIds } } });
      await prisma.roomCommentary.deleteMany({ where: { roomId: { in: createdRoomIds } } });
      await prisma.userBadge.deleteMany({ where: { roomId: { in: createdRoomIds } } });
      await prisma.roomDispute.deleteMany({ where: { roomId: { in: createdRoomIds } } });
      await prisma.report.deleteMany({ where: { roomId: { in: createdRoomIds } } });
      await prisma.liveLocationEvent.deleteMany({ where: { roomId: { in: createdRoomIds } } });
      await prisma.auraTransaction.deleteMany({ where: { roomId: { in: createdRoomIds } } });
      await prisma.cloutTransaction.deleteMany({ where: { roomId: { in: createdRoomIds } } });
      await prisma.roomResult.deleteMany({ where: { roomId: { in: createdRoomIds } } });
      await prisma.milestonePrediction.deleteMany({ where: { roomId: { in: createdRoomIds } } });
      await prisma.roomMilestone.deleteMany({ where: { roomId: { in: createdRoomIds } } });
      await prisma.journeyRoute.deleteMany({ where: { roomId: { in: createdRoomIds } } });
      await prisma.creditLedger.deleteMany({ where: { sourceId: { in: createdRoomIds } } });
      await prisma.userFlex.deleteMany({ where: { roomId: { in: createdRoomIds } } });
      await prisma.userDrop.deleteMany({ where: { roomId: { in: createdRoomIds } } });
      await prisma.predictionRoom.deleteMany({ where: { roomId: { in: createdRoomIds } } });
    }

    if (createdUserIds.length) {
      await prisma.userNotification.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.roomMembership.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: { in: createdUserIds } },
            { followingId: { in: createdUserIds } },
          ],
        },
      });
      await prisma.userBlock.deleteMany({
        where: {
          OR: [
            { blockerId: { in: createdUserIds } },
            { blockedId: { in: createdUserIds } },
          ],
        },
      });
      await prisma.resultReaction.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userBadge.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.roomCommentary.deleteMany({ where: { generatedByUserId: { in: createdUserIds } } });
      await prisma.roomDispute.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.report.deleteMany({
        where: {
          OR: [
            { reporterId: { in: createdUserIds } },
            { targetUserId: { in: createdUserIds } },
          ],
        },
      });
      await prisma.userSession.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.creditLedger.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.auraTransaction.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.cloutTransaction.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.roomResult.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.milestonePrediction.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userFlex.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userDrop.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.consentRecord.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.privacyRequest.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.activityEvent.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.dailySpinClaim.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.creatorProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { userId: { in: createdUserIds } } });
    }

    if (createdAdminUserId) {
      await prisma.adminUser.deleteMany({ where: { adminUserId: createdAdminUserId } });
    }
    if (createdAdminRoleId) {
      await prisma.adminRole.deleteMany({ where: { roleId: createdAdminRoleId } });
    }

    await app.close();
    await prisma.$disconnect();
  });

  it('returns access and refresh tokens, rotates refresh tokens, and revokes on logout', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `${runId}-participant1@predikt.test`,
        password: 'Password123!',
      })
      .expect(201);

    expect(loginResponse.body.accessToken).toEqual(expect.any(String));
    expect(loginResponse.body.refreshToken).toEqual(expect.any(String));
    expect(loginResponse.body.accessTokenExpiresAt).toBeTruthy();
    expect(loginResponse.body.refreshTokenExpiresAt).toBeTruthy();

    const oldRefreshToken = loginResponse.body.refreshToken;

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(201);

    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
    expect(refreshResponse.body.refreshToken).toEqual(expect.any(String));
    expect(refreshResponse.body.refreshToken).not.toBe(oldRefreshToken);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken: refreshResponse.body.refreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: refreshResponse.body.refreshToken })
      .expect(401);
  });

  it('hides prediction values before lock and reveals them after lock', async () => {
    const roomId = await createCustomRoom(creatorAuth.accessToken, {
      roomTitle: `Hidden Predictions ${runId}`,
    });

    const room = await prisma.predictionRoom.findUniqueOrThrow({
      where: { roomId },
      include: { milestones: { orderBy: { milestoneOrder: 'asc' } } },
    });
    const finalMilestone = room.milestones.find(
      (milestone) => milestone.milestoneType === 'final_destination',
    );

    expect(finalMilestone).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/rooms/${roomId}/milestone-predictions`)
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .send({
        predictions: [
          {
            milestoneId: finalMilestone!.milestoneId,
            predictedReachedTime: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
          },
        ],
      })
      .expect(201);

    const hiddenList = await request(app.getHttpServer())
      .get(`/rooms/${roomId}/milestone-predictions`)
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .expect(200);

    expect(hiddenList.body[0].predictedReachedTime).toBeUndefined();
    expect(hiddenList.body[0].status).toBe('submitted');

    await request(app.getHttpServer())
      .post(`/rooms/${roomId}/lock-predictions`)
      .set('Authorization', `Bearer ${creatorAuth.accessToken}`)
      .expect(201);

    const visibleList = await request(app.getHttpServer())
      .get(`/rooms/${roomId}/milestone-predictions`)
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .expect(200);

    expect(visibleList.body[0].predictedReachedTime).toEqual(expect.any(String));
    expect(visibleList.body[0].status).toBe('visible');
  });

  it('keeps public, leaderboard, dashboard, and participant projections free of email/passwordHash while self-profile keeps email', async () => {
    const roomId = await createCustomRoom(creatorAuth.accessToken, {
      roomTitle: `Projection Safety ${runId}`,
      startingLat: 12.9716,
      startingLng: 77.5946,
      destinationLat: 13.1986,
      destinationLng: 77.7066,
    });

    await request(app.getHttpServer())
      .post(`/rooms/${roomId}/predictions`)
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .send({
        predictedArrivalTime: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/rooms/${roomId}/lock-predictions`)
      .set('Authorization', `Bearer ${creatorAuth.accessToken}`)
      .expect(201);

    const publicRoom = await request(app.getHttpServer())
      .get(`/rooms/code/${(await prisma.predictionRoom.findUniqueOrThrow({ where: { roomId } })).inviteCode}`)
      .expect(200);

    expect(JSON.stringify(publicRoom.body)).not.toContain('passwordHash');
    expect(JSON.stringify(publicRoom.body)).not.toContain('"email"');

    const participantRoom = await request(app.getHttpServer())
      .get(`/rooms/${roomId}`)
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .expect(200);

    expect(participantRoom.body.startingLat).toBeUndefined();
    expect(participantRoom.body.destinationLat).toBeUndefined();
    expect(participantRoom.body.route?.startLat).toBeUndefined();
    expect(participantRoom.body.route?.destinationLat).toBeUndefined();
    expect(participantRoom.body.route?.previewGeometry).toBeUndefined();
    expect(JSON.stringify(participantRoom.body)).not.toContain('"email"');
    expect(JSON.stringify(participantRoom.body)).not.toContain('passwordHash');

    const creatorRoom = await request(app.getHttpServer())
      .get(`/rooms/${roomId}`)
      .set('Authorization', `Bearer ${creatorAuth.accessToken}`)
      .expect(200);

    expect(creatorRoom.body.startingLat).toBeCloseTo(12.9716);
    expect(creatorRoom.body.destinationLat).toBeCloseTo(13.1986);

    await completeRoom(roomId, creatorAuth.accessToken);

    const weeklyLeaderboard = await request(app.getHttpServer())
      .get('/leaderboard/weekly')
      .expect(200);

    expect(JSON.stringify(weeklyLeaderboard.body)).not.toContain('"email"');
    expect(JSON.stringify(weeklyLeaderboard.body)).not.toContain('passwordHash');

    const selfProfile = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .expect(200);

    const activeHub = await request(app.getHttpServer())
      .get('/dashboard/active-predictions')
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .expect(200);
    expect(JSON.stringify(activeHub.body)).not.toContain('previewGeometry');

    expect(selfProfile.body.email).toBe(`${runId}-participant1@predikt.test`);
  });

  it('rejects unauthenticated access to the active prediction hub', async () => {
    await request(app.getHttpServer()).get('/dashboard/active-predictions').expect(401);
  });

  it('keeps creator setup route geometry behind authenticated preview', async () => {
    await request(app.getHttpServer())
      .post('/routes/preview')
      .send({
        startLocation: { latitude: 12.9784, longitude: 77.6408, label: 'Indiranagar' },
        destinationPlaceId: 'search-location:12.97560,77.60670:mg-road',
        travelMode: 'car',
      })
      .expect(401);
  });

  it('supports room membership before prediction and notification read state without sensitive payloads', async () => {
    const roomId = await createCustomRoom(creatorAuth.accessToken, {
      roomTitle: `Membership Flow ${runId}`,
    });

    const creatorMembership = await prisma.roomMembership.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: creatorAuth.user.userId,
        },
      },
    });
    expect(creatorMembership?.role).toBe('creator');
    expect(creatorMembership?.status).toBe('joined');

    const joinResponse = await request(app.getHttpServer())
      .post(`/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .expect(201);

    expect(joinResponse.body).toMatchObject({
      roomId,
      role: 'participant',
      status: 'joined',
      nextAction: 'prediction',
    });

    const secondJoinResponse = await request(app.getHttpServer())
      .post(`/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .expect(201);
    expect(secondJoinResponse.body.membershipId).toBe(joinResponse.body.membershipId);

    const activeHub = await request(app.getHttpServer())
      .get('/dashboard/active-predictions')
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .expect(200);
    const joinedCard = activeHub.body.find((card: { roomId: string }) => card.roomId === roomId);
    expect(joinedCard).toMatchObject({
      hasSubmittedPrediction: false,
      userRole: 'participant',
    });

    const notifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .expect(200);
    expect(JSON.stringify(notifications.body)).not.toContain('passwordHash');
    expect(JSON.stringify(notifications.body)).not.toContain('"email"');
    expect(JSON.stringify(notifications.body)).not.toContain('rawLat');
    expect(notifications.body.some((item: { type: string }) => item.type === 'room_joined')).toBe(true);

    const unread = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .expect(200);
    expect(unread.body.count).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .patch(`/notifications/${notifications.body[0].notificationId}/read`)
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .expect(200);

    const unreadAfter = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .expect(200);
    expect(unreadAfter.body.count).toBe(0);

    await request(app.getHttpServer())
      .post(`/rooms/${roomId}/leave`)
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .expect(201);

    const hubAfterLeave = await request(app.getHttpServer())
      .get('/dashboard/active-predictions')
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .expect(200);
    expect(hubAfterLeave.body.some((card: { roomId: string }) => card.roomId === roomId)).toBe(false);

    await prisma.roomMembership.upsert({
      where: {
        roomId_userId: {
          roomId,
          userId: secondParticipantAuth.user.userId,
        },
      },
      create: {
        roomId,
        userId: secondParticipantAuth.user.userId,
        role: 'participant',
        status: 'blocked',
        joinedAt: new Date(),
      },
      update: { status: 'blocked' },
    });

    await request(app.getHttpServer())
      .post(`/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${secondParticipantAuth.accessToken}`)
      .expect(403);
  });

  it('keeps private room details behind membership while invite preview stays safe', async () => {
    const roomId = await createCustomRoom(creatorAuth.accessToken, {
      roomTitle: `Private Membership ${runId}`,
      visibility: 'private',
      startingLat: 12.9,
      startingLng: 77.6,
      destinationLat: 13.1,
      destinationLng: 77.7,
    });
    const room = await prisma.predictionRoom.findUniqueOrThrow({ where: { roomId } });

    await request(app.getHttpServer())
      .get(`/rooms/${roomId}`)
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .expect(403);

    const preview = await request(app.getHttpServer())
      .get(`/rooms/invite/${room.inviteCode}`)
      .expect(200);
    expect(JSON.stringify(preview.body)).not.toContain('passwordHash');
    expect(JSON.stringify(preview.body)).not.toContain('"email"');
    expect(JSON.stringify(preview.body)).not.toContain('12.9');
  });

  it('protects manual lifecycle evaluation behind admin auth', async () => {
    await request(app.getHttpServer())
      .post('/admin/journeys/evaluate-lifecycle')
      .send({ roomId: 'missing-room' })
      .expect(401);
  });

  it('requires admin auth, supports valid admin access, and strips passwordHash from admin responses', async () => {
    await request(app.getHttpServer()).get('/admin/users').expect(401);

    await request(app.getHttpServer())
      .get('/admin/users')
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .expect(401);

    const adminUsers = await request(app.getHttpServer())
      .get('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(adminUsers.body)).toBe(true);
    expect(JSON.stringify(adminUsers.body)).not.toContain('passwordHash');

    await request(app.getHttpServer())
      .post('/admin/credits/reverse')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: participantAuth.user.userId, amount: 0 })
      .expect(400);
  });

  it('ledgers signup, first room, first prediction, and result-declared credits without duplication and requires admin for reversal', async () => {
    const creatorSignupCredits = await prisma.creditLedger.count({
      where: { userId: creatorAuth.user.userId, eventType: 'signup' },
    });
    const participantSignupCredits = await prisma.creditLedger.count({
      where: { userId: participantAuth.user.userId, eventType: 'signup' },
    });

    expect(creatorSignupCredits).toBe(1);
    expect(participantSignupCredits).toBe(1);

    const firstRoomId = await createCustomRoom(creatorAuth.accessToken, {
      roomTitle: `First Room Credit ${runId}`,
    });
    const secondRoomId = await createCustomRoom(creatorAuth.accessToken, {
      roomTitle: `Second Room Credit ${runId}`,
    });

    const firstRoomLedgerCount = await prisma.creditLedger.count({
      where: { userId: creatorAuth.user.userId, eventType: 'first_room' },
    });
    expect(firstRoomLedgerCount).toBe(1);

    await request(app.getHttpServer())
      .post(`/rooms/${firstRoomId}/predictions`)
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .send({
        predictedArrivalTime: new Date(Date.now() + 22 * 60 * 1000).toISOString(),
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/rooms/${secondRoomId}/predictions`)
      .set('Authorization', `Bearer ${participantAuth.accessToken}`)
      .send({
        predictedArrivalTime: new Date(Date.now() + 24 * 60 * 1000).toISOString(),
      })
      .expect(201);

    const firstPredictionLedgerCount = await prisma.creditLedger.count({
      where: { userId: participantAuth.user.userId, eventType: 'first_prediction' },
    });
    expect(firstPredictionLedgerCount).toBe(1);

    await request(app.getHttpServer())
      .post(`/rooms/${firstRoomId}/lock-predictions`)
      .set('Authorization', `Bearer ${creatorAuth.accessToken}`)
      .expect(201);

    await completeRoom(firstRoomId, creatorAuth.accessToken);

    const resultDeclaredLedgerCount = await prisma.creditLedger.count({
      where: { userId: creatorAuth.user.userId, eventType: 'result_declared', sourceId: firstRoomId },
    });
    expect(resultDeclaredLedgerCount).toBe(1);

    await request(app.getHttpServer())
      .post(`/rooms/${firstRoomId}/end`)
      .set('Authorization', `Bearer ${creatorAuth.accessToken}`)
      .send({})
      .expect(400);

    const resultDeclaredLedgerCountAfterRetry = await prisma.creditLedger.count({
      where: { userId: creatorAuth.user.userId, eventType: 'result_declared', sourceId: firstRoomId },
    });
    expect(resultDeclaredLedgerCountAfterRetry).toBe(1);

    await request(app.getHttpServer())
      .post('/admin/credits/reverse')
      .send({ userId: participantAuth.user.userId, amount: 5 })
      .expect(401);

    const reverseResponse = await request(app.getHttpServer())
      .post('/admin/credits/reverse')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: participantAuth.user.userId, amount: 5, reason: 'integration-test' })
      .expect(201);

    expect(reverseResponse.body.delta).toBe(-5);
  });

  async function registerUser(name: string, email: string, handle: string): Promise<AuthPayload> {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name,
        email,
        password: 'Password123!',
        prediktHandle: handle,
      })
      .expect(201);

    return response.body;
  }

  async function createCustomRoom(
    accessToken: string,
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    const response = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        roomTitle: `Room ${Date.now()}`,
        eventType: 'journey',
        startingPointLabel: 'Koramangala',
        destinationLabel: 'Airport',
        predictionCloseTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        visibility: 'invite_only',
        roomCategory: 'travel',
        ...overrides,
      })
      .expect(201);

    createdRoomIds.push(response.body.roomId);
    return response.body.roomId as string;
  }

  async function completeRoom(roomId: string, accessToken: string) {
    const room = await prisma.predictionRoom.findUniqueOrThrow({
      where: { roomId },
      include: { milestones: { orderBy: { milestoneOrder: 'asc' } } },
    });

    await request(app.getHttpServer())
      .post(`/rooms/${roomId}/start`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    for (const milestone of room.milestones) {
      await request(app.getHttpServer())
        .post(`/rooms/${roomId}/milestones/${milestone.milestoneId}/reached`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ actualReachedTime: new Date().toISOString() })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post(`/rooms/${roomId}/end`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        actualEndTime: new Date().toISOString(),
        confidenceLevel: 'medium',
      })
      .expect(201);
  }

  async function seedAdmin() {
    const role = await prisma.adminRole.create({
      data: {
        roleName: `${runId}-super-admin`,
        description: 'Integration test admin role',
        permissions: { all: true },
      },
    });
    createdAdminRoleId = role.roleId;

    const passwordHash = await bcrypt.hash('Admin12345!', 10);
    const admin = await prisma.adminUser.create({
      data: {
        name: 'Integration Admin',
        email: `${runId}-admin@predikt.test`,
        passwordHash,
        roleId: role.roleId,
      },
      include: { role: true },
    });
    createdAdminUserId = admin.adminUserId;
  }

  async function loginAdmin() {
    const response = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({
        email: `${runId}-admin@predikt.test`,
        password: 'Admin12345!',
      })
      .expect(201);

    return response.body.accessToken as string;
  }
});
