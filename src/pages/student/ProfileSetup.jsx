import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useSubjects } from '@/hooks/useSubjects';
import { Alert, Button, Input, RadioGroup, Select } from '@/components/ui';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { StepIndicator } from '@/components/profile/StepIndicator';
import { EligibilityReadiness } from '@/components/profile/EligibilityReadiness';
import { GradeEntryTable } from '@/components/academic/GradeEntryTable';
import { SpmResultUpload } from '@/components/academic/SpmResultUpload';
import { mergeDetectedGrades } from '@/lib/gradeMerge';
import {
  EDUCATION_LEVELS,
  EDUCATION_LEVEL_LABELS,
  INCOME_BAND_OPTIONS,
  NATIONALITY_OPTIONS,
} from '@/types';
import { TARGET_INDUSTRIES } from '@/config/policy';
import { validateBirthYear, validateFullName } from '@/lib/validation';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow-condensed/700.css';
import '@/styles/profile-station.css';

const SPM_ONLY = ['spm_actual'];
const STEPS = ['About you', 'Education level', 'SPM results', 'Scholarship checks'];

const LEVEL_DESCRIPTIONS = {
  spm: 'Just sat SPM.',
  stpm: 'In or completed Form 6.',
  stam: 'Sijil Tinggi Agama Malaysia.',
  matriculation: 'In a matriculation programme.',
  foundation: 'In a university foundation year.',
  diploma: 'Studying for or completed a diploma.',
};

/**
 * Four-step profile wizard (FR03, architecture.md §6.2 / ui-spec §3.4).
 * Session-only route (before profile completion), so it is NOT wrapped by
 * <ProfileGate>. Final submit writes `profiles` + `academic_results` and calls
 * `compute_subject_strengths`, sets `profile_completed = true`, and redirects to
 * the dashboard.
 */
