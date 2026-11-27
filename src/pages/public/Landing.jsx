import { useEffect } from 'react';
import { LazyMotion, domAnimation } from 'motion/react';
import { Arrival, Hero, InformationDesk } from '@/components/landing/StationSections';
import { Facilities } from '@/components/landing/FacilitySlider';
import { StatsBand } from '@/components/landing/StatsBand';
import { MacbookTour } from '@/components/landing/MacbookTour';
import { UniversityExplorer } from '@/components/landing/UniversityExplorer';
import { UniversityMarquee } from '@/components/landing/UniversityMarquee';

export function Landing() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return undefined;
    const frame = window.requestAnimationFrame(() =>
      document.getElementById(id)?.scrollIntoView({ block: 'start' })
    );
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return (
    <LazyMotion features={domAnimation} strict>
      <div className="st-landing">
        <Hero />
        <StatsBand />
        <UniversityMarquee />
        <MacbookTour />
        <UniversityExplorer />
        <Facilities />
        <InformationDesk />
        <Arrival />
      </div>
    </LazyMotion>
  );
}

export default Landing;
