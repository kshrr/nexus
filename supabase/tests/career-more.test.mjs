import assert from 'node:assert/strict';
import { careerDb, migration } from './career-db.mjs';

// 0035 adds six careers with the same evidence structure as the 0019 Malaysian content.
const db = await careerDb();
try {
  for (const name of [
    '0017_career_content_evidence.sql',
    '0018_reviewed_career_content.sql',
    '0019_malaysian_career_content.sql',
  ])
    await migration(db, name);
  const before = (await db.query('select count(*)::int n from careers')).rows[0].n;
  await migration(db, '0035_more_careers.sql');
  const added = (
    await db.query(
      "select * from careers where slug in ('mechanical-engineer','electrical-engineer','lawyer','psychologist','chef','physiotherapist') order by slug"
    )
  ).rows;
  assert.equal(added.length, 6);
  assert.equal((await db.query('select count(*)::int n from careers')).rows[0].n, before + 6);
  for (const c of added) {
    assert.ok(c.is_active, `${c.name} is active`);
    assert.ok(
      c.description.length > 40 && c.description.length < 220,
      `${c.name}: short description`
    );
    assert.equal(c.responsibilities.length, 3, `${c.name}: three duties`);
    assert.ok(c.required_skills.length >= 4, `${c.name}: skills`);
    for (const section of ['overview', 'responsibilities', 'skills', 'subjects', 'study_options']) {
      const review = c.content_review.sections[section];
      assert.ok(review.sources.length, `${c.name}: ${section} cites a source`);
      assert.ok(
        review.sources.every((s) => s.jurisdiction === 'Malaysia'),
        `${c.name}: ${section} uses Malaysian sources only`
      );
    }
    const interests = c.content_review.sections.interests;
    assert.deepEqual(
      interests.sources.map((s) => s.publisher),
      ['O*NET OnLine'],
      `${c.name}: O*NET only for interests`
    );
    assert.equal(c.reference_occupations[0].interest_code, c.riasec_profile);
    assert.equal(c.reference_occupations[0].interest_source_id, interests.sources[0].source_id);
  }
  const bySlug = Object.fromEntries(added.map((c) => [c.slug, c]));
  // Routes that could not be fully checked say so.
  for (const slug of ['lawyer', 'psychologist', 'physiotherapist']) {
    assert.equal(bySlug[slug].content_review.status, 'limited');
    assert.ok(bySlug[slug].content_review.sections.study_options.limitations.length);
  }
  assert.equal(bySlug['mechanical-engineer'].content_review.status, 'source_checked');
  assert.equal(bySlug.psychologist.riasec_profile, 'SI');
  assert.ok(!bySlug.psychologist.required_skills.some((s) => /prescri/i.test(s)));

  // Replaying the migration, or an administrator-created career with one of the slugs,
  // is left untouched.
  await db.query("update careers set description='Admin wording for chefs' where slug='chef'");
  await migration(db, '0035_more_careers.sql');
  assert.equal((await db.query('select count(*)::int n from careers')).rows[0].n, before + 6);
  assert.equal(
    (await db.query("select description from careers where slug='chef'")).rows[0].description,
    'Admin wording for chefs'
  );
  console.log('Six more careers carry Malaysian sources, O*NET interests only, and replay safely.');
} finally {
  await db.close();
}
