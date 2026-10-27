"""Supported Prisma baseline rehearsal. Local disposable databases only.

Fresh database: prisma migrate deploy executes every migration file.
Existing local schema: catalog checks, then prisma migrate resolve --applied
for each verified migration, then deploy. No INSERT into _prisma_migrations.
Does not connect migrate to predikt_ui or any non-loopback database.
"""
import hashlib, json, os, re, subprocess, time
from pathlib import Path

root = Path(__file__).resolve().parents[5]
backend = root / 'backend'
out = Path(__file__).resolve().parent
container = 'predikt_ui_acceptance_pg'
migrations = sorted((backend / 'prisma/migrations').glob('*/migration.sql'))
expected_six = {
    '20260713000000_admin_portal_beta': 'db8dc0328a1a45025493bcb8edb5c5b70a14db760d07cc98ad61dd9a01e11d3d',
    '20260714000000_room_checkpoints': '307112d2031d9c24129696c2f886e59cfcd93afe41ef31420d049712aa554773',
    '20260719000000_add_oracle_result_column': '3a86b1ba3660e3438276a825fb7e73df201769fa51e06c77316b9a3cf2f587ab',
    '20260719000001_add_milestone_prediction_checkpoint_fields': '1200d0b300764216b4933a67bda924f1763ef82b8d8230dfd5428565aabc7fa4',
    '20260725000000_room_checkpoint_eta_columns': 'd04773d4352347b19a0e5f2e5f9b21d404fba96b70ac9a49537641143e5e5cc7',
    '20260725130000_travel_eta_overhaul': '6a642c13a6011977ce4a3595fad104ac0960423fb7244d0625bac1dd3a7e6f90',
}
checks = {
    '20260712000000_inferred_prerequisites': [
        ('table', 'users'), ('table', 'prediction_rooms'), ('table', 'activity_events'),
        ('table', 'admin_users'), ('table', 'credit_ledger'), ('table', 'reward_ledger_entries'),
    ],
    '20260713000000_admin_portal_beta': [
        ('column', 'activity_events.room_id'), ('column', 'activity_events.category'),
        ('column', 'activity_events.platform'), ('column', 'activity_events.session_id'),
        ('column', 'activity_events.event_version'), ('column', 'reports.priority'),
        ('column', 'reports.assigned_admin_id'), ('table', 'user_feedback'),
        ('index', 'activity_events_room_id_idx'), ('index', 'user_feedback_status_idx'),
        ('constraint', 'reports_assigned_admin_id_fkey'), ('constraint', 'user_feedback_user_id_fkey'),
    ],
    '20260714000000_room_checkpoints': [
        ('table', 'room_checkpoints'), ('index', 'room_checkpoints_room_id_checkpoint_key'),
        ('constraint', 'room_checkpoints_room_id_fkey'),
    ],
    '20260719000000_add_oracle_result_column': [('column', 'prediction_rooms.oracle_result')],
    '20260719000001_add_milestone_prediction_checkpoint_fields': [
        ('column', 'milestone_predictions.aura_eligible'), ('column', 'milestone_predictions.locked_checkpoint'),
    ],
    '20260725000000_room_checkpoint_eta_columns': [
        ('column', 'room_checkpoints.eta_seconds'), ('column', 'room_checkpoints.source'),
    ],
    '20260725130000_travel_eta_overhaul': [
        ('column', 'prediction_rooms.predictions_locked_at'), ('column', 'prediction_rooms.revealed_at'),
        ('column', 'milestone_predictions.hot_take'), ('table', 'room_milestone_snapshots'),
        ('table', 'invite_forwards'), ('index', 'invite_forwards_room_id_joined_guest_user_id_key'),
        ('constraint', 'invite_forwards_joined_guest_user_id_fkey'),
    ],
}

def scrub(text):
    text = re.sub(r'postgresql://[^@\s]+@', 'postgresql://***@', text or '')
    return re.sub(r'POSTGRES_PASSWORD=\S+', 'POSTGRES_PASSWORD=***', text)

