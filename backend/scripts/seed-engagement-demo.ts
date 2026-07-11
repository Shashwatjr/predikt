import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function addMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60_000);
}

function nowIso() {
  return new Date().toISOString();
}

async function upsertUser(email: string, name: string, handle: string) {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  return prisma.user.upsert({
    where: { email },
    update: { name, prediktHandle: handle, passwordHash },
    create: { email, name, prediktHandle: handle, passwordHash },
  });
}

async function createRoomWithRoute(input: {
  inviteCode: string;
  title: string;
  status: 'predictions_open' | 'predictions_locked' | 'live' | 'completed';
  creatorUserId: string;
  journeyStatus?: string;
  closureReasonCode?: string;
  roomType?: string;
  answerType?: string;
  startLabel: string;
  destinationLabel: string;
  travelMode: string;
  etaMinutes: number;
  liveProgress?: number;
  predictionOffsetMinutes?: number;
}) {
  const now = new Date();
  const predictionCloseTime = addMinutes(now, input.status === 'predictions_open' ? 35 : -20);
  const expectedDurationSeconds = input.etaMinutes * 60;
  const gracePeriodSeconds = Math.max(10 * 60, Math.min(45 * 60, Math.round(expectedDurationSeconds * 0.25)));
  const scheduledStartAt = addMinutes(now, -15);
  const autoCloseAt = addMinutes(scheduledStartAt, Math.round((expectedDurationSeconds + gracePeriodSeconds) / 60));
  const room = await prisma.predictionRoom.upsert({
    where: { inviteCode: input.inviteCode },
    update: {
      roomTitle: input.title,
      eventType: input.title,
      roomType: input.roomType ?? 'single_target',
      answerType: input.answerType ?? 'exact_time',
      status: input.status,
      creatorUserId: input.creatorUserId,
      startingPointLabel: input.startLabel,
      destinationLabel: input.destinationLabel,
      plannedStartTime: scheduledStartAt,
      startTime: addMinutes(now, -10),
      predictionCloseTime,
      lockTime: predictionCloseTime,
      resultDeadline: addMinutes(now, 50),
      journeyStatus: input.journeyStatus ?? (input.status === 'completed' ? 'completed' : input.status === 'live' ? 'live' : 'scheduled'),
      journeyScheduledStartAt: scheduledStartAt,
      journeyStartedAt: input.status === 'live' || input.status === 'completed' ? addMinutes(now, -10) : null,
      lastTravellerUpdateAt: input.status === 'live' ? addMinutes(now, -5) : null,
      expectedDurationSeconds,
      gracePeriodSeconds,
      autoCloseAt,
      noStartCutoffAt: addMinutes(scheduledStartAt, 20),
      arrivalConfirmedAt: input.status === 'completed' && input.journeyStatus !== 'auto_closed' && input.journeyStatus !== 'abandoned' ? addMinutes(now, -5) : null,
      cancelledAt: input.journeyStatus?.includes('cancelled') || input.journeyStatus === 'plan_changed' ? addMinutes(now, -3) : null,
      autoClosedAt: input.journeyStatus === 'auto_closed' ? addMinutes(now, -2) : null,
      abandonedAt: input.journeyStatus === 'abandoned' ? addMinutes(now, -2) : null,
      closureReasonCode: input.closureReasonCode ?? null,
      selectedBackground: 'midnight-grid',
      selectedRoomTheme: 'electric-route',
      predictionVisibilityMode: 'hidden_until_lock',
      roomCategory: 'journey',
      category: 'arrival_time',
      mode: 'friends',
      templateKey: 'arrival_time',
    },
    create: {
      inviteCode: input.inviteCode,
      roomTitle: input.title,
      eventType: input.title,
      roomType: input.roomType ?? 'single_target',
      answerType: input.answerType ?? 'exact_time',
      status: input.status,
      creatorUserId: input.creatorUserId,
      startingPointLabel: input.startLabel,
      destinationLabel: input.destinationLabel,
      plannedStartTime: scheduledStartAt,
      startTime: addMinutes(now, -10),
      predictionCloseTime,
      lockTime: predictionCloseTime,
      resultDeadline: addMinutes(now, 50),
      journeyStatus: input.journeyStatus ?? (input.status === 'completed' ? 'completed' : input.status === 'live' ? 'live' : 'scheduled'),
      journeyScheduledStartAt: scheduledStartAt,
      journeyStartedAt: input.status === 'live' || input.status === 'completed' ? addMinutes(now, -10) : null,
      lastTravellerUpdateAt: input.status === 'live' ? addMinutes(now, -5) : null,
      expectedDurationSeconds,
      gracePeriodSeconds,
      autoCloseAt,
      noStartCutoffAt: addMinutes(scheduledStartAt, 20),
      arrivalConfirmedAt: input.status === 'completed' && input.journeyStatus !== 'auto_closed' && input.journeyStatus !== 'abandoned' ? addMinutes(now, -5) : null,
      cancelledAt: input.journeyStatus?.includes('cancelled') || input.journeyStatus === 'plan_changed' ? addMinutes(now, -3) : null,
      autoClosedAt: input.journeyStatus === 'auto_closed' ? addMinutes(now, -2) : null,
      abandonedAt: input.journeyStatus === 'abandoned' ? addMinutes(now, -2) : null,
      closureReasonCode: input.closureReasonCode ?? null,
      selectedBackground: 'midnight-grid',
      selectedRoomTheme: 'electric-route',
      predictionVisibilityMode: 'hidden_until_lock',
      roomCategory: 'journey',
      category: 'arrival_time',
      mode: 'friends',
      templateKey: 'arrival_time',
    },
  });

  await prisma.journeyRoute.upsert({
    where: { roomId: room.roomId },
    update: {
      startPlaceId: `start-${input.inviteCode}`,
      destinationPlaceId: `destination-${input.inviteCode}`,
      startLabel: input.startLabel,
      destinationLabel: input.destinationLabel,
      travelMode: input.travelMode,
      estimatedDurationSeconds: input.etaMinutes * 60,
      routeSummary: `${input.travelMode} route summary`,
    },
    create: {
      roomId: room.roomId,
      startPlaceId: `start-${input.inviteCode}`,
      destinationPlaceId: `destination-${input.inviteCode}`,
      startLabel: input.startLabel,
      destinationLabel: input.destinationLabel,
      travelMode: input.travelMode,
      estimatedDurationSeconds: input.etaMinutes * 60,
      routeSummary: `${input.travelMode} route summary`,
    },
  });

  const milestone = await prisma.roomMilestone.upsert({
    where: { roomId_milestoneOrder: { roomId: room.roomId, milestoneOrder: 1 } },
    update: {
      milestoneName: input.destinationLabel,
      milestoneType: 'final_destination',
      status:
        input.status === 'predictions_open'
          ? 'prediction_open'
          : input.status === 'predictions_locked'
            ? 'prediction_locked'
            : input.status === 'completed'
              ? 'reached'
              : 'pending',
      predictionCloseTime,
      actualReachedTime: input.status === 'completed' ? addMinutes(now, -5) : null,
    },
    create: {
      roomId: room.roomId,
      milestoneOrder: 1,
      milestoneName: input.destinationLabel,
      milestoneType: 'final_destination',
      status:
        input.status === 'predictions_open'
          ? 'prediction_open'
          : input.status === 'predictions_locked'
            ? 'prediction_locked'
            : input.status === 'completed'
              ? 'reached'
              : 'pending',
      predictionCloseTime,
      actualReachedTime: input.status === 'completed' ? addMinutes(now, -5) : null,
    },
  });

  if (typeof input.liveProgress === 'number') {
    await prisma.liveLocationEvent.create({
      data: {
        roomId: room.roomId,
        creatorUserId: input.creatorUserId,
        progressPercentage: input.liveProgress,
        etaMinutes: Math.max(0, input.etaMinutes - 10),
        locationDisplayMode: 'approximate',
        currentMilestoneId: milestone.milestoneId,
      },
    });
  }

  return { room, milestone };
}

