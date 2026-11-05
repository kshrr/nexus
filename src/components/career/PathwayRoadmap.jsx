import { normaliseStageReview } from '@/lib/careerEvidence';
import { CareerSources } from './CareerSources';
export function PathwayRoadmap({ stages }) {
  if (!stages?.length) return null;
  return (
    <ol className="career-railway-map" aria-label="Education pathway stages">
      {stages.map((stage, index) => {
        const review = normaliseStageReview(stage.content_review);
        return (
          <li key={stage.id ?? stage.stage_order}>
            <span className="career-station-marker" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="career-station-card">
              {review ? (
                <>
                  <h3>{stage.stage_title}</h3>
                  <p>{stage.stage_description}</p>
                  {!!stage.focus_points?.length && (
                    <ul className="career-point-list">
                      {stage.focus_points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  )}
                  <CareerSources review={review} sectionLabel="This stage" />
                </>
              ) : (
                <>
                  <h3>Stage guidance awaiting review</h3>
                  <p>No professional requirement is asserted until this stage has been checked.</p>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
export default PathwayRoadmap;
