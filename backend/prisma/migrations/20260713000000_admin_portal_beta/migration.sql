-- Admin portal private beta: analytics indexes, feedback queue, moderation fields

ALTER TABLE "activity_events" ADD COLUMN IF NOT EXISTS "room_id" TEXT;
ALTER TABLE "activity_events" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "activity_events" ADD COLUMN IF NOT EXISTS "platform" TEXT;
ALTER TABLE "activity_events" ADD COLUMN IF NOT EXISTS "session_id" TEXT;
ALTER TABLE "activity_events" ADD COLUMN IF NOT EXISTS "event_version" TEXT NOT NULL DEFAULT '1';

CREATE INDEX IF NOT EXISTS "activity_events_event_type_idx" ON "activity_events"("event_type");
CREATE INDEX IF NOT EXISTS "activity_events_created_at_idx" ON "activity_events"("created_at");
CREATE INDEX IF NOT EXISTS "activity_events_room_id_idx" ON "activity_events"("room_id");
CREATE INDEX IF NOT EXISTS "activity_events_user_id_idx" ON "activity_events"("user_id");
CREATE INDEX IF NOT EXISTS "activity_events_category_idx" ON "activity_events"("category");

ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "assigned_admin_id" TEXT;

CREATE INDEX IF NOT EXISTS "reports_status_idx" ON "reports"("status");
CREATE INDEX IF NOT EXISTS "reports_report_type_idx" ON "reports"("report_type");
CREATE INDEX IF NOT EXISTS "reports_created_at_idx" ON "reports"("created_at");

ALTER TABLE "reports" ADD CONSTRAINT "reports_assigned_admin_id_fkey"
  FOREIGN KEY ("assigned_admin_id") REFERENCES "admin_users"("admin_user_id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "user_feedback" (
  "feedback_id" TEXT NOT NULL,
  "user_id" TEXT,
  "feedback_type" TEXT NOT NULL,
  "category" TEXT,
  "status" TEXT NOT NULL DEFAULT 'new',
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "message" TEXT NOT NULL,
  "contact_allowed" BOOLEAN NOT NULL DEFAULT false,
  "platform" TEXT,
  "room_id" TEXT,
  "assigned_admin_id" TEXT,
  "internal_notes" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_feedback_pkey" PRIMARY KEY ("feedback_id")
);

CREATE INDEX IF NOT EXISTS "user_feedback_status_idx" ON "user_feedback"("status");
CREATE INDEX IF NOT EXISTS "user_feedback_feedback_type_idx" ON "user_feedback"("feedback_type");
CREATE INDEX IF NOT EXISTS "user_feedback_created_at_idx" ON "user_feedback"("created_at");

ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_assigned_admin_id_fkey"
  FOREIGN KEY ("assigned_admin_id") REFERENCES "admin_users"("admin_user_id")
  ON DELETE SET NULL ON UPDATE CASCADE;
