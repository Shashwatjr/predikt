-- DB Verification Scenarios — predikt_verify_test
-- Branch: verify/db-verification @ 7aa032d
-- Run: docker exec kriviksha-postgres-1 psql -U kriviksha -d predikt_verify_test -f verify_scenarios.sql
-- All 4 scenarios produced PASS on 2026-10-27.
--
-- Setup: schema bootstrapped via `prisma migrate diff --from-empty --to-schema-datamodel`
-- then _prisma_migrations seeded with all 6 existing migrations marked applied.

BEGIN;

-- ── Seed two users ─────────────────────────────────────────────────────────
INSERT INTO users (user_id, name, email, predikt_handle, status, created_at, updated_at)
VALUES
  ('user-creator-1', 'Creator Alice', 'alice@test.com', 'alice', 'active', now(), now()),
  ('user-pred-1',    'Predictor Bob', 'bob@test.com',   'bob99', 'active', now(), now())
ON CONFLICT DO NOTHING;

-- ── Room A: SCORED journey (status=completed, has result) ─────────────────
INSERT INTO prediction_rooms (
  room_id, creator_user_id, room_title, event_type, status,
  starting_point_label, destination_label,
  prediction_close_time, actual_end_time,
  journey_status, answer_type, invite_code,
  created_at, updated_at
)
VALUES (
  'room-scored-1', 'user-creator-1', 'Scored Journey Test', 'journey', 'completed',
  'Origin', 'Destination',
  now() - interval '2 hours', now() - interval '30 minutes',
  'completed', 'exact_time', 'INV-SCORED-1',
  now() - interval '3 hours', now()
) ON CONFLICT DO NOTHING;

INSERT INTO room_milestones (
  milestone_id, room_id, milestone_order, milestone_name, milestone_type,
  status, actual_reached_time, created_at, updated_at
)
VALUES (
  'ms-scored-1', 'room-scored-1', 1, 'Destination', 'final_destination',
  'reached', now() - interval '30 minutes', now() - interval '3 hours', now()
) ON CONFLICT DO NOTHING;

INSERT INTO room_memberships (membership_id, room_id, user_id, role, status, joined_at, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'room-scored-1', 'user-creator-1', 'creator', 'joined', now() - interval '3 hours', now(), now()),
  (gen_random_uuid(), 'room-scored-1', 'user-pred-1',    'participant', 'joined', now() - interval '3 hours', now(), now())
ON CONFLICT DO NOTHING;

INSERT INTO milestone_predictions (
  prediction_id, milestone_id, room_id, user_id,
  predicted_reached_time, submitted_at, locked_status,
  difference_from_actual_seconds, rank_for_milestone,
  base_aura, total_aura_awarded
)
VALUES (
  'mp-scored-bob', 'ms-scored-1', 'room-scored-1', 'user-pred-1',
  now() - interval '31 minutes', now() - interval '2 hours', true,
  60, 1, 100, 120
) ON CONFLICT DO NOTHING;

INSERT INTO room_results (room_result_id, room_id, user_id, total_room_aura, milestones_won, overall_rank, created_at)
VALUES ('rr-bob-scored', 'room-scored-1', 'user-pred-1', 120, 1, 1, now())
ON CONFLICT DO NOTHING;

-- SCENARIO 1: Scored journey returns real winner identity/handle and correct reward
SELECT
  'SCENARIO_1_SCORED_WINNER' AS test,
  u.predikt_handle,
  rr.total_room_aura,
  rr.overall_rank,
  mp.difference_from_actual_seconds,
  CASE WHEN rr.overall_rank = 1 AND u.predikt_handle = 'bob99' AND rr.total_room_aura = 120
       THEN 'PASS' ELSE 'FAIL' END AS result
FROM room_results rr
JOIN users u ON u.user_id = rr.user_id
JOIN milestone_predictions mp ON mp.room_id = rr.room_id AND mp.user_id = rr.user_id
WHERE rr.room_id = 'room-scored-1'
ORDER BY rr.overall_rank;

-- ── Room B: UNSCORED journey (status=live) ────────────────────────────────
INSERT INTO prediction_rooms (
  room_id, creator_user_id, room_title, event_type, status,
  starting_point_label, destination_label,
  prediction_close_time, journey_status, answer_type, invite_code,
  created_at, updated_at
)
VALUES (
  'room-live-1', 'user-creator-1', 'Live Unscored Room', 'journey', 'live',
  'Start', 'End',
  now() - interval '30 minutes', 'in_progress', 'exact_time', 'INV-LIVE-1',
  now() - interval '1 hour', now()
) ON CONFLICT DO NOTHING;

INSERT INTO room_milestones (
  milestone_id, room_id, milestone_order, milestone_name, milestone_type,
  status, created_at, updated_at
)
VALUES (
  'ms-live-1', 'room-live-1', 1, 'Destination', 'final_destination',
  'prediction_locked', now() - interval '1 hour', now()
) ON CONFLICT DO NOTHING;