async function createGenericCategoryRoom(input: {
  inviteCode: string;
  creatorUserId: string;
  category: 'weather_rain' | 'food_eta' | 'whos_late' | 'gym_habit';
  mode: 'friends' | 'beat_bot' | 'challenge_self';
  title: string;
  question: string;
  answerType: 'multiple_choice' | 'yes_no' | 'duration';
  options?: string[];
  baselineLabel: string;
  baselineValue?: string | number | null;
  baselineSnapshot?: Record<string, unknown>;
  oracleBotPrediction?: Record<string, unknown>;
  startingPointLabel: string;
  destinationLabel: string;
  selectedOptionKeys?: string[];
}) {
  const now = new Date();
  const predictionCloseTime = addMinutes(now, 45);
  const roomCategory =
    input.category === 'food_eta'
      ? 'delivery'
      : input.category === 'gym_habit'
        ? 'fitness'
        : 'custom';
  const room = await prisma.predictionRoom.upsert({
    where: { inviteCode: input.inviteCode },
    update: {
      roomTitle: input.title,
      eventType: input.category,
      category: input.category,
      mode: input.mode,
      templateKey: input.category,
      baselineSource: 'manual',
      baselineLabel: input.baselineLabel,
      baselineValue: input.baselineValue === undefined ? undefined : input.baselineValue as any,
      baselineSnapshot: input.baselineSnapshot as any,
      oracleBotPrediction: input.oracleBotPrediction as any,
      options: input.options as any,
      roomType: 'social_prediction',
      answerType: input.answerType,
      predictionMode: input.mode,
      predictionVisibilityMode: 'hidden_until_lock',
      roomCategory,
      startingPointLabel: input.startingPointLabel,
      destinationLabel: input.destinationLabel,
      status: 'predictions_open',
      visibility: 'invite_only',
      predictionCloseTime,
      scoringRule: {
        creationMeta: {
          category: input.category,
          mode: input.mode,
          templateKey: input.category,
          question: input.question,
          options: input.options ?? null,
          baselineLabel: input.baselineLabel,
          baselineValue: input.baselineValue ?? null,
          baselineSnapshot: input.baselineSnapshot ?? null,
          oracleBotPrediction: input.oracleBotPrediction ?? null,
        },
        weatherOptions:
          input.category === 'weather_rain'
            ? [
                { key: 'no_rain', label: 'No Rain', helper: 'No rain during the window.' },
                { key: 'rain_before_6', label: 'Yes, before 6 PM', helper: 'Rain arrives before 6 PM.' },
                { key: 'rain_after_6', label: 'Yes, after 6 PM', helper: 'Rain arrives after 6 PM.' },
              ]
            : undefined,
      } as any,
      outcomeSource: input.category === 'weather_rain' ? 'host_declared' : null,
      confidenceLevel: input.category === 'weather_rain' ? 'medium' : null,
      resultShareText:
        input.category === 'weather_rain'
          ? 'I beat the forecast on PREDIKT. Rain Oracle unlocked.'
          : input.category === 'food_eta'
            ? 'I called the delivery ETA closest on PREDIKT.'
            : undefined,
    },
    create: {
      inviteCode: input.inviteCode,
      creatorUserId: input.creatorUserId,
      roomTitle: input.title,
      eventType: input.category,
      category: input.category,
      mode: input.mode,
      templateKey: input.category,
      baselineSource: 'manual',
      baselineLabel: input.baselineLabel,
      baselineValue: input.baselineValue === undefined ? undefined : input.baselineValue as any,
      baselineSnapshot: input.baselineSnapshot as any,
      oracleBotPrediction: input.oracleBotPrediction as any,
      options: input.options as any,
      roomType: 'social_prediction',
      answerType: input.answerType,
      predictionMode: input.mode,
      predictionVisibilityMode: 'hidden_until_lock',
      roomCategory,
      startingPointLabel: input.startingPointLabel,
      destinationLabel: input.destinationLabel,
      status: 'predictions_open',
      visibility: 'invite_only',
      predictionCloseTime,
      scoringRule: {
        creationMeta: {
          category: input.category,
          mode: input.mode,
          templateKey: input.category,
          question: input.question,
          options: input.options ?? null,
          baselineLabel: input.baselineLabel,
          baselineValue: input.baselineValue ?? null,
          baselineSnapshot: input.baselineSnapshot ?? null,
          oracleBotPrediction: input.oracleBotPrediction ?? null,
        },
        weatherOptions:
          input.category === 'weather_rain'
            ? [
                { key: 'no_rain', label: 'No Rain', helper: 'No rain during the window.' },
                { key: 'rain_before_6', label: 'Yes, before 6 PM', helper: 'Rain arrives before 6 PM.' },
                { key: 'rain_after_6', label: 'Yes, after 6 PM', helper: 'Rain arrives after 6 PM.' },
              ]
            : undefined,
      } as any,
      outcomeSource: input.category === 'weather_rain' ? 'host_declared' : undefined,
      confidenceLevel: input.category === 'weather_rain' ? 'medium' : undefined,
      resultShareText:
        input.category === 'weather_rain'
          ? 'I beat the forecast on PREDIKT. Rain Oracle unlocked.'
          : input.category === 'food_eta'
            ? 'I called the delivery ETA closest on PREDIKT.'
            : undefined,
    },
  });

  const milestone = await prisma.roomMilestone.upsert({
    where: { roomId_milestoneOrder: { roomId: room.roomId, milestoneOrder: 1 } },
    update: {
      milestoneName: input.question,
      milestoneType: 'final_destination',
      status: 'prediction_open',
      predictionCloseTime,
    },
    create: {
      roomId: room.roomId,
      milestoneOrder: 1,
      milestoneName: input.question,
      milestoneType: 'final_destination',
      status: 'prediction_open',
      predictionCloseTime,
    },
  });

  return { room, milestone, selectedOptionKeys: input.selectedOptionKeys ?? [] };
}

