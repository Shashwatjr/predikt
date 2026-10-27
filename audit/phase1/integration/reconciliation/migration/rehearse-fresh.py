"""Local disposable rehearsal; never touches an existing DB or migration files/history.
Derives an INFERRED prerequisite snapshot, not proof of an historical deployed schema.
Requires the existing local predikt_ui_acceptance_pg test container and backend deps.
"""
import json, os, re, subprocess, hashlib, time, tempfile, shutil
from pathlib import Path
root=Path(__file__).resolve().parents[5]
out=Path(__file__).resolve().parent
def write_evidence(path,text):
 path.write_text('\n'.join(line.rstrip() for line in text.rstrip().splitlines())+'\n')
container='predikt_ui_acceptance_pg'
v=subprocess.check_output(['docker','inspect',container,'--format','{{range .Config.Env}}{{println .}}{{end}}'],text=True)
settings=dict(line.split('=',1) for line in v.splitlines() if '=' in line)
assert settings['POSTGRES_USER']=='predikt_ui'
def psql(db,sql):
 return subprocess.run(['docker','exec','-i',container,'psql','-X','-v','ON_ERROR_STOP=1','-U','predikt_ui','-d',db],input=sql,text=True,capture_output=True,check=True).stdout
# No database input: DDL generated only from checked-in schema.
full=subprocess.check_output(['node','node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema-datamodel','prisma/schema.prisma','--script'],cwd=root/'backend',text=True)
removed_tables={'user_feedback','room_checkpoints','room_milestone_snapshots','invite_forwards'}
removed_columns={
 'activity_events':{'room_id','category','mode','session_id','event_version'},
 'reports':{'priority','assigned_admin_id'},
 'prediction_rooms':{'oracle_result','predictions_locked_at','revealed_at'},
 'milestone_predictions':{'aura_eligible','locked_checkpoint','hot_take'},
}
statements=[]
for part in full.split(';'):
 part=re.sub(r'^--[^\n]*\n','',part.strip(),flags=re.M).strip()
 if not part:continue
 if any('"'+t+'"' in part for t in removed_tables):continue
 match=re.search(r'^CREATE TABLE "([^"]+)"',part)
 if match:
  table=match.group(1);fields=removed_columns.get(table,set())
  lines=[line for line in part.splitlines() if not any(re.match(r'\s*"'+f+r'"\s',line) for f in fields)]
  part='\n'.join(lines);part=re.sub(r',\n\)',r'\n)',part)
 elif any('"'+t+'"' in part and any('"'+f+'"' in part for f in fields) for t,fields in removed_columns.items()):
  continue
 statements.append(part+';')
prereq='-- INFERRED LOCAL REHEARSAL ONLY. Review before any upgrade use.\n'+'\n\n'.join(statements)+'\n'
assert '_prisma_migrations' not in prereq
(out/'prerequisites-candidate.sql').write_text(prereq)
name='predikt_reconcile_test_'+str(int(time.time()))
# Create a new database only, never reset/drop an existing database.
psql('postgres',f'CREATE DATABASE "{name}";')
# Disposable candidate history only: no repository migrations changed and no
# preload that would trigger P3005. Prisma applies every step itself.
lab=Path(tempfile.mkdtemp(prefix='predikt-migration-rehearsal-'))
shutil.copy2(root/'backend/prisma/schema.prisma',lab/'schema.prisma')
shutil.copytree(root/'backend/prisma/migrations',lab/'migrations')
base=lab/'migrations/20260712000000_inferred_prerequisites';base.mkdir()
(base/'migration.sql').write_text(prereq)
env=os.environ.copy();env['DATABASE_URL']=f"postgresql://predikt_ui:{settings['POSTGRES_PASSWORD']}@127.0.0.1:55444/{name}"
r=subprocess.run(['node','node_modules/prisma/build/index.js','migrate','deploy','--schema',str(lab/'schema.prisma')],cwd=root/'backend',env=env,capture_output=True,text=True)
write_evidence(out/'deploy-result.txt',r.stdout+r.stderr)
if r.returncode:raise RuntimeError('Candidate fresh deploy failed; inspect deploy-result.txt (no history repair attempted)')
diff=subprocess.run(['node','node_modules/prisma/build/index.js','migrate','diff','--from-url',env['DATABASE_URL'],'--to-schema-datamodel','prisma/schema.prisma','--script'],cwd=root/'backend',env=env,capture_output=True,text=True,check=True)
write_evidence(out/'schema-diff.sql',diff.stdout)
history=psql(name,'SELECT migration_name,finished_at IS NOT NULL AS finished,rolled_back_at IS NULL AS not_rolled_back,applied_steps_count FROM _prisma_migrations ORDER BY migration_name;')
write_evidence(out/'history-readonly.txt',history)
checks={p.parent.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((root/'backend/prisma/migrations').glob('*/migration.sql'))}
(out/'rehearsal.json').write_text(json.dumps({'database':name,'strategy':'isolated candidate prerequisite migration then six unmodified migrations','deploy':'PASS','migrationChecksums':checks,'prerequisiteSha256':hashlib.sha256(prereq.encode()).hexdigest(),'schemaDiff':diff.stdout.strip()},indent=2)+'\n')
print('PASS: inferred prerequisites + six unmodified migrations; review remaining schema diff; DB retained: '+name)