def write_evidence(path, text):
    path.write_text('\n'.join(line.rstrip() for line in scrub(text).rstrip().splitlines()) + '\n')

env_lines = subprocess.check_output(
    ['docker', 'inspect', container, '--format', '{{range .Config.Env}}{{println .}}{{end}}'], text=True)
settings = dict(line.split('=', 1) for line in env_lines.splitlines() if '=' in line)
assert settings['POSTGRES_USER'] == 'predikt_ui'

def psql(db, sql, tuples=False):
    cmd = ['docker', 'exec', '-i', container, 'psql', '-X']
    if tuples:
        cmd.extend(['-t', '-A'])
    cmd.extend(['-v', 'ON_ERROR_STOP=1', '-U', 'predikt_ui', '-d', db])
    return subprocess.run(cmd, input=sql, text=True, capture_output=True)

def create_db(name):
    assert name.startswith('predikt_baseline_')
    made = psql('postgres', f'CREATE DATABASE "{name}";')
    if made.returncode:
        raise RuntimeError(scrub(made.stderr))

def counts(db):
    result = psql(db, """
    SELECT json_build_object(
      'users', (SELECT count(*) FROM users),
      'rooms', (SELECT count(*) FROM prediction_rooms),
      'predictions', (SELECT count(*) FROM milestone_predictions),
      'credits', (SELECT count(*) FROM credit_ledger),
      'reward_rows', (SELECT count(*) FROM reward_ledger_entries),
      'credit_balance', (SELECT COALESCE(sum(credit_balance),0) FROM users),
      'clout_balance', (SELECT COALESCE(sum(clout_balance),0) FROM users),
      'aura_balance', (SELECT COALESCE(sum(total_aura),0) FROM users),
      'ledger_amount', (SELECT COALESCE(sum(amount),0) FROM reward_ledger_entries)
    );""", tuples=True)
    if result.returncode:
        raise RuntimeError(scrub(result.stderr))
    return json.loads(result.stdout.strip())

def history_rows(db):
    present = psql(db, "SELECT to_regclass('public._prisma_migrations') IS NOT NULL;", tuples=True)
    if present.returncode:
        raise RuntimeError(scrub(present.stderr))
    if present.stdout.strip() != 't':
        return []
    rows = psql(db, """
    SELECT migration_name || ' finished=' || (finished_at IS NOT NULL)::text
      || ' not_rolled_back=' || (rolled_back_at IS NULL)::text
      || ' steps=' || applied_steps_count
    FROM _prisma_migrations ORDER BY migration_name;""", tuples=True)
    if rows.returncode:
        raise RuntimeError(scrub(rows.stderr))
    return [line for line in rows.stdout.splitlines() if line.strip()]

def prisma(args, database):
    env = os.environ.copy()
    env['DATABASE_URL'] = f"postgresql://predikt_ui:{settings['POSTGRES_PASSWORD']}@127.0.0.1:55444/{database}"
    assert '127.0.0.1' in env['DATABASE_URL']
    result = subprocess.run(
        ['node', 'node_modules/prisma/build/index.js', *args, '--schema', 'prisma/schema.prisma'],
        cwd=backend, env=env, capture_output=True, text=True)
    return result

def schema_diff_empty(database):
    env = os.environ.copy()
    env['DATABASE_URL'] = f"postgresql://predikt_ui:{settings['POSTGRES_PASSWORD']}@127.0.0.1:55444/{database}"
    result = subprocess.run(
        ['node', 'node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-url', env['DATABASE_URL'],
         '--to-schema-datamodel', 'prisma/schema.prisma', '--script'],
        cwd=backend, env=env, capture_output=True, text=True)
    return result.returncode == 0 and result.stdout.strip() in ('', '-- This is an empty migration.'), result.stdout + result.stderr

