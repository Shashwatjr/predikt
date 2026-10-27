"""Local upgrade rehearsal. Never edits migration files, stamps history, or writes predikt_ui.

Creates only new databases on the loopback predikt_ui_acceptance_pg container.
"""
import hashlib, json, os, re, subprocess, time
from pathlib import Path

root = Path(__file__).resolve().parents[5]
out = Path(__file__).resolve().parent
backend = root / 'backend'
container = 'predikt_ui_acceptance_pg'
migrations = sorted((backend / 'prisma/migrations').glob('*/migration.sql'))
candidate = out / 'prerequisites-candidate.sql'

def scrub(text):
    text = re.sub(r'postgresql://[^@\s]+@', 'postgresql://***@', text)
    text = re.sub(r'POSTGRES_PASSWORD=\S+', 'POSTGRES_PASSWORD=***', text)
    return text

def write_evidence(path, text):
    path.write_text('\n'.join(line.rstrip() for line in scrub(text).rstrip().splitlines()) + '\n')

env_lines = subprocess.check_output(
    ['docker', 'inspect', container, '--format', '{{range .Config.Env}}{{println .}}{{end}}'], text=True)
settings = dict(line.split('=', 1) for line in env_lines.splitlines() if '=' in line)
assert settings['POSTGRES_USER'] == 'predikt_ui'

def psql(db, sql, single_transaction=False, tuples=False):
    cmd = ['docker', 'exec', '-i', container, 'psql', '-X']
    if tuples:
        cmd.extend(['-t', '-A'])
    if single_transaction:
        cmd.append('-1')
    cmd.extend(['-v', 'ON_ERROR_STOP=1', '-U', 'predikt_ui', '-d', db])
    return subprocess.run(cmd, input=sql, text=True, capture_output=True)

def psql_file(db, path, single_transaction=False):
    return psql(db, path.read_text(), single_transaction)

def create_db(name):
    made = psql('postgres', f'CREATE DATABASE "{name}";')
    if made.returncode:
        raise RuntimeError(scrub(made.stderr))

def counts(db):
    sql = """
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
    );
    """
    result = psql(db, sql, tuples=True)
    if result.returncode:
        raise RuntimeError(scrub(result.stderr))
    return json.loads(result.stdout.strip())

def history_present(db):
    result = psql(db, "SELECT to_regclass('public._prisma_migrations') IS NOT NULL;", tuples=True)
    if result.returncode:
        raise RuntimeError(scrub(result.stderr))
    return result.stdout.strip() == 't'

def column_present(db, table, column):
    result = psql(db, f"SELECT COUNT(*) FROM information_schema.columns WHERE table_name='{table}' AND column_name='{column}';", tuples=True)
    if result.returncode:
        raise RuntimeError(scrub(result.stderr))
    return result.stdout.strip() == '1'

stamp = str(int(time.time()))
report = {
    'source': 'predikt_ui loopback clone plus a separate pre-delta fixture',
    'historyStamped': False,
    'migrationFilesEdited': False,
    'migrationChecksums': {path.parent.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in migrations},
    'candidateSha256': hashlib.sha256(candidate.read_bytes()).hexdigest(),
}

# Representative existing schema and data: copy, do not modify predikt_ui.
existing = f'predikt_upgrade_existing_{stamp}'
create_db(existing)
dump = subprocess.run(
    ['docker', 'exec', container, 'pg_dump', '-U', 'predikt_ui', '--no-owner', '--no-acl', 'predikt_ui'],
    capture_output=True, text=True, check=True)
restored = psql(existing, dump.stdout)
if restored.returncode:
    raise RuntimeError(scrub(restored.stderr[-2000:]))
before = counts(existing)
report['existing'] = {'database': existing, 'countsBefore': before, 'historyBefore': history_present(existing)}

diff_env = os.environ.copy()
diff_env['DATABASE_URL'] = f"postgresql://predikt_ui:{settings['POSTGRES_PASSWORD']}@127.0.0.1:55444/{existing}"
schema_diff = subprocess.run(
    ['node', 'node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-url', diff_env['DATABASE_URL'],
     '--to-schema-datamodel', 'prisma/schema.prisma', '--script'],
    cwd=backend, env=diff_env, capture_output=True, text=True)
write_evidence(out / 'upgrade-existing-schema-diff.sql', schema_diff.stdout + schema_diff.stderr)
report['existing']['schemaDiffEmpty'] = schema_diff.returncode == 0 and schema_diff.stdout.strip() in ('', '-- This is an empty migration.')

collision = psql_file(existing, candidate, single_transaction=True)
report['existing']['candidateCreateOnPopulatedDb'] = 'ROLLED_BACK' if collision.returncode else 'APPLIED_UNEXPECTEDLY'
report['existing']['countsAfterCandidateAttempt'] = counts(existing)
report['existing']['candidatePreservedData'] = report['existing']['countsAfterCandidateAttempt'] == before

