import realistic from '@/assets/riasec/realistic.webp';
import investigative from '@/assets/riasec/investigative.webp';
import artistic from '@/assets/riasec/artistic.webp';
import social from '@/assets/riasec/social.webp';
import enterprising from '@/assets/riasec/enterprising.webp';
import conventional from '@/assets/riasec/conventional.webp';

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
      width="512"
      height="768"
      loading="lazy"
      decoding="async"
    />
  );
}
