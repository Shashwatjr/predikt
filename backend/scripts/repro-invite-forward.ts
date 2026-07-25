/* eslint-disable no-console */
/** Local verification: forward-share tracking records InviteForward + notifies creator. */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RoomsService } from '../src/rooms/rooms.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const rooms = app.get(RoomsService);
  const s = Date.now();

  const creator = await prisma.user.create({ data: { name: 'Creator', prediktHandle: `fc_${s}`, status: 'active' } });
  const forwarder = await prisma.user.create({ data: { name: 'Rohan', prediktHandle: `rohan_${s}`, status: 'active' } });
  const guest1 = await prisma.user.create({ data: { name: 'Guest1', prediktHandle: `g1_${s}`, isGuest: true, guestKey: `g1k_${s}`, status: 'active' } });
  const guest2 = await prisma.user.create({ data: { name: 'Guest2', prediktHandle: `g2_${s}`, isGuest: true, guestKey: `g2k_${s}`, status: 'active' } });

  const room = await rooms.create(
    {
      roomTitle: 'Forward Test Room', eventType: 'arrival_time', category: 'arrival_time', templateKey: 'arrival_time',
      question: 'When?', mode: 'friends', roomCategory: 'journey', answerType: 'exact_time',
      startingPointLabel: 'A', destinationLabel: 'B', startingLat: 12.97, startingLng: 77.64, destinationLat: 12.93, destinationLng: 77.62,
      predictionCloseTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(), visibility: 'invite_only',
    } as never,
    { userId: creator.userId, name: creator.name, isGuest: false } as never,
  );

  // Forwarder joins directly (no forwardedBy). Then two guests join via forwarder's link.
  await rooms.join(room.roomId, forwarder as never);
  await rooms.join(room.roomId, guest1 as never, forwarder.userId);
  await rooms.join(room.roomId, guest2 as never, forwarder.userId);

  const forwards = await prisma.inviteForward.findMany({ where: { roomId: room.roomId } });
  console.log('INVITE FORWARDS:', forwards.length);
  forwards.forEach((f) => console.log('  forwarder', f.forwarderUserId.slice(0, 8), '-> guest', f.joinedGuestUserId.slice(0, 8)));

  const notifs = await prisma.userNotification.findMany({
    where: { roomId: room.roomId, type: 'invite_forwarded' }, orderBy: { createdAt: 'asc' },
  });
  console.log('CREATOR FORWARD NOTIFICATIONS:', notifs.length);
  notifs.forEach((n) => console.log('  ->', n.userId.slice(0, 8), '|', n.body));

  await app.close();
}
main().catch((e) => { console.error('HARNESS ERROR:', e); process.exit(1); });