deploy = subprocess.run(
    ['node', 'node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', str(backend / 'prisma/schema.prisma')],
    cwd=backend, env=diff_env, capture_output=True, text=True)
write_evidence(out / 'upgrade-existing-deploy.txt', deploy.stdout + deploy.stderr)
report['existing']['migrateDeployExit'] = deploy.returncode
report['existing']['migrateDeployRefused'] = 'P3005' in deploy.stdout + deploy.stderr
report['existing']['historyAfterRefusedDeploy'] = history_present(existing)
report['existing']['countsAfterRefusedDeploy'] = counts(existing)

probe = r'''
const {PrismaClient}=require("@prisma/client");
const db=new PrismaClient();
(async()=>{
  const before=await db.user.count();
  try {
    await db.$transaction(async (tx)=>{
      const user=await tx.user.create({data:{name:"Upgrade compatibility probe"}});
      const read=await tx.user.findUnique({where:{userId:user.userId}});
      if(!read || read.name!=="Upgrade compatibility probe") throw new Error("client readback failed");
      throw new Error("ROLLBACK_PROBE");
    });
  } catch (error) {
    if(!String(error.message||error).includes("ROLLBACK_PROBE")) throw error;
  }
  const after=await db.user.count();
  if(before!==after) throw new Error("probe changed user count");
  const room=await db.predictionRoom.findFirst({select:{roomId:true,status:true}});
  if(!room) throw new Error("client could not read a room");
  console.log(JSON.stringify({users:after, readRoom:true}));
  await db.$disconnect();
})().catch(async (error)=>{ console.error(String(error.message||error)); try{await db.$disconnect()}catch(e){} process.exit(1); });
'''
compat = subprocess.run(['node', '-e', probe], cwd=backend, env=diff_env, capture_output=True, text=True)
report['existing']['applicationCompatibility'] = 'PASS' if compat.returncode == 0 else scrub(compat.stderr[-500:])

# Pre-delta fixture: candidate schema, synthetic rows, then the six original files.
pre = f'predikt_upgrade_predelta_{stamp}'
create_db(pre)
loaded = psql_file(pre, candidate)
if loaded.returncode:
    raise RuntimeError(scrub(loaded.stderr[-2000:]))
fixture = """
INSERT INTO users (user_id, name, clout_balance, credit_balance, total_aura, updated_at)
VALUES ('upgrade-user', 'Upgrade fixture user', 40, 15, 5, CURRENT_TIMESTAMP);
INSERT INTO prediction_rooms (room_id, creator_user_id, room_title, event_type, starting_point_label, destination_label, invite_code, prediction_close_time, updated_at)
VALUES ('upgrade-room', 'upgrade-user', 'Upgrade fixture', 'arrival_time', 'Hidden', 'Hidden', 'upgrade-invite', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO room_milestones (milestone_id, room_id, milestone_order, milestone_name, updated_at)
VALUES ('upgrade-milestone', 'upgrade-room', 1, 'Destination', CURRENT_TIMESTAMP);
INSERT INTO milestone_predictions (prediction_id, milestone_id, room_id, user_id, predicted_reached_time)
VALUES ('upgrade-prediction', 'upgrade-milestone', 'upgrade-room', 'upgrade-user', CURRENT_TIMESTAMP);
INSERT INTO credit_ledger (credit_ledger_id, user_id, event_type, delta, balance_after, idempotency_key)
VALUES ('upgrade-credit', 'upgrade-user', 'result_declared', 15, 15, 'upgrade-fixture:credit');
INSERT INTO reward_accounts (reward_account_id, user_id, aura_balance, gem_balance, updated_at)
VALUES ('upgrade-account', 'upgrade-user', 5, 0, CURRENT_TIMESTAMP);
INSERT INTO reward_ledger_entries (reward_ledger_entry_id, user_id, reward_type, amount, balance_after, reason_code, idempotency_key)
VALUES ('upgrade-ledger', 'upgrade-user', 'AURA', 5, 5, 'AURA_MILESTONE_SCORE', 'upgrade-fixture:aura');
"""
inserted = psql(pre, fixture)
if inserted.returncode:
    raise RuntimeError(scrub(inserted.stderr[-2000:]))
pre_counts = counts(pre)
pre_dump = subprocess.run(
    ['docker', 'exec', container, 'pg_dump', '-U', 'predikt_ui', '--no-owner', '--no-acl', pre],
    capture_output=True, text=True, check=True).stdout
