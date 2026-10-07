// =============================================================================
// chat.test.mjs — database-side checks for the chatbot.
//
//   * rate limiting: 20 messages / hour / user (FR-SEC-04 / AC-41)
//   * the quota identifier comes from auth.uid() and cannot be forged
//   * rate_limit_events stays unreachable from the browser (§4.8)
//   * chat_messages is owner-scoped and constrained (§3.6)
//   * the 12-month retention job actually deletes (D-31)
//
//   node supabase/tests/chat.test.mjs
// =============================================================================
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', 'migrations');
const FILES = [
  '0002_core_tables.sql',
  '0003_reference_tables.sql',
  '0004_security_tables.sql',
  '0005_functions.sql',
  '0006_rls_policies.sql',
  '0007_seed_reference_data.sql',
  '0008_auth_consent.sql',
  '0009_seed_find_your_path.sql',
  '0010_scholarship_operations.sql',
  '0011_chat_rate_limit.sql',
];

const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass, detail });

async function reset(db) {
  await db.exec('reset role;');
  await db.query(`select set_config('request.jwt.claims', '', false)`);
}
async function asUser(db, uid) {
  await reset(db);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ sub: uid, role: 'authenticated' }),
  ]);
  await db.exec('set role authenticated;');
}
async function asAnon(db) {
  await reset(db);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ role: 'anon' }),
  ]);
  await db.exec('set role anon;');
}
async function expectReject(name, promise) {
  try {
    await promise;
    check(name, false, 'expected rejection, statement succeeded');
  } catch (e) {
    check(name, true, e.message.split('\n')[0]);
  }
}
async function expectOk(name, promise) {
  try {
    await promise;
    check(name, true);
  } catch (e) {
    check(name, false, `error: ${e.message.split('\n')[0]}`);
  }
}

const db = await new PGlite();
await db.exec(await readFile(join(HERE, 'auth-shim.sql'), 'utf8'));
for (const f of FILES) await db.exec(await readFile(join(MIGRATIONS, f), 'utf8'));
await db.exec(`grant all on all tables in schema public to service_role;`);

await reset(db);
const A = (
  await db.query(
    `insert into auth.users (email, raw_user_meta_data)
     values ('chat-a@test.nexus', '{"full_name":"Student A"}'::jsonb) returning id`
  )
).rows[0].id;
const B = (
  await db.query(
    `insert into auth.users (email, raw_user_meta_data)
     values ('chat-b@test.nexus', '{"full_name":"Student B"}'::jsonb) returning id`
  )
).rows[0].id;

// ---------------------------------------------------------------------------
// 1. rate limiting (FR-SEC-04 / AC-41)
// ---------------------------------------------------------------------------
async function consume(uid, limit = 20) {
  await asUser(db, uid);
  const { rows } = await db.query(
    `select public.consume_rate_limit('chat', $1, 3600) r`,
    [limit]
  );
  return rows[0].r;
}

let lastAllowed = null;
for (let i = 1; i <= 20; i += 1) lastAllowed = await consume(A);
check(
  'the first 20 messages in an hour are allowed (FR-SEC-04)',
  lastAllowed.allowed === true && lastAllowed.count === 20,
  JSON.stringify(lastAllowed)
);

const twentyFirst = await consume(A);
check(
  'the 21st message in an hour is refused (AC-41)',
  twentyFirst.allowed === false && twentyFirst.remaining === 0,
  JSON.stringify(twentyFirst)
);

const otherStudent = await consume(B);
check(
  "one student's quota does not consume another's",
  otherStudent.allowed === true && otherStudent.count === 1,
  JSON.stringify(otherStudent)
);

// The identifier is taken from auth.uid() INSIDE the function, so a caller
// cannot spend or inspect someone else's quota by passing an argument.
await reset(db);
const stored = await db.query(
  `select identifier, endpoint, attempt_count from public.rate_limit_events order by attempt_count desc`
);
check(
  'the quota is keyed on the caller’s own uid, not a caller-supplied value',
  stored.rows[0].identifier === A && stored.rows[0].attempt_count === 21,
  JSON.stringify(stored.rows)
);
check(
  'the function signature exposes no identifier argument to forge',
  (
    await db.query(
      `select pg_get_function_arguments(oid) a from pg_proc
       where proname = 'consume_rate_limit'`
    )
  ).rows[0].a === 'p_endpoint text, p_limit integer, p_window_seconds integer DEFAULT 3600',
  JSON.stringify(
    (
      await db.query(
        `select pg_get_function_arguments(oid) a from pg_proc where proname='consume_rate_limit'`
      )
    ).rows[0]
  )
);

