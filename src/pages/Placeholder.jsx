import { PageHeader } from '@/components/layout';
import { EmptyState, Icon } from '@/components/ui';

/**
 * Honest stand-in for a route whose feature belongs to a later implementation
 * phase. Not a blank screen, not a fake UI — it names what will live here.
 *
 * @param {{ title: string, description?: string, phase?: string }} props
 */
export function Placeholder({ title, description, phase }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState
        className="border-pine-100 bg-surface py-16 shadow-card"
        title={title === 'Careers' ? 'Career pathways are being connected' : 'This area is coming together'}
        description={
          title === 'Careers'
            ? 'This will show the journey from your current education to a course and onward to a career. Nexus will only display pathways backed by the project data — no invented examples.'
            : phase
              ? `This screen is scheduled for ${phase}. The project foundation is in place; the feature itself comes next.`
              : 'This screen is part of a later implementation phase.'
        }
        action={<span className="grid h-14 w-14 place-items-center rounded-2xl bg-lilac text-pine-900"><Icon name={title === 'Careers' ? 'career' : 'sparkles'} /></span>}
      />
    </>
  );
}

export default Placeholder;
