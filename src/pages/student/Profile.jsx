import { useEffect, useState } from 'react';
import { useAuth } from '@/context/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useSubjects } from '@/hooks/useSubjects';
import { useAcademicResults } from '@/hooks/useAcademicResults';
import { PageHeader } from '@/components/layout';
import { Alert, Button, Card, Input, RadioGroup, Select, Tabs } from '@/components/ui';
import { GradeEntryTable } from '@/components/academic/GradeEntryTable';
import { EDUCATION_LEVELS, EDUCATION_LEVEL_LABELS } from '@/types';
import { TARGET_INDUSTRIES } from '@/config/policy';
import { validateFullName, validatePassword } from '@/lib/validation';
import { formatDate } from '@/lib/format';

const TABS = [
  { id: 'account', label: 'Account' },
  { id: 'education', label: 'Education' },
  { id: 'results', label: 'Results' },
  { id: 'privacy', label: 'Privacy' },
];

/**
 * Profile & settings (FR04, ui-spec §9). Every field maps to a requirement and
 * is edited in place. All writes go direct to PostgREST under RLS — a student
 * can only ever change their own row, and `role` is never in a payload.
 */
export function Profile() {
  const { user, profile, updatePassword } = useAuth();
  const [tab, setTab] = useState('account');

  return (
    <>
      <PageHeader title="Profile & settings" description="Everything Nexus knows about you." />
      <Tabs tabs={TABS} active={tab} onChange={setTab} className="mb-6" />
      {tab === 'account' && (
        <AccountTab user={user} profile={profile} updatePassword={updatePassword} />
      )}
      {tab === 'education' && <EducationTab profile={profile} />}
      {tab === 'results' && <ResultsTab profile={profile} />}
      {tab === 'privacy' && <PrivacyTab profile={profile} />}
    </>
  );
}

// ---------------------------------------------------------------------------
function SaveState({ status }) {
  if (status === 'saving') return <span className="text-body-sm text-ink-500">Saving…</span>;
  if (status === 'saved') return <span className="text-body-sm text-pine-700">Saved</span>;
  if (status === 'error')
    return <span className="text-body-sm text-rust-600">Couldn’t save — try again</span>;
  return null;
}

// ---------------------------------------------------------------------------
function AccountTab({ user, profile, updatePassword }) {
  const { updateProfile } = useProfile();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [nameStatus, setNameStatus] = useState('idle');
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwStatus, setPwStatus] = useState('idle');

  useEffect(() => setName(profile?.full_name ?? ''), [profile?.full_name]);

  async function saveName() {
    if (validateFullName(name)) return;
    setNameStatus('saving');
    const { error } = await updateProfile({ full_name: name.trim() });
    setNameStatus(error ? 'error' : 'saved');
  }

  async function changePassword(e) {
    e.preventDefault();
    const err = validatePassword(pw);
    if (err) return setPwError(err);
    setPwError('');
    setPwStatus('saving');
    const { error } = await updatePassword(pw);
    setPwStatus(error ? 'error' : 'saved');
    if (!error) setPw('');
  }

  return (
    <div className="flex flex-col gap-4">
      <Card variant="titled" title="Name" action={<SaveState status={nameStatus} />}>
        <div className="flex flex-col gap-3">
          <Input
            label="Full name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameStatus('idle');
            }}
            error={name ? validateFullName(name) : null}
          />
          <Button variant="secondary" size="sm" className="w-fit" onClick={saveName}>
            Save name
          </Button>
        </div>
      </Card>

      <Card variant="titled" title="Email">
        <Input label="Email" value={user?.email ?? ''} readOnly disabled />
        <p className="mt-2 text-body-sm text-ink-500">
          Your email is managed by your sign-in and can’t be changed here.
        </p>
      </Card>

      <Card variant="titled" title="Password" action={<SaveState status={pwStatus} />}>
        <form onSubmit={changePassword} className="flex flex-col gap-3">
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setPwStatus('idle');
            }}
            hint="At least 8 characters, with a letter and a number."
            error={pwError}
          />
          <Button type="submit" variant="secondary" size="sm" className="w-fit">
            Change password
          </Button>
        </form>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
