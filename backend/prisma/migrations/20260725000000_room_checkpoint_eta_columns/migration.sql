-- checkpoint_leaderboard_v2 added RoomCheckpoint.etaSeconds + source to the Prisma
-- schema, but no migration was written for room_checkpoints, so production (built via
-- `prisma db push`) never got the columns. The deployed client selects all scalar
-- columns on write, so recordCheckpoint()'s upsert threw P2022
-- ("column room_checkpoints.eta_seconds does not exist"), 500-ing confirm-arrival.
-- Additive + nullable + IF NOT EXISTS so it is safe to re-run against any environment.
ALTER TABLE "room_checkpoints"
ADD COLUMN IF NOT EXISTS "eta_seconds" INTEGER,
ADD COLUMN IF NOT EXISTS "source" TEXT;