await asAnon(db);
await expectReject(
  'an anonymous caller cannot consume the rate limiter at all',
  db.query(`select public.consume_rate_limit('chat', 20, 3600)`)
);

// §4.8 — the counter table itself is never browser-reachable
await asUser(db, A);
await expectReject(
  'a signed-in student still cannot read rate_limit_events (§4.8)',
  db.query(`select * from public.rate_limit_events`)
);
await asUser(db, A);
await expectReject(
  'a signed-in student cannot delete their own counter to reset it',
  db.query(`delete from public.rate_limit_events`)
);

// ---------------------------------------------------------------------------
// 2. chat_messages — owner-scoped and constrained (§3.6, §4.4)
// ---------------------------------------------------------------------------
await asUser(db, A);
await expectOk(
  'a student can store their own message and the reply',
  db.query(
    `insert into public.chat_messages (user_id, sender, message) values
       ($1, 'user', 'What does my ISA code mean?'),
       ($1, 'assistant', 'Investigative, Social and Artistic.')`,
    [A]
  )
);

await asUser(db, B);
const cross = await db.query(`select * from public.chat_messages where user_id = $1`, [A]);
check("Student B cannot read Student A's conversation", cross.rows.length === 0);

await asUser(db, B);
await expectReject(
  "a student cannot write a message into another student's history",
  db.query(`insert into public.chat_messages (user_id, sender, message) values ($1,'user','x')`, [A])
);

await asUser(db, A);
await expectReject(
  'sender is constrained to user/assistant',
  db.query(`insert into public.chat_messages (user_id, sender, message) values ($1,'system','x')`, [
    A,
  ])
);
await asUser(db, A);
await expectReject(
  'a message longer than 4000 characters is rejected (§3.6)',
  db.query(`insert into public.chat_messages (user_id, sender, message) values ($1,'user',$2)`, [
    A,
    'x'.repeat(4001),
  ])
);
await asUser(db, A);
await expectOk(
  'a message at exactly 4000 characters is accepted',
  db.query(`insert into public.chat_messages (user_id, sender, message) values ($1,'user',$2)`, [
    A,
    'x'.repeat(4000),
  ])
);

await asUser(db, A);
const own = await db.query(`select * from public.chat_messages order by created_at`);
check('a student reads back their own history', own.rows.length === 3, `${own.rows.length} rows`);

// ---------------------------------------------------------------------------
// 3. retention (D-31 — 12 months, stated in the privacy notice)
// ---------------------------------------------------------------------------
await reset(db);
await db.query(
  `insert into public.chat_messages (user_id, sender, message, created_at)
   values ($1, 'user', 'ancient question', now() - interval '13 months')`,
  [A]
);
const purged = await db.query(`select public.purge_old_chat_messages() c`);
check('the retention job deletes messages older than 12 months (D-31)', purged.rows[0].c === 1);
const remaining = await db.query(
  `select count(*)::int c from public.chat_messages where user_id = $1`,
  [A]
);
check('recent messages are left alone', remaining.rows[0].c === 3, JSON.stringify(remaining.rows[0]));

await asUser(db, A);
await expectReject(
  'a student cannot run the retention job themselves',
  db.query(`select public.purge_old_chat_messages()`)
);

// ---------------------------------------------------------------------------
// 4. account deletion removes the conversation (FR-SEC-11)
// ---------------------------------------------------------------------------
await reset(db);
await db.query(`delete from auth.users where id = $1`, [A]);
const afterDelete = await db.query(
  `select count(*)::int c from public.chat_messages where user_id = $1`,
  [A]
);
check(
  'deleting the account cascades the chat history away (FR-SEC-11)',
  afterDelete.rows[0].c === 0
);

// ---------------------------------------------------------------------------
await db.close();
const passed = results.filter((r) => r.pass).length;
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : `\n        └─ ${r.detail}`}`);
}
console.log(`\n${passed}/${results.length} passed.`);
process.exit(passed === results.length ? 0 : 1);
