import { ForbiddenException } from '@nestjs/common';
import { RoomsService } from './rooms.service';

describe('unauthenticated invite privacy', () => {
  const leak = 'PRIVATE_LOCATION_MARKER';
  function setup(visibility = 'invite_only', locationDisplayMode = 'approximate') {
    const room = {
      roomId: 'room', inviteCode: 'AB123', roomTitle: 'Commute',
      category: 'arrival_time', answerType: 'exact_time', status: 'predictions_open',
      visibility, locationDisplayMode, expectedDurationSeconds: 780,
      predictionCloseTime: new Date('2099-01-01'),
      creator: { name: 'Host', prediktHandle: 'host', email: leak },
      startingPointLabel: leak, destinationLabel: leak,
      baselineSnapshot: { geometry: leak, coordinates: [12, 77] },
      scoringRule: { creationMeta: { baselineSnapshot: { encodedPolyline: leak } } },
      journeyRoute: { startLabel: leak, destinationLabel: leak,
        startLat: 12, destinationLng: 77, encodedPolyline: leak,
        routeSummary: leak, travelMode: 'car', estimatedDurationSeconds: 780 },
      milestones: [{ milestoneId: 'm', locationLabel: leak, milestoneLat: 12 }],
      milestonePredictions: [], roomMemberships: [], locationEvents: [],
    };
    const prisma = { predictionRoom: { findUnique: jest.fn().mockResolvedValue(room) } };
    const audit = { log: jest.fn() };
    const service = new RoomsService(prisma as any, audit as any, {} as any, {} as any);
    return { service, room, audit };
  }

  it.each(['getInvitePreview', 'findByInviteCode'] as const)(
    '%s never returns route geometry, precise labels or raw provider bags', async (method) => {
      const { service } = setup();
      const result = await service[method]('ab123');
      expect(JSON.stringify(result)).not.toContain(leak);
      expect(JSON.stringify(result)).not.toMatch(/encodedPolyline|coordinates|baselineSnapshot|creationMeta/);
      expect(result.roomId).toBe('room');
    });

  it.each(['getInvitePreview', 'findByInviteCode'] as const)(
    '%s rejects private room previews', async (method) => {
      const { service, audit } = setup('private');
      await expect(service[method]('AB123')).rejects.toBeInstanceOf(ForbiddenException);
      expect(audit.log).not.toHaveBeenCalled();
    });

  it('keeps ghost host identity hidden and retains journey duration', async () => {
    const { service } = setup('public', 'ghost');
    const result = await service.getInvitePreview('AB123');
    expect(result.creatorDisplayName).toBeNull();
    expect(result.creatorHandle).toBeNull();
    expect(result.safePreview.expectedDurationSeconds).toBe(780);
  });
});
