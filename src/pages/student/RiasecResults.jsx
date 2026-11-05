import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, EmptyState } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/feedback';
import { RailPageHeader } from '@/components/journey/RailPageHeader';
import { RiasecPortrait } from '@/components/riasec/RiasecPortrait';
import { RiasecRadarChart } from '@/components/riasec/RiasecRadarChart';
import { DimensionScoreList } from '@/components/riasec/DimensionScoreList';
import { resultToScores, useInterpretation, useRiasecResult } from '@/hooks/useRiasec';
import { useAuth } from '@/context/useAuth';
import { formatDate } from '@/lib/format';

const DETAIL_SECTIONS = [
  { id: 'traits', label: 'Traits' },
  { id: 'career_fields', label: 'Career fields' },
  { id: 'academic_areas', label: 'Study areas' },
];
const points = (value) =>
  String(value ?? '')
    .split(/;\s*|\n+|(?<=[.!?])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);

export function RiasecResults() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { result, loading, error, reload } = useRiasecResult();
  const { blocks, loading: loadingBlocks } = useInterpretation(result?.holland_code);
  const [selectedLetter, setSelectedLetter] = useState(null);
  const detailId = useId();
  const selected = blocks.find((b) => b.letter === selectedLetter) ?? blocks[0];
  const heading = (
    <RailPageHeader
      station="01"
      label="INTEREST STATION"
      title="Your interest profile"
      description={
        result
          ? `Completed ${formatDate(result.completed_at)} · a guide to what interests you`
          : 'Discover the activities and work environments that interest you.'
      }
      actions={
        result && (
          <Button variant="secondary" onClick={() => navigate('/find-your-path/assessment')}>
            Retake
          </Button>
        )
      }
    />
  );

  if (loading)
    return (
      <div className="rail-journey-page">
        {heading}
        <LoadingState rows={2} />
      </div>
    );
  if (error)
    return (
      <div className="rail-journey-page">
        {heading}
        <ErrorState
          title="We couldn’t load your interest profile"
          message={error.message}
          onRetry={reload}
        />
      </div>
    );
  if (!result)
    return (
      <div className="rail-journey-page">
        {heading}
        <EmptyState
          title="Take the assessment to see your profile"
          description="36 short questions, about 8 minutes. Your journey starts with your interests."
          action={
            <Button onClick={() => navigate('/find-your-path/assessment')}>Start assessment</Button>
          }
        />
      </div>
    );

  return (
    <div className="rail-journey-page rail-results-page">
      {heading}
      <section className="rail-profile-ticket" aria-label="Interest score overview">
        <div className="rail-code-stub">
          <span>YOUR HOLLAND CODE</span>
          <strong>{result.holland_code}</strong>
          <small>Your three leading interests</small>
        </div>
        <div className="rail-profile-chart" role="region" aria-label="Your profile map">
          <h2>Your profile map</h2>
          <RiasecRadarChart scores={resultToScores(result)} />
        </div>
        <section className="rail-profile-scores">
          <h2>Your six scores</h2>
          <DimensionScoreList scores={resultToScores(result)} />
        </section>
        
      </section>
      <div className="rail-section-caption">
        <h2>Meet your leading interests</h2>
        <span>Choose a card to explore ↓</span>
      </div>
      {loadingBlocks ? (
        <LoadingState rows={1} />
      ) : blocks.length === 0 ? (
        <p className="rail-inline-note">
          Detailed interpretations are unavailable. Your six scores are shown above.
        </p>
      ) : (
        <>
          <div className="rail-interest-cards">
            {blocks.map((block, index) => (
              <button
                type="button"
                key={block.letter}
                className={`rail-interest-card rail-interest-card--portrait${selected?.letter === block.letter ? ' is-selected' : ''}`}
                aria-pressed={selected?.letter === block.letter}
                aria-controls={detailId}
                onClick={() => setSelectedLetter(block.letter)}
              >
                <span className="rail-interest-card-top">
                  <span>{String(index + 1).padStart(2, '0')} / LEADING INTEREST</span>
                  <b>{block.letter}</b>
                </span>
                <RiasecPortrait letter={block.letter} />
                <span className="rail-interest-card-name">
                  {block.name}
                  <span aria-hidden="true">{selected?.letter === block.letter ? '✓' : '↗'}</span>
                </span>
              </button>
            ))}
          </div>
          {selected && (
            <section
              className="rail-interest-detail"
              aria-label={`${selected.name} interpretation`}
              id={detailId}
            >
              <p className="sr-only" role="status">
                Showing {selected.name} details
              </p>
              <div className="rail-detail-heading">
                <span className="rail-small-letter">{selected.letter}</span>
                <h2>Inside your {selected.name.toLowerCase()} interests</h2>
              </div>
              <ul className="rail-interest-summary">
                {points(selected.summary).map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
              <div className="rail-interest-sections">
                {DETAIL_SECTIONS.map((section, index) => (
                  <section
                    key={section.id}
                    className="rail-interest-section"
                    aria-labelledby={`${detailId}-${section.id}`}
                  >
                    <h3 id={`${detailId}-${section.id}`}>
                      <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                      {section.label}
                    </h3>
                    <ul className="rail-point-list">
                      {points(selected[section.id]).map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                    {!points(selected[section.id]).length && (
                      <p>No details available for this section.</p>
                    )}
                  </section>
                ))}
              </div>
            </section>
          )}
        </>
      )}
      <footer className="rail-next-connection">
        <div>
          <span>NEXT CONNECTION</span>
          <p>Interests are a starting point, not a fixed destination.</p>
        </div>
        <div>
          {profile?.education_level === 'spm' && (
            <Button variant="secondary" onClick={() => navigate('/find-your-path/academic')}>
              Add academic results
            </Button>
          )}
          <Button onClick={() => navigate('/recommendations')}>See recommendations →</Button>
        </div>
      </footer>
    </div>
  );
}
export default RiasecResults;
