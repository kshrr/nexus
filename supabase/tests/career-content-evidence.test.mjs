import assert from 'node:assert/strict';
import { careerDb, migration, review, section, refs } from './career-db.mjs';
const db = await careerDb();
try {
  await migration(db, '0017_career_content_evidence.sql');
  const id = 'b0000000-0000-4000-8000-000000000005';
  for (const code of ['S', 'IC', 'CI', null])
    await db.query('update careers set riasec_profile=$1 where id=$2', [code, id]);
  for (const code of ['II', 'XYZ', '', 'ic'])
    await assert.rejects(db.query('update careers set riasec_profile=$1 where id=$2', [code, id]));
  await db.query('update careers set reference_occupations=$1,content_review=$2 where id=$3', [
    JSON.stringify(refs),
    JSON.stringify(review),
    id,
  ]);
  // Content/evidence changes first invalidate; explicit second review stamps unchanged content.
  await db.query('update careers set content_review=$1 where id=$2', [JSON.stringify(review), id]);
  await db.query('update career_pathway_stages set content_review=$1 where career_id=$2', [
    JSON.stringify(section),
    id,
  ]);
  assert.equal(
    (await db.query('select content_review from careers where id=$1', [id])).rows[0].content_review
      .status,
    'source_checked'
  );
  await db.query('update careers set description=description, is_active=false where id=$1', [id]);
  assert.equal(
    (await db.query('select content_review from careers where id=$1', [id])).rows[0].content_review
      .status,
    'source_checked'
  );
  await db.query('update careers set description=$1,content_review=$2 where id=$3', [
    'Edited wording',
    JSON.stringify(review),
    id,
  ]);
  const r = (await db.query('select content_review from careers where id=$1', [id])).rows[0]
    .content_review;
  assert.equal(r.status, 'pending');
  assert.equal(r.checked_on, null);
  assert.equal(r.sections.interests.status, 'pending');
  assert.ok(
    (
      await db.query('select content_review from career_pathway_stages where career_id=$1', [id])
    ).rows.every((r) => r.content_review.status === 'pending')
  );
  const altered = structuredClone(review);
  altered.sections.interests.sources[0].scope = 'Changed supporting claim';
  await db.query('update careers set content_review=$1 where id=$2', [JSON.stringify(altered), id]);
  assert.equal(
    (await db.query('select content_review from careers where id=$1', [id])).rows[0].content_review
      .status,
    'pending'
  );
  await db.query('update careers set content_review=$1 where id=$2', [JSON.stringify(altered), id]);
  assert.equal(
    (await db.query('select content_review from careers where id=$1', [id])).rows[0].content_review
      .status,
    'source_checked'
  );
  for (const metadata of [
    [],
    { status: 'source_checked' },
    { ...review, checked_on: '2026-02-30' },
  ])
    await assert.rejects(
      db.query('update careers set content_review=$1 where id=$2', [JSON.stringify(metadata), id])
    );
  const bad = structuredClone(review);
  bad.sections.overview.sources[0].url = 'https://user:password@example.com';
  await assert.rejects(
    db.query('update careers set content_review=$1 where id=$2', [JSON.stringify(bad), id])
  );
  const created = (
    await db.query(
      "insert into careers(name,field,description) values('New pending career','Science','Draft') returning id,slug,content_review"
    )
  ).rows[0];
  assert.equal(created.slug, 'new-pending-career');
  assert.equal(created.content_review.status, 'pending');
  assert.equal(
    (
      await db.query('select count(*)::int n from career_pathway_stages where career_id=$1', [
        created.id,
      ])
    ).rows[0].n,
    0
  );
  await db.exec('set role anon');
  await assert.rejects(db.query("update careers set description='unauthorised' where id=$1", [id]));
  await db.exec('reset role');
  console.log(
    'PASS career evidence: valid codes, review invalidation, safe metadata, pending starters and RLS'
  );
} finally {
  await db.close();
}
