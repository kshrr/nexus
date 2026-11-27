import { useEffect, useState } from 'react';
import { useAuth } from '@/context/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useSubjects } from '@/hooks/useSubjects';
import { useAcademicResults } from '@/hooks/useAcademicResults';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Alert, Button, Card, Input, RadioGroup, Select, Tabs } from '@/components/ui';
import { DataControls } from '@/components/profile/DataControls';
import { EligibilityReadiness } from '@/components/profile/EligibilityReadiness';
import { GradeEntryTable } from '@/components/academic/GradeEntryTable';
import { SpmResultUpload } from '@/components/academic/SpmResultUpload';
import { mergeDetectedGrades } from '@/lib/gradeMerge';
import { INCOME_BAND_OPTIONS, NATIONALITY_OPTIONS } from '@/types';
import { EDUCATION_LEVELS, EDUCATION_LEVEL_LABELS } from '@/types';
import { TARGET_INDUSTRIES } from '@/config/policy';
import { validateBirthYear, validateFullName, validatePassword } from '@/lib/validation';
import { formatDate } from '@/lib/format';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow-condensed/700.css';
import '@/styles/profile-station.css';

const SPM_ONLY = ['spm_actual'];
const TABS = [
  { id: 'account', label: 'Account' },
  { id: 'education', label: 'Education' },
  { id: 'results', label: 'Results' },
  { id: 'scholarships', label: 'Scholarship checks' },
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
    <div className="pf">
      <header className="pf-hero">
        <Breadcrumbs tone="light" />
        <h1>Profile &amp; settings</h1>
        <p>Everything Nexus knows about you.</p>
      </header>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'account' && (
        <AccountTab user={user} profile={profile} updatePassword={updatePassword} />
      )}
      {tab === 'education' && <EducationTab profile={profile} />}
      {tab === 'results' && <ResultsTab />}
      {tab === 'scholarships' && <ScholarshipChecksTab profile={profile} onGoTo={setTab} />}
      {tab === 'privacy' && <PrivacyTab profile={profile} />}
    </div>
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
function ScholarshipChecksTab({ profile, onGoTo }) {
  const { updateProfile } = useProfile();
  const { selectedCodes, grades, loading } = useAcademicResults();
  const [nationality, setNationality] = useState(profile?.nationality ?? '');
  const [status, setStatus] = useState('idle');
  const [birthYear, setBirthYear] = useState(profile?.birth_year ? String(profile.birth_year) : '');
  const [incomeBand, setIncomeBand] = useState(profile?.household_income_band ?? '');
  const [personalStatus, setPersonalStatus] = useState('idle');

  useEffect(() => setNationality(profile?.nationality ?? ''), [profile?.nationality]);
  useEffect(
    () => setBirthYear(profile?.birth_year ? String(profile.birth_year) : ''),
    [profile?.birth_year]
  );
  useEffect(
    () => setIncomeBand(profile?.household_income_band ?? ''),
    [profile?.household_income_band]
  );

  async function savePersonal() {
    if (validateBirthYear(birthYear)) return;
    setPersonalStatus('saving');
    const { error } = await updateProfile({
      birth_year: birthYear ? Number(birthYear) : null,
      household_income_band: incomeBand || null,
    });
    setPersonalStatus(error ? 'error' : 'saved');
  }

  async function saveNationality(value) {
    setNationality(value);
    setStatus('saving');
    const { error } = await updateProfile({ nationality: value || null });
    setStatus(error ? 'error' : 'saved');
  }

  const gradeCount = selectedCodes.reduce(
    (total, code) => total + Object.values(grades[code] ?? {}).filter(Boolean).length,
    0
  );
  const answers = {
    nationality,
    educationLevel: profile?.education_level,
    careerGoal: profile?.career_goal,
    targetIndustry: profile?.target_industry,
    birthYear: birthYear && !validateBirthYear(birthYear) ? birthYear : null,
    householdIncomeBand: incomeBand,
    gradeCount,
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-sm text-ink-700">
        When you open a scholarship, Nexus compares its requirements with these answers. Anything
        you haven’t added shows as “can’t check” or “not met”. Add it here whenever you like.
      </p>
      <EligibilityReadiness
        answers={loading ? { ...answers, gradeCount: 1 } : answers}
        onAdd={onGoTo}
      />
      <Card variant="titled" title="Citizenship" action={<SaveState status={status} />}>
        <RadioGroup
          label="Are you a Malaysian citizen?"
          value={nationality}
          onChange={saveNationality}
          options={NATIONALITY_OPTIONS}
        />
        <p className="mt-2 text-body-sm text-ink-500">
          Used only to check scholarships that are for Malaysian citizens. Choose “Prefer not to
          say” to remove it.
        </p>
      </Card>
      <Card
        variant="titled"
        title="Age and household income"
        action={<SaveState status={personalStatus} />}
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Year of birth"
            hint="Optional. Only the year, to check age limits."
            inputMode="numeric"
            maxLength={4}
            value={birthYear}
            onChange={(e) => {
              setBirthYear(e.target.value.replace(/\D/g, ''));
              setPersonalStatus('idle');
            }}
            error={validateBirthYear(birthYear)}
          />
          <Select
            label="Monthly household income"
            hint="Optional. A range is enough."
            placeholder="Prefer not to say"
            value={incomeBand}
            options={INCOME_BAND_OPTIONS.filter((option) => option.value)}
            onChange={(e) => {
              setIncomeBand(e.target.value);
              setPersonalStatus('idle');
            }}
          />
          <p className="text-body-sm text-ink-500">
            Used only to check scholarships with an age or income limit. Clear either to remove it.
          </p>
          <Button
            className="w-fit"
            size="sm"
            onClick={savePersonal}
            disabled={Boolean(validateBirthYear(birthYear))}
          >
            Save
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
function ResultsTab() {
  const { subjects } = useSubjects();
  const { replaceGrades, saving } = useProfile();
  const { selectedCodes, grades, loading, setSelectedCodes, setGrades, reload } =
    useAcademicResults();
  const [status, setStatus] = useState('idle');

  if (loading) return <p className="text-body-sm text-ink-500">Loading your results…</p>;

  const gradeList = selectedCodes.flatMap((code) =>
    SPM_ONLY.filter((examType) => grades[code]?.[examType]).map((examType) => ({
      subjectCode: code,
      examType,
      grade: grades[code][examType],
    }))
  );

  async function save() {
    setStatus('saving');
    const { error } = await replaceGrades(gradeList, {
      examTypes: SPM_ONLY,
      keepSubjects: selectedCodes,
    });
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
        Scholarship checks use these grades, whatever level you’re at now. Changes also update your
        subject strength classification.
      </p>
      <div className="mb-4">
        <SpmResultUpload
          subjects={subjects}
          onDetected={(found) => {
            const merged = mergeDetectedGrades(selectedCodes, grades, found);
            setSelectedCodes(merged.selectedCodes);
            setGrades(merged.grades);
            setStatus('idle');
          }}
        />
      </div>
      <GradeEntryTable
        examTypes={SPM_ONLY}
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

      <DataControls />
    </div>
  );
}

export default Profile;