def object_exists(db, kind, name):
    if kind == 'table':
        sql = f"SELECT to_regclass('public.{name}') IS NOT NULL;"
    elif kind == 'column':
        table, column = name.split('.')
        sql = ("SELECT EXISTS (SELECT 1 FROM information_schema.columns "
               f"WHERE table_schema='public' AND table_name='{table}' AND column_name='{column}');")
    elif kind == 'index':
        sql = f"SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='{name}');"
    elif kind == 'constraint':
        sql = f"SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='{name}');"
    else:
        raise RuntimeError(kind)
    result = psql(db, sql, tuples=True)
    if result.returncode:
        raise RuntimeError(scrub(result.stderr))
    return result.stdout.strip() == 't'

def verify_effects(db):
    missing = []
    for migration, objects in checks.items():
        for kind, name in objects:
            if not object_exists(db, kind, name):
                missing.append(f'{migration}: {kind} {name}')
    return missing

checksums = {path.parent.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in migrations}
for name, digest in expected_six.items():
    if checksums.get(name) != digest:
        raise SystemExit(f'refusing to continue; historical migration changed: {name}')
if checksums.get('20260712000000_inferred_prerequisites') != 'f38c4740c88c18819d207f2a103ead4f358e6742ae5982a05497735ed9226005':
    raise SystemExit('baseline file is not the reviewed candidate SQL')

stamp = str(int(time.time()))
report = {
    'provenance': 'Local disposable predikt_ui on predikt_ui_acceptance_pg, loopback port 55444. Cloned with pg_dump for the existing-schema fixture. Not a production or Neon snapshot. Prior recovery fixtures may be included in its rows.',
    'method': 'Fresh: migrate deploy executes SQL. Existing: per-migration catalog checks, then prisma migrate resolve --applied, then migrate deploy. No manual _prisma_migrations insert.',
    'checksums': checksums,
}

fresh = f'predikt_baseline_fresh_{stamp}'
create_db(fresh)
first = prisma(['migrate', 'deploy'], fresh)
write_evidence(out / 'baseline-fresh-deploy.txt', first.stdout + first.stderr)
if first.returncode:
    raise SystemExit('fresh deploy failed')
fresh_diff, fresh_diff_text = schema_diff_empty(fresh)
write_evidence(out / 'baseline-fresh-schema-diff.sql', fresh_diff_text)
fixture = """
INSERT INTO users (user_id, name, clout_balance, credit_balance, total_aura, updated_at)
VALUES ('baseline-user', 'Baseline fixture user', 40, 15, 5, CURRENT_TIMESTAMP);
INSERT INTO credit_ledger (credit_ledger_id, user_id, event_type, delta, balance_after, idempotency_key)
VALUES ('baseline-credit', 'baseline-user', 'result_declared', 15, 15, 'baseline-fixture:credit');
INSERT INTO reward_accounts (reward_account_id, user_id, aura_balance, gem_balance, updated_at)
VALUES ('baseline-account', 'baseline-user', 5, 0, CURRENT_TIMESTAMP);
INSERT INTO reward_ledger_entries (reward_ledger_entry_id, user_id, reward_type, amount, balance_after, reason_code, idempotency_key)
VALUES ('baseline-ledger', 'baseline-user', 'AURA', 5, 5, 'AURA_MILESTONE_SCORE', 'baseline-fixture:aura');
"""
inserted = psql(fresh, fixture)
if inserted.returncode:
    raise RuntimeError(scrub(inserted.stderr[-1500:]))
before_redeploy = counts(fresh)
second = prisma(['migrate', 'deploy'], fresh)
write_evidence(out / 'baseline-fresh-redeploy.txt', second.stdout + second.stderr)
report['fresh'] = {
    'database': fresh,
    'deploy': 'PASS' if first.returncode == 0 else 'FAIL',
    'redeploy': 'PASS' if second.returncode == 0 and 'No pending migrations' in (second.stdout + second.stderr) else 'FAIL',
    'schemaDiffEmpty': fresh_diff,
    'effectsPresent': verify_effects(fresh) == [],
    'history': history_rows(fresh),
    'countsBeforeRedeploy': before_redeploy,
    'countsAfterRedeploy': counts(fresh),
}

