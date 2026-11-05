import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { careerDb, migration, migrationPath } from './career-db.mjs';

const name = '0019_malaysian_career_content.sql';
const key = '0019-malaysian-career-content';
const db = await careerDb();
try {
  await migration(db, '0017_career_content_evidence.sql');
  await migration(db, '0018_reviewed_career_content.sql');
  const original = (
    await db.query(
      'select id,name,slug,riasec_profile,reference_occupations from careers order by id'
    )
  ).rows;
  const mappings = (await db.query('select * from career_courses order by career_id,course_id'))
    .rows;
  const originals = (
    await db.query(`select id,to_jsonb(c) career_record,
    (select jsonb_agg(to_jsonb(s) order by s.from_education_level,s.stage_order)
     from career_pathway_stages s where s.career_id=c.id) stage_records from careers c order by id`)
  ).rows;
  // Before the new migration exists this runs the current content, exposing its U.S. sources.
  if ((await readdir(migrationPath)).includes(name)) await migration(db, name);
  const rows = (await db.query('select * from careers order by id')).rows;
  for (const c of rows) {
    for (const section of ['overview', 'responsibilities', 'skills', 'subjects', 'study_options']) {
      const r = c.content_review.sections[section];
      assert.ok(r.sources.length, `${c.name}: ${section} needs Malaysian evidence`);
      assert.ok(
        r.sources.every((s) => s.jurisdiction === 'Malaysia'),
        `${c.name}: ${section} still uses foreign occupational content`
      );
      assert.ok(r.sources.every((s) => !s.url.includes('onetonline.org')));
    }
    assert.ok(
      c.content_review.sections.interests.sources.every((s) => s.publisher === 'O*NET OnLine')
    );
    assert.equal(c.content_review.sections.interests.checked_on, '2026-10-13');
    assert.equal(c.content_review.sections.overview.checked_on, '2026-10-15');
    assert.equal(c.content_review.checked_on, '2026-10-15');
  }
  assert.deepEqual(
    (
      await db.query(
        'select id,name,slug,riasec_profile,reference_occupations from careers order by id'
      )
    ).rows,
    original
  );
  assert.deepEqual(
    (await db.query('select * from career_courses order by career_id,course_id')).rows,
    mappings
  );
  const stages = (await db.query('select * from career_pathway_stages')).rows;
  assert.ok(
    stages.every((s) =>
      s.content_review.sources.every((source) => source.jurisdiction === 'Malaysia')
    )
  );
  const software = rows.find((c) => c.name === 'Software Engineer');
  const starts = stages.filter((s) => s.career_id === software.id && s.stage_order === 1);
  assert.equal(new Set(starts.map((s) => s.stage_description)).size, 6);
  assert.match(
    starts.find((s) => s.from_education_level === 'spm').stage_description,
    /pre-university|foundation|diploma/i
  );
  assert.match(
    starts.find((s) => s.from_education_level === 'diploma').stage_description,
    /credit transfer/i
  );
  assert.ok(rows.find((c) => c.name === 'Biomedical Scientist').content_review.limitations.length);
  assert.ok(
    rows
      .find((c) => c.name === 'Medical Doctor')
      .content_review.sections.study_options.sources.some((s) => s.effective_on === '2027-01-01')
  );
  const outcomes = (
    await db.query('select status from career_content_migration_outcomes where migration_key=$1', [
      key,
    ])
  ).rows;
  assert.equal(outcomes.length, 14);
  assert.ok(outcomes.every((r) => r.status === 'updated'));
  const beforeReplay = (
    await db.query('select public.career_reviewed_snapshot(c) snapshot from careers c order by id')
  ).rows;
  await migration(db, name);
  assert.deepEqual(
    (
      await db.query(
        'select public.career_reviewed_snapshot(c) snapshot from careers c order by id'
      )
    ).rows,
    beforeReplay
  );
  assert.equal(
    (
      await db.query(
        'select count(*)::int n from career_content_migration_backups where migration_key=$1',
        [key]
      )
    ).rows[0].n,
    14
  );
  const backups = (
    await db.query(
      'select career_id,career_record,stage_records from career_content_migration_backups where migration_key=$1 order by career_id',
      [key]
    )
  ).rows;
  assert.deepEqual(
    backups,
    originals.map(({ id, ...saved }) => ({ career_id: id, ...saved }))
  );
  // Replaying after a localised row or stage is edited must never re-certify or overwrite it.
  const civil = rows.find((c) => c.name === 'Civil Engineer');
  await db.query(
    "update careers set description='Administrator update after localisation' where id=$1",
    [software.id]
  );
  await db.query(
    "update career_pathway_stages set stage_title='Custom localised stage' where career_id=$1 and stage_order=1",
    [civil.id]
  );
  await migration(db, name);
  const edited = (
    await db.query('select description,content_review from careers where id=$1', [software.id])
  ).rows[0];
  assert.equal(edited.description, 'Administrator update after localisation');
  assert.equal(edited.content_review.status, 'pending');
  assert.equal(
    (
      await db.query(
        'select stage_title from career_pathway_stages where career_id=$1 and stage_order=1',
        [civil.id]
      )
    ).rows[0].stage_title,
    'Custom localised stage'
  );
  assert.ok(
    (
      await db.query(
        'select status from career_content_migration_outcomes where migration_key=$1 and career_id=any($2::uuid[])',
        [key, [software.id, civil.id]]
      )
    ).rows.every((r) => r.status === 'skipped')
  );
  assert.deepEqual(
    (
      await db.query(
        'select career_id,career_record,stage_records from career_content_migration_backups where migration_key=$1 order by career_id',
        [key]
      )
    ).rows,
    backups
  );
  console.log(
    'PASS Malaysian content: 14 careers, local evidence and routes, O*NET interests retained, IDs/mappings unchanged, replay safe'
  );
} catch (error) {
  console.error('FAIL Malaysian content:', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}

if ((await readdir(migrationPath)).includes(name)) {
  const guarded = await careerDb();
  try {
    await migration(guarded, '0017_career_content_evidence.sql');
    await migration(guarded, '0018_reviewed_career_content.sql');
    const custom = 'b0000000-0000-4000-8000-000000000005';
    const stageEdited = 'b0000000-0000-4000-8000-000000000004';
    const missing = 'b0000000-0000-4000-8000-000000000014';
    await guarded.query("update careers set description='Administrator content' where id=$1", [
      custom,
    ]);
    await guarded.query(
      "update career_pathway_stages set stage_title='Administrator stage' where career_id=$1 and stage_order=1",
      [stageEdited]
    );
    await guarded.query('delete from careers where id=$1', [missing]);
    await migration(guarded, name);
    assert.equal(
      (await guarded.query('select description from careers where id=$1', [custom])).rows[0]
        .description,
      'Administrator content'
    );
    assert.equal(
      (
        await guarded.query(
          'select stage_title from career_pathway_stages where career_id=$1 and stage_order=1',
          [stageEdited]
        )
      ).rows[0].stage_title,
      'Administrator stage'
    );
    const outcomes = (
      await guarded.query(
        'select career_id,status from career_content_migration_outcomes where migration_key=$1',
        [key]
      )
    ).rows;
    assert.equal(outcomes.find((o) => o.career_id === custom).status, 'skipped');
    assert.equal(outcomes.find((o) => o.career_id === stageEdited).status, 'skipped');
    assert.equal(outcomes.find((o) => o.career_id === missing).status, 'missing');
    assert.equal(
      (await guarded.query('select id from careers where id=$1', [missing])).rows.length,
      0
    );
    await guarded.exec('set role anon');
    await assert.rejects(guarded.query('select * from career_content_migration_backups'));
    await guarded.exec('reset role');
    console.log(
      'PASS Malaysian migration guards: custom career/stage preserved, absent career reported, private backups'
    );
  } catch (error) {
    console.error('FAIL Malaysian guards:', error.message);
    process.exitCode = 1;
  } finally {
    await guarded.close();
  }
}