async function upsertMembership(roomId: string, userId: string, role: 'creator' | 'participant') {
  await prisma.roomMembership.upsert({
    where: { roomId_userId: { roomId, userId } },
    update: { role, status: 'joined', leftAt: null },
    create: {
      roomId,
      userId,
      role,
      status: 'joined',
      joinedAt: new Date(),
    },
  });
}

async function main() {
  const owner = await upsertUser('test@predikt.ai', 'Predikt Demo', 'predikt.demo');
  const friends = await Promise.all([
    upsertUser('shashwat@predikt.ai', 'Shashwat', 'shashwat'),
    upsertUser('rahul@predikt.ai', 'Rahul', 'rahul'),
    upsertUser('priya@predikt.ai', 'Priya', 'priya'),
    upsertUser('ankur@predikt.ai', 'Ankur', 'ankur'),
  ]);

  const scenarios = await Promise.all([
    createRoomWithRoute({
      inviteCode: 'HUBA1',
      title: 'Normal Completed Journey',
      status: 'completed',
      journeyStatus: 'completed',
      creatorUserId: owner.userId,
      startLabel: 'Indiranagar',
      destinationLabel: 'Koramangala Office',
      travelMode: 'driving',
      etaMinutes: 38,
    }),
    createRoomWithRoute({
      inviteCode: 'HUBB2',
      title: 'Auto-Closing Soon Journey',
      status: 'live',
      journeyStatus: 'overdue',
      creatorUserId: owner.userId,
      startLabel: 'Whitefield',
      destinationLabel: 'Airport Terminal 2',
      travelMode: 'driving',
      etaMinutes: 55,
      liveProgress: 60,
    }),
    createRoomWithRoute({
      inviteCode: 'HUBC3',
      title: 'Journey Overdue',
      status: 'live',
      journeyStatus: 'overdue',
      creatorUserId: owner.userId,
      startLabel: 'MG Road',
      destinationLabel: 'School Gate',
      travelMode: 'driving',
      etaMinutes: 25,
    }),
    createRoomWithRoute({
      inviteCode: 'HUBD4',
      title: 'Cancelled Before Lock',
      status: 'completed',
      journeyStatus: 'plan_changed',
      closureReasonCode: 'plan_changed',
      creatorUserId: owner.userId,
      startLabel: 'HSR Layout',
      destinationLabel: 'Indiranagar Cafe',
      travelMode: 'driving',
      etaMinutes: 30,
    }),
    createRoomWithRoute({
      inviteCode: 'HUBE5',
      title: 'Cancelled After Lock',
      status: 'completed',
      journeyStatus: 'cancelled_by_host',
      closureReasonCode: 'other',
      creatorUserId: owner.userId,
      roomType: 'group_journey',
      startLabel: 'South Bengaluru',
      destinationLabel: 'Office Campus',
      travelMode: 'driving',
      etaMinutes: 45,
    }),
    createRoomWithRoute({
      inviteCode: 'HUBF6',
      title: 'Journey No-Show',
      status: 'completed',
      journeyStatus: 'abandoned',
      creatorUserId: owner.userId,
      startLabel: 'Jayanagar',
      destinationLabel: 'Tech Park',
      travelMode: 'driving',
      etaMinutes: 40,
    }),
    createRoomWithRoute({
      inviteCode: 'HUBG7',
      title: 'Journey Auto-Closed',
      status: 'completed',
      journeyStatus: 'auto_closed',
      creatorUserId: owner.userId,
      roomType: 'group_journey',
      startLabel: 'South Bengaluru',
      destinationLabel: 'Office Campus',
      travelMode: 'driving',
      etaMinutes: 45,
    }),
  ]);

  for (const [index, scenario] of scenarios.entries()) {
    await upsertMembership(scenario.room.roomId, scenario.room.creatorUserId, 'creator');
    await Promise.all(
      friends.map((friend) => upsertMembership(scenario.room.roomId, friend.userId, 'participant')),
    );

    for (const friend of friends) {
      await prisma.milestonePrediction.upsert({
        where: {
          milestoneId_userId: {
            milestoneId: scenario.milestone.milestoneId,
            userId: friend.userId,
          },
        },
        update: {
          predictedReachedTime: addMinutes(new Date(), 20 + index * 4),
          revokedAt: null,
        },
        create: {
          roomId: scenario.room.roomId,
          milestoneId: scenario.milestone.milestoneId,
          userId: friend.userId,
          predictedReachedTime: addMinutes(new Date(), 20 + index * 4),
        },
      });
    }

    if (scenario.room.status !== 'predictions_locked') {
      await prisma.milestonePrediction.upsert({
        where: {
          milestoneId_userId: {
            milestoneId: scenario.milestone.milestoneId,
            userId: owner.userId,
          },
        },
        update: {
          predictedReachedTime: addMinutes(new Date(), 18 + index * 3),
          revokedAt: null,
        },
        create: {
          roomId: scenario.room.roomId,
          milestoneId: scenario.milestone.milestoneId,
          userId: owner.userId,
          predictedReachedTime: addMinutes(new Date(), 18 + index * 3),
        },
      });
    }

    await prisma.userRoomPreference.upsert({
      where: { userId_roomId: { userId: owner.userId, roomId: scenario.room.roomId } },
      update: { displayOrder: index, pinned: index < 2 },
      create: { userId: owner.userId, roomId: scenario.room.roomId, displayOrder: index, pinned: index < 2 },
    });
  }

  const completedDemoRoom = scenarios[0];
  const winner = friends[0];
  const actualTime = addMinutes(new Date(), -5);

  await prisma.predictionRoom.update({
    where: { roomId: completedDemoRoom.room.roomId },
    data: {
      oracleBotPrediction: {
        label: 'Oracle Bot says 9:35 AM',
        predictedDurationMinutes: 38,
      },
      baselineLabel: 'Oracle Bot benchmark',
      actualEndTime: actualTime,
    },
  });

  await prisma.milestonePrediction.updateMany({
    where: { roomId: completedDemoRoom.room.roomId, userId: winner.userId },
    data: {
      differenceFromActualMinutes: 1,
      differenceFromActualSeconds: 60,
      rankForMilestone: 1,
      totalAuraAwarded: 100,
      rankBonusAura: 15,
    },
  });

  await prisma.roomResult.upsert({
    where: { roomId_userId: { roomId: completedDemoRoom.room.roomId, userId: winner.userId } },
    update: { totalRoomAura: 115, overallRank: 1, milestonesWon: 1 },
    create: {
      roomId: completedDemoRoom.room.roomId,
      userId: winner.userId,
      totalRoomAura: 115,
      totalRoomClout: 40,
      milestonesWon: 1,
      overallRank: 1,
    },
  });

  await prisma.roomCommentary.upsert({
    where: { commentaryId: '00000000-0000-4000-8000-000000000101' },
    update: {
      roomId: completedDemoRoom.room.roomId,
      generatedByUserId: owner.userId,
      personality: 'Chaos',
      headline: 'Bangalore traffic read the ETA and chose chaos.',
      punchline: 'Oracle Bot brought spreadsheets. @shashwat brought instinct.',
      supportingLine: 'Route Oracle unlocked. Closest guess wins Aura.',
      safetyMode: 'deterministic',
      provider: 'templates',
      generationVersion: 1,
      isCurrent: true,
    },
    create: {
      commentaryId: '00000000-0000-4000-8000-000000000101',
      roomId: completedDemoRoom.room.roomId,
      generatedByUserId: owner.userId,
      personality: 'Chaos',
      headline: 'Bangalore traffic read the ETA and chose chaos.',
      punchline: 'Oracle Bot brought spreadsheets. @shashwat brought instinct.',
      supportingLine: 'Route Oracle unlocked. Closest guess wins Aura.',
      safetyMode: 'deterministic',
      provider: 'templates',
      generationVersion: 1,
      isCurrent: true,
    },
  });

  await prisma.userBadge.upsert({
    where: {
      userId_roomId_badgeKey: {
        userId: winner.userId,
        roomId: completedDemoRoom.room.roomId,
        badgeKey: 'route_oracle',
      },
    },
    update: {
      title: 'Route Oracle',
      description: 'Closest arrival read on a route room.',
      icon: '🛣️',
      category: 'arrival_time',
    },
    create: {
      userId: winner.userId,
      roomId: completedDemoRoom.room.roomId,
      badgeKey: 'route_oracle',
      title: 'Route Oracle',
      description: 'Closest arrival read on a route room.',
      icon: '🛣️',
      category: 'arrival_time',
    },
  });

  await prisma.userBadge.upsert({
    where: {
      userId_roomId_badgeKey: {
        userId: winner.userId,
        roomId: completedDemoRoom.room.roomId,
        badgeKey: 'bot_beater',
      },
    },
    update: {
      title: 'Bot Beater',
      description: 'Beat Oracle Bot on a room result.',
      icon: '🤖',
      category: 'arrival_time',
    },
    create: {
      userId: winner.userId,
      roomId: completedDemoRoom.room.roomId,
      badgeKey: 'bot_beater',
      title: 'Bot Beater',
      description: 'Beat Oracle Bot on a room result.',
      icon: '🤖',
      category: 'arrival_time',
    },
  });

  await prisma.resultReaction.upsert({
    where: {
      roomId_userId_emoji: {
        roomId: completedDemoRoom.room.roomId,
        userId: owner.userId,
        emoji: '🔥',
      },
    },
    update: {},
    create: {
      roomId: completedDemoRoom.room.roomId,
      userId: owner.userId,
      emoji: '🔥',
    },
  });

  const neutralRoom = scenarios[3];
  await prisma.roomCommentary.upsert({
    where: { commentaryId: '00000000-0000-4000-8000-000000000102' },
    update: {
      roomId: neutralRoom.room.roomId,
      generatedByUserId: owner.userId,
      personality: 'Oracle',
      headline: 'Fair reset',
      punchline: 'Plans changed. This PREDIKT closed fairly, and nobody’s prediction counted as a loss.',
      supportingLine: 'Everyone gets a fair reset.',
      safetyMode: 'neutral',
      provider: 'templates',
      generationVersion: 1,
      isCurrent: true,
    },
    create: {
      commentaryId: '00000000-0000-4000-8000-000000000102',
      roomId: neutralRoom.room.roomId,
      generatedByUserId: owner.userId,
      personality: 'Oracle',
      headline: 'Fair reset',
      punchline: 'Plans changed. This PREDIKT closed fairly, and nobody’s prediction counted as a loss.',
      supportingLine: 'Everyone gets a fair reset.',
      safetyMode: 'neutral',
      provider: 'templates',
      generationVersion: 1,
      isCurrent: true,
    },
  });

  const joinedOnly = await createRoomWithRoute({
    inviteCode: 'HUBJ8',
    title: 'Joined Before Prediction',
    status: 'predictions_open',
    creatorUserId: friends[0].userId,
    startLabel: 'Mall Entrance',
    destinationLabel: 'Home Gate',
    travelMode: 'driving',
    etaMinutes: 28,
  });
  await upsertMembership(joinedOnly.room.roomId, friends[0].userId, 'creator');
  await upsertMembership(joinedOnly.room.roomId, owner.userId, 'participant');
  await prisma.userRoomPreference.upsert({
    where: { userId_roomId: { userId: owner.userId, roomId: joinedOnly.room.roomId } },
    update: { displayOrder: scenarios.length, pinned: false },
    create: { userId: owner.userId, roomId: joinedOnly.room.roomId, displayOrder: scenarios.length, pinned: false },
  });

  const categoryRooms = await Promise.all([
    createGenericCategoryRoom({
      inviteCode: 'CATR1',
      creatorUserId: owner.userId,
      category: 'weather_rain',
      mode: 'beat_bot',
      title: 'Beat the Forecast: Koramangala Rain',
      question: 'Beat the Forecast',
      answerType: 'multiple_choice',
      options: ['no_rain', 'rain_before_6', 'rain_after_6'],
      baselineLabel: 'Forecast chance',
      baselineValue: 65,
      baselineSnapshot: {
        forecastChancePercent: 65,
        forecastWindow: '5-8 PM',
        forecastProviderLabel: 'Weather app',
        capturedAt: nowIso(),
      },
      oracleBotPrediction: {
        selectedOptionKey: 'rain_before_6',
        label: 'Yes, before 6 PM',
        reason: '65% forecast benchmark with a 5-8 PM window.',
      },
      startingPointLabel: 'Koramangala',
      destinationLabel: 'Today 5-8 PM',
      selectedOptionKeys: ['rain_before_6', 'rain_after_6', 'no_rain', 'rain_before_6'],
    }),
    createGenericCategoryRoom({
      inviteCode: 'CATF2',
      creatorUserId: owner.userId,
      category: 'food_eta',
      mode: 'beat_bot',
      title: 'Will dinner beat the ETA?',
      question: 'Will it beat the ETA?',
      answerType: 'yes_no',
      baselineLabel: 'Zomato ETA',
      baselineValue: '35 mins',
      baselineSnapshot: {
        providerLabel: 'Zomato',
        appEtaMinutes: 35,
        capturedAt: nowIso(),
      },
      oracleBotPrediction: {
        predictedDurationMinutes: 38,
        label: 'Oracle Bot says 38 mins',
      },
      startingPointLabel: 'Zomato',
      destinationLabel: '35 mins',
    }),
    createGenericCategoryRoom({
      inviteCode: 'CATL3',
      creatorUserId: owner.userId,
      category: 'whos_late',
      mode: 'friends',
      title: 'Cafe meetup arrival challenge',
      question: 'Who will reach last?',
      answerType: 'yes_no',
      baselineLabel: 'Meet time',
      baselineValue: '8:30 PM',
      startingPointLabel: 'Friendly group template',
      destinationLabel: '8:30 PM',
    }),
    createGenericCategoryRoom({
      inviteCode: 'CATG4',
      creatorUserId: owner.userId,
      category: 'gym_habit',
      mode: 'challenge_self',
      title: 'Tomorrow gym streak',
      question: 'Will I go to the gym tomorrow?',
      answerType: 'yes_no',
      baselineLabel: 'Habit target',
      baselineValue: 'Tomorrow morning',
      startingPointLabel: 'Personal habit',
      destinationLabel: 'Tomorrow',
    }),
  ]);

  for (const [index, categoryRoom] of categoryRooms.entries()) {
    await upsertMembership(categoryRoom.room.roomId, categoryRoom.room.creatorUserId, 'creator');
    await Promise.all(
      friends.map((friend) => upsertMembership(categoryRoom.room.roomId, friend.userId, 'participant')),
    );
    await prisma.userRoomPreference.upsert({
      where: { userId_roomId: { userId: owner.userId, roomId: categoryRoom.room.roomId } },
      update: { displayOrder: scenarios.length + 1 + index, pinned: index < 2 },
      create: {
        userId: owner.userId,
        roomId: categoryRoom.room.roomId,
        displayOrder: scenarios.length + 1 + index,
        pinned: index < 2,
      },
    });

    for (const [friendIndex, friend] of friends.entries()) {
      await prisma.milestonePrediction.upsert({
        where: {
          milestoneId_userId: {
            milestoneId: categoryRoom.milestone.milestoneId,
            userId: friend.userId,
          },
        },
        update: {
          predictedReachedTime: addMinutes(new Date(), 25 + friendIndex),
          selectedOptionKey: categoryRoom.selectedOptionKeys[friendIndex] ?? null,
          revokedAt: null,
        },
        create: {
          roomId: categoryRoom.room.roomId,
          milestoneId: categoryRoom.milestone.milestoneId,
          userId: friend.userId,
          predictedReachedTime: addMinutes(new Date(), 25 + friendIndex),
          selectedOptionKey: categoryRoom.selectedOptionKeys[friendIndex] ?? null,
        },
      });
    }
  }

  const notificationRoomIds = [
    ...scenarios.map((scenario) => scenario.room.roomId),
    joinedOnly.room.roomId,
    ...categoryRooms.map((scenario) => scenario.room.roomId),
  ];
  await prisma.userNotification.deleteMany({
    where: {
      userId: owner.userId,
      roomId: { in: notificationRoomIds },
      type: {
        in: [
          'result_ready',
          'journey_overdue',
          'prediction_needed',
          'journey_auto_closed',
          'reliability_updated',
        ],
      },
    },
  });
  await prisma.userNotification.createMany({
    data: [
      {
        userId: owner.userId,
        roomId: scenarios[0].room.roomId,
        type: 'result_ready',
        title: 'Result ready',
        body: 'Results are ready. See who made the Closest Guess and earned Aura.',
        status: 'unread',
        severity: 'success',
        actionLabel: 'View result',
        actionTarget: `room:${scenarios[0].room.roomId}:result`,
        metadata: { demoSeed: true },
      },
      {
        userId: owner.userId,
        roomId: scenarios[2].room.roomId,
        type: 'journey_overdue',
        title: 'Journey overdue',
        body: 'Arrival has not been verified yet. The room may close neutrally if there is no update.',
        status: 'unread',
        severity: 'warning',
        actionLabel: 'View live',
        actionTarget: `room:${scenarios[2].room.roomId}:live`,
        metadata: { demoSeed: true },
      },
      {
        userId: owner.userId,
        roomId: joinedOnly.room.roomId,
        type: 'prediction_needed',
        title: 'Prediction needed',
        body: 'This room is ready for your prediction.',
        status: 'unread',
        severity: 'action_required',
        actionLabel: 'Predict',
        actionTarget: `room:${joinedOnly.room.roomId}:prediction`,
        metadata: { demoSeed: true },
      },
      {
        userId: owner.userId,
        roomId: scenarios[6].room.roomId,
        type: 'journey_auto_closed',
        title: 'Journey auto-closed',
        body: 'No verified arrival was recorded, so this PREDIKT was closed neutrally. Your prediction was not counted as a loss.',
        status: 'read',
        severity: 'warning',
        actionLabel: 'View result',
        actionTarget: `room:${scenarios[6].room.roomId}:result`,
        metadata: { demoSeed: true },
        readAt: new Date(),
      },
      {
        userId: owner.userId,
        roomId: scenarios[6].room.roomId,
        type: 'reliability_updated',
        title: 'Reliability updated',
        body: 'Your Reliability changed after this journey. Review the room for context.',
        status: 'read',
        severity: 'info',
        actionLabel: 'View profile',
        actionTarget: null,
        metadata: { demoSeed: true },
        readAt: new Date(),
      },
    ],
  });

  console.log('Engagement demo seeded for test@predikt.ai');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
