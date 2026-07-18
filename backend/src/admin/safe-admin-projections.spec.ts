import {
  safeAdminAuditItem,
  safeAdminRoomDetail,
  safeAdminUserDetail,
  safeAdminUserListItem,
} from './utils/safe-admin-projections';

describe('safe admin projections', () => {
  it('strips sensitive user fields from list projection', () => {
    const item = safeAdminUserListItem({
      userId: 'user-12345678',
      name: 'Test',
      prediktHandle: 'tester',
      isGuest: false,
      passwordHash: 'secret',
      guestKey: 'guest-key',
      email: 'test@example.com',
      phone: '+10000000000',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      roomsCreatedCount: 2,
      predictionsMadeCount: 3,
      totalAura: 10,
    });

    expect(item).not.toHaveProperty('passwordHash');
    expect(item).not.toHaveProperty('guestKey');
    expect(item).not.toHaveProperty('email');
    expect(item.shortId).toBe('user-123');
  });

  it('does not expose coordinates in room detail projection', () => {
    const detail = safeAdminRoomDetail(
      {
        roomId: 'room-1',
        roomTitle: 'Test room',
        inviteCode: 'ABC123',
        category: 'arrival_time',
        status: 'completed',
        journeyStatus: 'arrived',
        startingLat: 12.34,
        startingLng: 56.78,
        destinationLat: 90.12,
        destinationLng: 34.56,
        startingPointLabel: 'Start',
        destinationLabel: 'End',
        createdAt: new Date(),
      },
      {
        participantCount: 2,
        predictionCount: 2,
        reports: [],
        auditEvents: [],
        rematchChain: [],
      },
    );

    expect(detail).not.toHaveProperty('startingLat');
    expect(detail).not.toHaveProperty('startingLng');
    expect(detail).not.toHaveProperty('destinationLat');
    expect(detail).not.toHaveProperty('destinationLng');
    expect(detail.inviteCode).toBe('ABC123');
  });

  it('reveals email only in authorized detail projection', () => {
    const detail = safeAdminUserDetail({
      userId: 'user-1',
      name: 'Detail User',
      prediktHandle: 'detail',
      email: 'detail@example.com',
      isGuest: true,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      totalAura: 0,
      passwordHash: 'secret',
      guestKey: 'guest',
    });

    expect(detail?.email).toBe('detail@example.com');
    expect(detail).not.toHaveProperty('passwordHash');
    expect(detail).not.toHaveProperty('guestKey');
  });

  it('sanitizes nested audit metadata', () => {
    const item = safeAdminAuditItem({
      auditLogId: 'audit-1',
      action: 'user.updated',
      actorType: 'admin',
      targetType: 'user',
      createdAt: new Date(),
      correlationId: 'corr-1',
      metadata: {
        nested: {
          guestKey: 'guest-secret',
          refreshToken: 'refresh-secret',
          rawLat: 12.34,
          keep: 'ok',
        },
      },
    });

    expect(JSON.stringify(item)).not.toContain('guest-secret');
    expect(JSON.stringify(item)).not.toContain('refresh-secret');
    expect(JSON.stringify(item)).not.toContain('rawLat');
    expect(item.metadata).toMatchObject({ nested: { keep: 'ok' } });
  });
});
