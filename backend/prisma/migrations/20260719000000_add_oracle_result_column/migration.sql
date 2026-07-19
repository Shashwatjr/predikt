ALTER TABLE "prediction_rooms"
ADD COLUMN IF NOT EXISTS "oracle_result" JSONB;