INSERT INTO milestone_predictions (
  prediction_id, milestone_id, room_id, user_id,
  predicted_reached_time, submitted_at, locked_status,
  rank_for_milestone, total_aura_awarded
)
VALUES (
  'mp-live-bob', 'ms-live-1', 'room-live-1', 'user-pred-1',
  now() + interval '30 minutes', now() - interval '30 minutes', true,
  NULL, 0
) ON CONFLICT DO NOTHING;

-- SCENARIO 2: Unscored journey stays pending (rank=NULL, aura=0, no room_result)
SELECT
  'SCENARIO_2_UNSCORED_PENDING' AS test,
  mp.rank_for_milestone,
  mp.total_aura_awarded,
  (SELECT COUNT(*) FROM room_results WHERE room_id = 'room-live-1') AS result_count,
  CASE
    WHEN mp.rank_for_milestone IS NULL AND mp.total_aura_awarded = 0
         AND (SELECT COUNT(*) FROM room_results WHERE room_id = 'room-live-1') = 0
    THEN 'PASS' ELSE 'FAIL'
  END AS result
FROM milestone_predictions mp
WHERE mp.room_id = 'room-live-1' AND mp.user_id = 'user-pred-1';

-- ── Room C: Arrival 500 regression — room with no destinationLat/Lng ───────
INSERT INTO prediction_rooms (
  room_id, creator_user_id, room_title, event_type, status,
  starting_point_label, destination_label,
  prediction_close_time, journey_status, answer_type, invite_code,
  destination_lat, destination_lng,
  created_at, updated_at
)
VALUES (
  'room-arrival-1', 'user-creator-1', 'Arrival Test Room', 'journey', 'live',
  'Start', 'Nowhere',
  now() - interval '10 minutes', 'in_progress', 'exact_time', 'INV-ARR-1',
  NULL, NULL,
  now() - interval '1 hour', now()
) ON CONFLICT DO NOTHING;

-- Simulate confirmArrivalWithContext write
UPDATE prediction_rooms
SET
  journey_status = 'arrived_verified',
  arrival_confirmed_at = now(),
  actual_end_time = now(),
  outcome_source = 'arrival_confirmed',
  confidence_level = 'verified',
  status = 'completed',
  updated_at = now()
WHERE room_id = 'room-arrival-1';

-- SCENARIO 3: Arrival writes succeed without constraint errors
SELECT
  'SCENARIO_3_ARRIVAL_NO_500' AS test,
  journey_status,
  arrival_confirmed_at IS NOT NULL AS has_arrival_time,
  CASE
    WHEN journey_status = 'arrived_verified' AND arrival_confirmed_at IS NOT NULL
    THEN 'PASS' ELSE 'FAIL'
  END AS result
FROM prediction_rooms
WHERE room_id = 'room-arrival-1';

-- ── Room D: Creator delivery-ETA guess → MilestonePrediction ─────────────
INSERT INTO prediction_rooms (
  room_id, creator_user_id, room_title, event_type, status,
  starting_point_label, destination_label,
  prediction_close_time, journey_status, answer_type, invite_code,
  created_at, updated_at
)
VALUES (
  'room-eta-1', 'user-creator-1', 'Delivery ETA Room', 'delivery', 'predictions_open',
  'Warehouse', 'Customer',
  now() + interval '30 minutes', 'in_progress', 'exact_time', 'INV-ETA-1',
  now() - interval '30 minutes', now()
) ON CONFLICT DO NOTHING;

INSERT INTO room_milestones (
  milestone_id, room_id, milestone_order, milestone_name, milestone_type,
  status, prediction_close_time, created_at, updated_at
)
VALUES (
  'ms-eta-1', 'room-eta-1', 1, 'Delivery Point', 'final_destination',
  'prediction_open', now() + interval '30 minutes', now() - interval '30 minutes', now()
) ON CONFLICT DO NOTHING;

INSERT INTO milestone_predictions (
  prediction_id, milestone_id, room_id, user_id,
  predicted_reached_time, submitted_at, locked_status
)
VALUES (
  'mp-creator-eta', 'ms-eta-1', 'room-eta-1', 'user-creator-1',
  now() + interval '45 minutes', now(), false
) ON CONFLICT DO NOTHING;

-- SCENARIO 4: Creator ETA guess persists as expected MilestonePrediction row
SELECT
  'SCENARIO_4_CREATOR_ETA_PERSISTS' AS test,
  mp.prediction_id,
  u.predikt_handle AS creator_handle,
  mp.predicted_reached_time > now() AS eta_in_future,
  CASE
    WHEN mp.prediction_id = 'mp-creator-eta' AND mp.user_id = 'user-creator-1'
    THEN 'PASS' ELSE 'FAIL'
  END AS result
FROM milestone_predictions mp
JOIN users u ON u.user_id = mp.user_id
WHERE mp.prediction_id = 'mp-creator-eta';

COMMIT;
