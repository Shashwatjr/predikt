import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Regression guard for the confirm-arrival 500 (P2022).
 *
 * checkpoint_leaderboard_v2 added RoomCheckpoint.etaSeconds + source to schema.prisma
 * but shipped no migration for room_checkpoints, so production (built via `prisma db
 * push`) was missing the columns. The deployed Prisma client selects every scalar
 * column on write, so recordCheckpoint()'s upsert threw
 * "column room_checkpoints.eta_seconds does not exist" and 500-ed confirm-arrival.
 *
 * This test fails whenever a RoomCheckpoint column exists in the Prisma schema but no
 * migration creates it — i.e. exactly the drift that caused the outage.
 */
describe('RoomCheckpoint schema/migration parity', () => {
  const prismaDir = join(__dirname, '..', '..', 'prisma');
  const schema = readFileSync(join(prismaDir, 'schema.prisma'), 'utf8');

  function dbColumnsFor(modelName: string): string[] {
    const model = new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\n\\}`).exec(schema);
    if (!model) throw new Error(`model ${modelName} not found in schema.prisma`);
    const columns: string[] = [];
    for (const line of model[1].split('\n')) {
      const trimmed = line.trim();
      // Skip blank lines, comments, block attributes (@@), and relation fields
      // (a relation field has no @map and its type is another model / array).
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;
      const mapped = /@map\("([^"]+)"\)/.exec(trimmed);
      if (mapped) {
        columns.push(mapped[1]);
        continue;
      }
      // Field with no @map: its column name is the field name (only for scalar fields).
      const field = /^(\w+)\s+(\w+)(\[\])?(\?)?/.exec(trimmed);
      const scalarTypes = ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Decimal', 'BigInt'];
      if (field && scalarTypes.includes(field[2]) && !field[3]) {
        columns.push(field[1]);
      }
    }
    return columns;
  }

  const migrationSql = readdirSync(join(prismaDir, 'migrations'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readFileSync(join(prismaDir, 'migrations', entry.name, 'migration.sql'), 'utf8'))
    .join('\n');

  it('has a migration for every RoomCheckpoint column', () => {
    const columns = dbColumnsFor('RoomCheckpoint');
    expect(columns).toContain('eta_seconds');
    expect(columns).toContain('source');

    const missing = columns.filter((column) => !migrationSql.includes(`"${column}"`));
    expect(missing).toEqual([]);
  });
});