for path in migrations:
    applied = psql_file(pre, path)
    if applied.returncode:
        raise RuntimeError(path.parent.name + '\n' + scrub(applied.stderr[-2000:]))
post_counts = counts(pre)
report['preDelta'] = {
    'database': pre,
    'countsBeforeDeltas': pre_counts,
    'countsAfterSixOriginalMigrations': post_counts,
    'dataPreserved': pre_counts == post_counts,
    'oracleResultColumnAdded': column_present(pre, 'prediction_rooms', 'oracle_result'),
    'predictionCheckpointColumnAdded': column_present(pre, 'milestone_predictions', 'aura_eligible'),
    'historyPresent': history_present(pre),
}
pre_env = diff_env.copy()
pre_env['DATABASE_URL'] = f"postgresql://predikt_ui:{settings['POSTGRES_PASSWORD']}@127.0.0.1:55444/{pre}"
pre_diff = subprocess.run(
    ['node', 'node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-url', pre_env['DATABASE_URL'],
     '--to-schema-datamodel', 'prisma/schema.prisma', '--script'],
    cwd=backend, env=pre_env, capture_output=True, text=True)
report['preDelta']['schemaDiffEmpty'] = pre_diff.returncode == 0 and pre_diff.stdout.strip() in ('', '-- This is an empty migration.')
write_evidence(out / 'upgrade-predelta-schema-diff.sql', pre_diff.stdout + pre_diff.stderr)
pre_compat = subprocess.run(['node', '-e', probe], cwd=backend, env=pre_env, capture_output=True, text=True)
report['preDelta']['applicationCompatibility'] = 'PASS' if pre_compat.returncode == 0 else scrub(pre_compat.stderr[-500:])
replay = psql_file(pre, migrations[0], single_transaction=True)
report['preDelta']['reapplyFirstMigration'] = 'ROLLED_BACK' if replay.returncode else 'APPLIED_UNEXPECTEDLY'
report['preDelta']['countsAfterFailedReapply'] = counts(pre)
refused = subprocess.run(
    ['node', 'node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', str(backend / 'prisma/schema.prisma')],
    cwd=backend, env=pre_env, capture_output=True, text=True)
report['preDelta']['migrateDeployRefused'] = 'P3005' in refused.stdout + refused.stderr
report['preDelta']['historyAfterRefusedDeploy'] = history_present(pre)
marker = psql(pre, "INSERT INTO users (user_id, name, updated_at) VALUES ('upgrade-after', 'Post-upgrade write', CURRENT_TIMESTAMP);")
if marker.returncode:
    raise RuntimeError(scrub(marker.stderr[-1000:]))
restored_name = f'predikt_upgrade_restore_{stamp}'
create_db(restored_name)
restore = psql(restored_name, pre_dump)
if restore.returncode:
    raise RuntimeError(scrub(restore.stderr[-2000:]))
report['rollback'] = {
    'snapshotDatabase': restored_name,
    'postUpgradeWriteOnUpgradedDb': psql(pre, "SELECT COUNT(*) FROM users WHERE user_id='upgrade-after';", tuples=True).stdout.strip(),
    'postUpgradeWriteOnSnapshot': psql(restored_name, "SELECT COUNT(*) FROM users WHERE user_id='upgrade-after';", tuples=True).stdout.strip(),
    'fixtureUserOnSnapshot': psql(restored_name, "SELECT credit_balance FROM users WHERE user_id='upgrade-user';", tuples=True).stdout.strip(),
    'oracleResultOnSnapshot': column_present(restored_name, 'prediction_rooms', 'oracle_result'),
    'limit': 'No down migration exists. Restoring the pre-delta snapshot keeps fixture balances and drops writes made after it. Re-running an applied delta rolls back only when the attempt is one transaction. migrate deploy on either database was refused and no history row was inserted.',
}
write_evidence(out / 'upgrade-rehearsal.json', json.dumps(report, indent=2))
print(json.dumps({k: report[k] for k in ('existing', 'preDelta', 'rollback')}, indent=2))
if not all([
    report['existing']['schemaDiffEmpty'],
    report['existing']['candidatePreservedData'],
    report['existing']['migrateDeployRefused'],
    report['existing']['historyAfterRefusedDeploy'] is False,
    report['existing']['applicationCompatibility'] == 'PASS',
    report['preDelta']['dataPreserved'],
    report['preDelta']['schemaDiffEmpty'],
    report['preDelta']['applicationCompatibility'] == 'PASS',
    report['preDelta']['historyPresent'] is False,
    report['preDelta']['reapplyFirstMigration'] == 'ROLLED_BACK',
    report['rollback']['postUpgradeWriteOnSnapshot'] == '0',
    report['rollback']['fixtureUserOnSnapshot'] == '15',
]):
    raise SystemExit(1)
