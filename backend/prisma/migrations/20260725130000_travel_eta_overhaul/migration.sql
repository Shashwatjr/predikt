-- AlterTable
ALTER TABLE "prediction_rooms" ADD COLUMN     "predictions_locked_at" TIMESTAMP(3),
ADD COLUMN     "revealed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "milestone_predictions" ADD COLUMN     "hot_take" TEXT;

-- CreateTable
CREATE TABLE "room_milestone_snapshots" (
    "snapshot_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "checkpoint_percent" INTEGER NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eta_seconds" INTEGER,
    "remaining_meters" INTEGER,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_milestone_snapshots_pkey" PRIMARY KEY ("snapshot_id")
);

-- CreateTable
CREATE TABLE "invite_forwards" (
    "invite_forward_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "original_inviter_user_id" TEXT NOT NULL,
    "forwarder_user_id" TEXT NOT NULL,
    "joined_guest_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_forwards_pkey" PRIMARY KEY ("invite_forward_id")
);

-- CreateIndex
CREATE INDEX "room_milestone_snapshots_room_id_captured_at_idx" ON "room_milestone_snapshots"("room_id", "captured_at");

-- CreateIndex
CREATE UNIQUE INDEX "room_milestone_snapshots_room_id_checkpoint_percent_key" ON "room_milestone_snapshots"("room_id", "checkpoint_percent");

-- CreateIndex
CREATE INDEX "invite_forwards_room_id_idx" ON "invite_forwards"("room_id");

-- CreateIndex
CREATE INDEX "invite_forwards_original_inviter_user_id_idx" ON "invite_forwards"("original_inviter_user_id");

-- CreateIndex
CREATE INDEX "invite_forwards_forwarder_user_id_idx" ON "invite_forwards"("forwarder_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invite_forwards_room_id_joined_guest_user_id_key" ON "invite_forwards"("room_id", "joined_guest_user_id");

-- AddForeignKey
ALTER TABLE "room_milestone_snapshots" ADD CONSTRAINT "room_milestone_snapshots_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_forwards" ADD CONSTRAINT "invite_forwards_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_forwards" ADD CONSTRAINT "invite_forwards_original_inviter_user_id_fkey" FOREIGN KEY ("original_inviter_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_forwards" ADD CONSTRAINT "invite_forwards_forwarder_user_id_fkey" FOREIGN KEY ("forwarder_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_forwards" ADD CONSTRAINT "invite_forwards_joined_guest_user_id_fkey" FOREIGN KEY ("joined_guest_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

