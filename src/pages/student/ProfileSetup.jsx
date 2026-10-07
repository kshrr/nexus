import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useSubjects } from '@/hooks/useSubjects';
import { Alert, Button, Input, RadioGroup, Select } from '@/components/ui';
import { StepIndicator } from '@/components/profile/StepIndicator';
import { GradeEntryTable } from '@/components/academic/GradeEntryTable';
import { EDUCATION_LEVELS, EDUCATION_LEVEL_LABELS } from '@/types';
import { TARGET_INDUSTRIES } from '@/config/policy';
import { validateFullName } from '@/lib/validation';

const STEPS = ['About you', 'Education level', 'Your results', 'Your goals'];

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
  const { completeProfileSetup, updateProfile, saving } = useProfile();
  const { subjects } = useSubjects();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState('');
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [educationLevel, setEducationLevel] = useState(profile?.education_level ?? null);
  const [careerGoal, setCareerGoal] = useState(profile?.career_goal ?? '');
  const [targetIndustry, setTargetIndustry] = useState(profile?.target_industry ?? '');

  // grade entry state
  const [selectedCodes, setSelectedCodes] = useState(/** @type {string[]} */ ([]));
  const [grades, setGrades] = useState(/** @type {Record<string, Record<string, string>>} */ ({}));

  const isSpm = educationLevel === 'spm';

  const stepValid = useMemo(() => {
    if (step === 0) return !validateFullName(fullName);
    if (step === 1) return Boolean(educationLevel);
    return true; // steps 2 (results) and 3 (goals) are optional
  }, [step, fullName, educationLevel]);

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

  async function saveAndExit() {
    await updateProfile({
      full_name: fullName.trim(),
      education_level: educationLevel,
      career_goal: careerGoal.trim() || null,
      target_industry: targetIndustry.trim() || null,
    });
    navigate('/');
  }

  async function finish() {
    setFormError('');
    const { error } = await completeProfileSetup({
      fullName,
      educationLevel,
      careerGoal,
      targetIndustry,
      grades: isSpm ? gradeList() : [],
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
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-display font-serif">Set up your profile</h1>
      <p className="mb-6 text-body text-ink-700">
        A few short steps so Nexus can tailor what it shows you.
      </p>

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
            That’s all we need here — no date of birth, IC number, phone or address.
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

      {step === 2 &&
        (isSpm ? (
          <div className="flex flex-col gap-3">
            <p className="text-body-sm text-ink-700">
              Add your SPM subjects and the grades you have across the three exam periods. You can
              leave any cell blank and add more later.
            </p>
            <GradeEntryTable
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
        ) : (
          <Alert variant="info" title="We’ll skip this step.">
            Nexus analyses results for SPM leavers only, because pre-university grading isn’t
            standardised across programmes. Your recommendations will be based on your interests and
            goals.
          </Alert>
        ))}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <Input
            label="Career goal"
            hint="Optional. A job or field you’re aiming for."
            maxLength={200}
            value={careerGoal}
            onChange={(e) => setCareerGoal(e.target.value)}
          />
          <Select
            label="Target industry"
            hint="Optional."
            placeholder="Choose one…"
            value={targetIndustry}
            options={TARGET_INDUSTRIES}
            onChange={(e) => setTargetIndustry(e.target.value)}
          />
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
  );
}

export default ProfileSetup;
