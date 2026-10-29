-- Milestone Google Maps ETAs (duration_in_traffic) captured by the journey
-- worker. Nullable JSON, additive, safe to re-run.
ALTER TABLE "prediction_rooms"
ADD COLUMN IF NOT EXISTS "checkpoint_etas" JSONB;
