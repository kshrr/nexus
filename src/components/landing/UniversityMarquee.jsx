import { universities } from '@/components/landing/universityLogos';

/** Slowly scrolling strip of university logos. Pauses on hover. */
export function UniversityMarquee() {
  return (
    <section className="st-marquee" aria-label="Universities on Nexus">
      <p>Universities on Nexus</p>
      <div className="st-marquee-window">
        <div className="st-marquee-track">
          {[false, true].map((copy) => (
            <ul key={String(copy)} aria-hidden={copy || undefined}>
              {universities.map((university) => (
                <li key={university.id}>
                  <img src={university.logo} alt={copy ? '' : university.name} loading="lazy" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