function EducationTab({ profile }) {
  const { updateProfile } = useProfile();
  const [level, setLevel] = useState(profile?.education_level ?? null);
  const [goal, setGoal] = useState(profile?.career_goal ?? '');
  const [industry, setIndustry] = useState(profile?.target_industry ?? '');
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    setLevel(profile?.education_level ?? null);
    setGoal(profile?.career_goal ?? '');
    setIndustry(profile?.target_industry ?? '');
  }, [profile]);

  const levelChanged = level !== (profile?.education_level ?? null);

  async function save() {
    setStatus('saving');
    const { error } = await updateProfile({
      education_level: level,
      career_goal: goal.trim() || null,
      target_industry: industry.trim() || null,
    });
    setStatus(error ? 'error' : 'saved');
  }

  return (
    <Card variant="titled" title="Education & goals" action={<SaveState status={status} />}>
      <div className="flex flex-col gap-5">
        <RadioGroup
          label="Education level"
          layout="cards"
          value={level}
          onChange={(v) => {
            setLevel(v);
            setStatus('idle');
          }}
          options={EDUCATION_LEVELS.map((l) => ({ value: l, label: EDUCATION_LEVEL_LABELS[l] }))}
        />
        {levelChanged && (
          <Alert variant="warning">
            Changing your education level will regenerate your recommendations next time you open
            them.
          </Alert>
        )}
        <Input
          label="Career goal"
          hint="Optional."
          maxLength={200}
          value={goal}
          onChange={(e) => {
            setGoal(e.target.value);
            setStatus('idle');
          }}
        />
        <Select
          label="Target industry"
          hint="Optional."
          placeholder="Choose one…"
          value={industry}
          options={TARGET_INDUSTRIES}
          onChange={(e) => {
            setIndustry(e.target.value);
            setStatus('idle');
          }}
        />
        <Button className="w-fit" onClick={save} disabled={!level}>
          Save changes
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
function ResultsTab({ profile }) {
  const { subjects } = useSubjects();
  const { replaceGrades, saving } = useProfile();
  const { selectedCodes, grades, loading, setSelectedCodes, setGrades, reload } =
    useAcademicResults();
  const [status, setStatus] = useState('idle');

  if (profile && profile.education_level !== 'spm') {
    return (
      <Alert variant="info" title="Results analysis is for SPM leavers only.">
        Pre-university grading isn’t standardised across programmes, so Nexus doesn’t analyse it.
        Your recommendations use your interests and goals instead.
      </Alert>
    );
  }

  if (loading) return <p className="text-body-sm text-ink-500">Loading your results…</p>;

  const gradeList = selectedCodes.flatMap((code) =>
    Object.entries(grades[code] ?? {})
      .filter(([, g]) => g)
      .map(([examType, grade]) => ({ subjectCode: code, examType, grade }))
  );

  async function save() {
    setStatus('saving');
    const { error } = await replaceGrades(gradeList);
    setStatus(error ? 'error' : 'saved');
    if (!error) reload();
  }

  return (
    <Card
      variant="titled"
      title="SPM results"
      action={<SaveState status={saving ? 'saving' : status} />}
    >
      <p className="mb-3 text-body-sm text-ink-500">
        Changes here update your subject strength classification.
      </p>
      <GradeEntryTable
        subjects={subjects}
        selectedCodes={selectedCodes}
        grades={grades}
        onAddSubject={(code) => {
          setSelectedCodes((c) => [...c, code]);
          setStatus('idle');
        }}
        onRemoveSubject={(code) => {
          setSelectedCodes((c) => c.filter((x) => x !== code));
          setGrades((g) => {
            const n = { ...g };
            delete n[code];
            return n;
          });
          setStatus('idle');
        }}
        onGradeChange={(code, examType, grade) => {
          setGrades((g) => ({ ...g, [code]: { ...g[code], [examType]: grade } }));
          setStatus('idle');
        }}
      />
      <Button className="mt-4 w-fit" onClick={save} disabled={saving}>
        Save results
      </Button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
function PrivacyTab({ profile }) {
  return (
    <div className="flex flex-col gap-4">
      <Card variant="titled" title="Consent">
        {profile?.consent_version ? (
          <p className="text-body-sm text-ink-700">
            You agreed to privacy notice version <strong>{profile.consent_version}</strong> on{' '}
            {formatDate(profile.consent_at)}.
          </p>
        ) : (
          <p className="text-body-sm text-ink-500">No consent record found for this account.</p>
        )}
        <p className="mt-2 text-body-sm">
          <a href="/privacy" className="text-pine-700 underline">
            Read the privacy notice
          </a>
        </p>
      </Card>

      <Card variant="titled" title="Your data">
        <p className="text-body-sm text-ink-700">
          Downloading a copy of your data and permanently deleting your account will be available
          from this page. Both need a server-side operation that isn’t built yet.
        </p>
      </Card>
    </div>
  );
}

export default Profile;