export function ProfileSetup() {
  const { profile } = useAuth();
  const { completeProfileSetup, updateProfile, saveGrades, saving } = useProfile();
  const { subjects } = useSubjects();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState('');
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [educationLevel, setEducationLevel] = useState(profile?.education_level ?? null);
  const [careerGoal, setCareerGoal] = useState(profile?.career_goal ?? '');
  const [targetIndustry, setTargetIndustry] = useState(profile?.target_industry ?? '');
  const [nationality, setNationality] = useState(profile?.nationality ?? '');
  const [birthYear, setBirthYear] = useState(profile?.birth_year ? String(profile.birth_year) : '');
  const [incomeBand, setIncomeBand] = useState(profile?.household_income_band ?? '');

  // grade entry state
  const [selectedCodes, setSelectedCodes] = useState(/** @type {string[]} */ ([]));
  const [grades, setGrades] = useState(/** @type {Record<string, Record<string, string>>} */ ({}));

  const stepValid = useMemo(() => {
    if (step === 0) return !validateFullName(fullName);
    if (step === 1) return Boolean(educationLevel);
    if (step === 3) return !validateBirthYear(birthYear);
    return true; // the results step and the answers in step 4 are optional
  }, [step, fullName, educationLevel, birthYear]);

  function next() {
    if (!stepValid) return;
    setFormError('');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setFormError('');
    setStep((s) => Math.max(s - 1, 0));
  }

  function gradeList() {
    return selectedCodes.flatMap((code) =>
      Object.entries(grades[code] ?? {})
        .filter(([, g]) => g)
        .map(([examType, grade]) => ({ subjectCode: code, examType, grade }))
    );
  }

  const answers = {
    nationality,
    educationLevel,
    careerGoal,
    targetIndustry,
    birthYear,
    householdIncomeBand: incomeBand,
    gradeCount: gradeList().length,
  };

  async function saveAndExit() {
    await updateProfile({
      full_name: fullName.trim(),
      education_level: educationLevel,
      career_goal: careerGoal.trim() || null,
      target_industry: targetIndustry.trim() || null,
      nationality: nationality || null,
      birth_year: birthYear && !validateBirthYear(birthYear) ? Number(birthYear) : null,
      household_income_band: incomeBand || null,
    });
    // Results entered so far are kept too, so "finish later" doesn't lose them.
    const entered = gradeList();
    if (entered.length) await saveGrades(entered);
    navigate('/');
  }

  async function finish() {
    setFormError('');
    const { error } = await completeProfileSetup({
      fullName,
      educationLevel,
      careerGoal,
      targetIndustry,
      nationality,
      birthYear: birthYear && !validateBirthYear(birthYear) ? Number(birthYear) : null,
      householdIncomeBand: incomeBand,
      grades: gradeList(),
    });
    if (error) {
      setFormError(error.message || 'Something went wrong saving your profile. Try again.');
      return;
    }
    try {
      sessionStorage.setItem('nexus.justCompletedProfile', '1');
    } catch {
      /* storage may be unavailable — the toast is a nicety, not essential */
    }
    navigate('/dashboard', { replace: true });
  }

  return (
    <div className="pf">
      <header className="pf-hero">
        <Breadcrumbs tone="light" />
        <h1>Set up your profile</h1>
        <p>A few short steps so Nexus can tailor what it shows you.</p>
      </header>
      <div className="pf-panel">
        <StepIndicator steps={STEPS} current={step} />

        {formError && (
          <Alert variant="error" className="mb-4">
            {formError}
          </Alert>
        )}

        {step === 0 && (
          <div className="flex flex-col gap-4">
            <Input
              label="Full name"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={step === 0 && fullName ? validateFullName(fullName) : null}
              required
            />
            <p className="text-body-sm text-ink-500">
              We don’t ask for your date of birth, IC number, phone or address.
            </p>
          </div>
        )}

        {step === 1 && (
          <RadioGroup
            label="Where are you in your education?"
            layout="cards"
            value={educationLevel}
            onChange={setEducationLevel}
            options={EDUCATION_LEVELS.map((lvl) => ({
              value: lvl,
              label: EDUCATION_LEVEL_LABELS[lvl],
              description: LEVEL_DESCRIPTIONS[lvl],
            }))}
          />
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <p className="text-body-sm text-ink-700">
              Scholarships often ask for minimum SPM grades, even if you’ve moved on to STPM or a
              diploma. Add the grades you have and Nexus will show which requirements you meet. You
              can leave any cell blank and add more later.
            </p>
            <SpmResultUpload
              subjects={subjects}
              onDetected={(found) => {
                const merged = mergeDetectedGrades(selectedCodes, grades, found);
                setSelectedCodes(merged.selectedCodes);
                setGrades(merged.grades);
              }}
            />
            <GradeEntryTable
              examTypes={SPM_ONLY}
              subjects={subjects}
              selectedCodes={selectedCodes}
              grades={grades}
              onAddSubject={(code) => setSelectedCodes((c) => [...c, code])}
              onRemoveSubject={(code) => {
                setSelectedCodes((c) => c.filter((x) => x !== code));
                setGrades((g) => {
                  const next = { ...g };
                  delete next[code];
                  return next;
                });
              }}
              onGradeChange={(code, examType, grade) =>
                setGrades((g) => ({ ...g, [code]: { ...g[code], [examType]: grade } }))
              }
            />
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <p className="text-body-sm text-ink-700">
              Scholarship requirements are compared with these answers. Skip any you prefer; the
              requirement will show as “can’t check” instead of “not met”.
            </p>
            <RadioGroup
              label="Are you a Malaysian citizen?"
              value={nationality}
              onChange={setNationality}
              options={NATIONALITY_OPTIONS}
            />
            <Input
              label="Year of birth"
              hint="Optional. Only the year, to check age limits."
              inputMode="numeric"
              maxLength={4}
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ''))}
              error={validateBirthYear(birthYear)}
            />
            <Select
              label="Monthly household income"
              hint="Optional. A range is enough. Used only to check income limits."
              placeholder="Prefer not to say"
              value={incomeBand}
              options={INCOME_BAND_OPTIONS.filter((option) => option.value)}
              onChange={(e) => setIncomeBand(e.target.value)}
            />
            <Input
              label="Career goal"
              hint="Optional. A job or field you’re aiming for."
              maxLength={200}
              value={careerGoal}
              onChange={(e) => setCareerGoal(e.target.value)}
            />
            <Select
              label="Field you want to study"
              hint="Optional. Used to check scholarships limited to a field."
              placeholder="Choose one…"
              value={targetIndustry}
              options={TARGET_INDUSTRIES}
              onChange={(e) => setTargetIndustry(e.target.value)}
            />
            <EligibilityReadiness answers={answers} />
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button variant="secondary" onClick={back} disabled={step === 0 || saving}>
            Back
          </Button>
          <div className="flex items-center gap-3">
            {step >= 1 && (
              <button
                type="button"
                onClick={saveAndExit}
                disabled={saving}
                className="text-body-sm text-pine-700 underline disabled:text-ink-500"
              >
                Save and finish later
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <Button onClick={next} disabled={!stepValid || saving}>
                Continue
              </Button>
            ) : (
              <Button onClick={finish} loading={saving}>
                Finish
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileSetup;
