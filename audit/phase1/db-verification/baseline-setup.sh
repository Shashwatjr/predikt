#!/usr/bin/env bash
# Schema-derived local baseline setup for predikt DB verification.
# Creates a fresh disposable DB and bootstraps it from schema.prisma.
# Usage: POSTGRES_CONTAINER=<name> DB_USER=<user> bash baseline-setup.sh
set -euo pipefail

CONTAINER="${POSTGRES_CONTAINER:-kriviksha-postgres-1}"
DB_USER="${DB_USER:-kriviksha}"
DB_NAME="${DB_NAME:-predikt_verify_test}"
SCHEMA="${SCHEMA:-backend/prisma/schema.prisma}"
PRISMA="${PRISMA:-backend/node_modules/.bin/prisma}"

echo "==> Creating database $DB_NAME"
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS $DB_NAME; CREATE DATABASE $DB_NAME;"

echo "==> Generating baseline DDL from schema"
DATABASE_URL="dummy://for-diff-only" \
  "$PRISMA" migrate diff \
  --from-empty \
  --to-schema-datamodel "$SCHEMA" \
  --script > /tmp/predikt_baseline.sql

echo "==> Applying baseline DDL"
docker cp /tmp/predikt_baseline.sql "$CONTAINER":/tmp/predikt_baseline.sql
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -f /tmp/predikt_baseline.sql

echo "==> Seeding _prisma_migrations (all 6 as applied)"
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" << 'SQL'
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count)
VALUES
  (gen_random_uuid()::text, 'baseline', now(), '20260713000000_admin_portal_beta', 1),
  (gen_random_uuid()::text, 'baseline', now(), '20260714000000_room_checkpoints', 1),
  (gen_random_uuid()::text, 'baseline', now(), '20260719000000_add_oracle_result_column', 1),
  (gen_random_uuid()::text, 'baseline', now(), '20260719000001_add_milestone_prediction_checkpoint_fields', 1),
  (gen_random_uuid()::text, 'baseline', now(), '20260725000000_room_checkpoint_eta_columns', 1),
  (gen_random_uuid()::text, 'baseline', now(), '20260725130000_travel_eta_overhaul', 1)
ON CONFLICT DO NOTHING;
SQL

echo "==> Done. $DB_NAME is ready for verification."
