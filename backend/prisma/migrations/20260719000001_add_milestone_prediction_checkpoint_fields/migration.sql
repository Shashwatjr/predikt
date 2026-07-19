ALTER TABLE "milestone_predictions"
ADD COLUMN IF NOT EXISTS "aura_eligible" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "milestone_predictions"
ADD COLUMN IF NOT EXISTS "locked_checkpoint" INTEGER;
