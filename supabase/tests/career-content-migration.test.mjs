import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { careerDb, migration } from './career-db.mjs';
const db = await careerDb();
try {
  await migration(db, '0017_career_content_evidence.sql');
  const baseline = JSON.parse(
    await readFile(new URL('./fixtures/career-seed-baseline.json', import.meta.url), 'utf8')
  );
  assert.deepEqual(
    (
      await db.query(
        'select id,md5(public.career_content_snapshot(c)::text) hash from careers c order by id'
      )
    ).rows,
    baseline
  );
  const original = (await db.query('select id,name,slug from careers order by id')).rows;
  const mappings = (await db.query('select * from career_courses order by career_id,course_id'))
    .rows;
  const edited = 'b0000000-0000-4000-8000-000000000003';
  await db.query(
    "update career_pathway_stages set stage_description='Administrator reviewed bespoke route' where career_id=$1 and from_education_level='spm' and stage_order=2",
    [edited]
  );
  const before = (
    await db.query('select public.career_content_snapshot(c) snapshot from careers c where id=$1', [
      edited,
    ])
  ).rows[0].snapshot;
  await migration(db, '0018_reviewed_career_content.sql');
  assert.deepEqual((await db.query('select id,name,slug from careers order by id')).rows, original);
  assert.deepEqual(
    (await db.query('select * from career_courses order by career_id,course_id')).rows,
    mappings
  );
  assert.deepEqual(
    (
      await db.query(
        'select public.career_content_snapshot(c) snapshot from careers c where id=$1',
        [edited]
      )
    ).rows[0].snapshot,
    before
  );
  assert.equal(
    (
      await db.query('select status from career_content_migration_outcomes where career_id=$1', [
        edited,
      ])
    ).rows[0].status,
    'skipped'
  );
  const actual = (
    await db.query(
      'select name,riasec_profile,content_review,reference_occupations from careers order by id'
    )
  ).rows;
  const expected = {
    'Medical Doctor': null,
    Pharmacist: 'ISC',
    'Civil Engineer': 'RIC',
    'Software Engineer': 'IC',
    'Data Scientist': 'IC',
    Architect: 'RCA',
    'Graphic Designer': 'AC',
    'Multimedia Designer': null,
    Nurse: 'SCI',
    Accountant: 'CEI',
    'Secondary School Teacher': 'S',
    'Cybersecurity Analyst': 'CI',
    'Data Analyst': null,
  };
  for (const row of actual.filter((r) => r.name !== 'Biomedical Scientist')) {
    assert.equal(row.riasec_profile, expected[row.name]);
    assert.notEqual(row.content_review.status, 'pending');
    assert.ok(row.reference_occupations.length);
  }
  assert.equal(actual.find((r) => r.name === 'Accountant').content_review.status, 'limited');
  const count = (await db.query('select count(*)::int n from career_content_migration_backups'))
    .rows[0].n;
  assert.equal(count, 14);
  await migration(db, '0018_reviewed_career_content.sql');
  assert.equal(
    (await db.query('select count(*)::int n from career_content_migration_backups')).rows[0].n,
    count
  );
  const software = 'b0000000-0000-4000-8000-000000000005';
  await db.query("update careers set description='New administrator wording' where id=$1", [
    software,
  ]);
  await migration(db, '0018_reviewed_career_content.sql');
  const c = (
    await db.query('select description,content_review from careers where id=$1', [software])
  ).rows[0];
  assert.equal(c.description, 'New administrator wording');
  assert.equal(c.content_review.status, 'pending');
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from career_content_migration_backups'));
  await db.exec('reset role');
  console.log(
    'PASS sourced correction: profiles, IDs, mappings, custom-stage guard, backups, reapply and private outcomes'
  );
} catch (error) {
  console.error('FAIL', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
const fresh = await careerDb();
try {
  await migration(fresh, '0017_career_content_evidence.sql');
  await migration(fresh, '0018_reviewed_career_content.sql');
  const outcomes = (await fresh.query('select status from career_content_migration_outcomes')).rows;
  assert.equal(outcomes.length, 14);
  assert.ok(outcomes.every((r) => r.status === 'updated'));
  const biomedical = (
    await fresh.query(
      "select riasec_profile,content_review,reference_occupations from careers where name='Biomedical Scientist'"
    )
  ).rows[0];
  assert.equal(biomedical.riasec_profile, null);
  assert.equal(biomedical.content_review.status, 'limited');
  assert.ok(biomedical.content_review.limitations.length);
  assert.equal(biomedical.reference_occupations.length, 2);
  const doctor = (
    await fresh.query("select content_review from careers where name='Medical Doctor'")
  ).rows[0];
  assert.ok(
    Object.values(doctor.content_review.sections).some((s) =>
      s.sources.some((source) => source.effective_on === '2027-01-01')
    )
  );
  console.log(
    'PASS fresh correction: all 14 updated, biomedical uncertainty and future-effective medical source retained'
  );
} catch (error) {
  console.error('FAIL fresh correction', error.message);
  process.exitCode = 1;
} finally {
  await fresh.close();
}
const guarded = await careerDb();
try {
  await migration(guarded, '0017_career_content_evidence.sql');
  const modifiedId = 'b0000000-0000-4000-8000-000000000005';
  const missingId = 'b0000000-0000-4000-8000-000000000014';
  await guarded.query("update careers set description='Custom pre-migration wording' where id=$1", [
    modifiedId,
  ]);
  await guarded.query('delete from careers where id=$1', [missingId]);
  await migration(guarded, '0018_reviewed_career_content.sql');
  const modified = (
    await guarded.query('select description,content_review from careers where id=$1', [modifiedId])
  ).rows[0];
  assert.equal(modified.description, 'Custom pre-migration wording');
  assert.equal(modified.content_review.status, 'pending');
  assert.equal(
    (
      await guarded.query(
        'select status from career_content_migration_outcomes where career_id=$1',
        [modifiedId]
      )
    ).rows[0].status,
    'skipped'
  );
  assert.equal(
    (
      await guarded.query(
        'select status from career_content_migration_outcomes where career_id=$1',
        [missingId]
      )
    ).rows[0].status,
    'missing'
  );
  assert.equal(
    (await guarded.query('select id from careers where id=$1', [missingId])).rows.length,
    0
  );
  console.log(
    'PASS guarded correction: edited career retained and missing career reported without replacement'
  );
} catch (error) {
  console.error('FAIL guarded correction', error.message);
  process.exitCode = 1;
} finally {
  await guarded.close();
}
