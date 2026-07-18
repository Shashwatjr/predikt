CREATE TABLE "room_checkpoints" (
    "room_checkpoint_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "checkpoint" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_checkpoints_pkey" PRIMARY KEY ("room_checkpoint_id")
);

CREATE UNIQUE INDEX "room_checkpoints_room_id_checkpoint_key" ON "room_checkpoints"("room_id", "checkpoint");
CREATE INDEX "room_checkpoints_room_id_captured_at_idx" ON "room_checkpoints"("room_id", "captured_at");

ALTER TABLE "room_checkpoints"
ADD CONSTRAINT "room_checkpoints_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "prediction_rooms"("room_id")
ON DELETE RESTRICT ON UPDATE CASCADE;