existing = f'predikt_baseline_existing_{stamp}'
create_db(existing)
dump = subprocess.run(
    ['docker', 'exec', container, 'pg_dump', '-U', 'predikt_ui', '--no-owner', '--no-acl', 'predikt_ui'],
    capture_output=True, text=True, check=True)
restored = psql(existing, dump.stdout)
if restored.returncode:
    raise RuntimeError(scrub(restored.stderr[-2000:]))
before = counts(existing)
existing_diff, existing_diff_text = schema_diff_empty(existing)
write_evidence(out / 'baseline-existing-schema-diff.sql', existing_diff_text)
if not existing_diff:
    raise SystemExit('existing fixture does not match the datamodel; resolve refused')
missing = verify_effects(existing)
if missing:
    write_evidence(out / 'baseline-existing-missing.txt', '\n'.join(missing))
    raise SystemExit('catalog checks failed; no migration was marked applied')
refused = prisma(['migrate', 'deploy'], existing)
write_evidence(out / 'baseline-existing-p3005.txt', refused.stdout + refused.stderr)
if 'P3005' not in refused.stdout + refused.stderr or history_rows(existing):
    raise SystemExit('expected P3005 before baseline and no history rows')
if counts(existing) != before:
    raise SystemExit('P3005 attempt changed data')
resolved = []
for name in checks:
    result = prisma(['migrate', 'resolve', '--applied', name], existing)
    resolved.append(scrub(result.stdout + result.stderr))
    if result.returncode:
        write_evidence(out / 'baseline-existing-resolve.txt', '\n'.join(resolved))
        raise SystemExit(f'resolve failed for {name}; deploy was not run')
write_evidence(out / 'baseline-existing-resolve.txt', '\n'.join(resolved))
deployed = prisma(['migrate', 'deploy'], existing)
write_evidence(out / 'baseline-existing-deploy.txt', deployed.stdout + deployed.stderr)
redeployed = prisma(['migrate', 'deploy'], existing)
write_evidence(out / 'baseline-existing-redeploy.txt', redeployed.stdout + redeployed.stderr)
after = counts(existing)
final_diff, _ = schema_diff_empty(existing)
report['existing'] = {
    'database': existing,
    'source': 'pg_dump of local predikt_ui',
    'countsBefore': before,
    'p3005BeforeResolve': 'P3005' in (refused.stdout + refused.stderr),
    'catalogChecks': 'PASS',
    'resolve': 'PASS',
    'deploy': 'PASS' if deployed.returncode == 0 else 'FAIL',
    'redeploy': 'PASS' if redeployed.returncode == 0 and 'No pending migrations' in (redeployed.stdout + redeployed.stderr) else 'FAIL',
    'schemaDiffEmptyAfter': final_diff,
    'countsAfter': after,
    'dataPreserved': before == after,
    'history': history_rows(existing),
}
write_evidence(out / 'baseline-rehearsal.json', json.dumps(report, indent=2))
print(json.dumps({'fresh': report['fresh'], 'existing': {k: report['existing'][k] for k in report['existing'] if k != 'history'}}, indent=2))
ok = (
    report['fresh']['deploy'] == 'PASS' and report['fresh']['redeploy'] == 'PASS'
    and report['fresh']['schemaDiffEmpty'] and report['fresh']['effectsPresent']
    and report['fresh']['countsBeforeRedeploy'] == report['fresh']['countsAfterRedeploy']
    and len(report['fresh']['history']) == 7
    and report['existing']['deploy'] == 'PASS' and report['existing']['redeploy'] == 'PASS'
    and report['existing']['dataPreserved'] and report['existing']['schemaDiffEmptyAfter']
    and len(report['existing']['history']) == 7
)
if not ok:
    raise SystemExit(1)
