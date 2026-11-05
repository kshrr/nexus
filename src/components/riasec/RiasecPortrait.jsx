import realistic from '@/assets/riasec/realistic.png';
import investigative from '@/assets/riasec/investigative.png';
import artistic from '@/assets/riasec/artistic.png';
import social from '@/assets/riasec/social.png';
import enterprising from '@/assets/riasec/enterprising.png';
import conventional from '@/assets/riasec/conventional.png';

const portraits = {
  R: realistic,
  I: investigative,
  A: artistic,
  S: social,
  E: enterprising,
  C: conventional,
};

/** User-supplied artwork; the adjacent card text provides its accessible name. */
export function RiasecPortrait({ letter }) {
  const source = portraits[letter];
  if (!source) return null;
  return (
    <img
      className="rail-interest-portrait"
      src={source}
      alt=""
      aria-hidden="true"
      width="1024"
      height="1536"
      loading="lazy"
      decoding="async"
    />
  );
}
