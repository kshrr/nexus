import { Icon } from '@/components/ui';

export function PathwayRoadmap({ stages }) {
  if (!stages?.length) return null;

  return (
    <ol className="relative" aria-label="Education pathway stages">
      {stages.map((stage, index) => (
        <li key={stage.id ?? stage.stage_order} className="relative grid grid-cols-[40px,1fr] gap-4 pb-8 last:pb-0 md:grid-cols-[52px,1fr] md:gap-6">
          {index < stages.length - 1 && (
            <span className="absolute left-5 top-10 h-[calc(100%-16px)] w-px bg-pine-300 md:left-[26px]" aria-hidden="true" />
          )}
          <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 border-paper bg-pine-700 text-caption font-semibold text-white shadow-sm md:h-[52px] md:w-[52px]">
            {stage.stage_order}
          </span>
          <div className="rounded-card border border-ink-100 bg-surface p-5 shadow-card">
            <h3 className="text-h3 text-ink-900">{stage.stage_title}</h3>
            <p className="mt-2 text-body-sm text-ink-700">{stage.stage_description}</p>
            {!!stage.focus_points?.length && (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {stage.focus_points.slice(0, 4).map((point) => (
                  <li key={point} className="flex items-start gap-2 text-body-sm text-ink-700">
                    <Icon name="check" className="mt-0.5 h-4 w-4 text-pine-500" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default PathwayRoadmap;

