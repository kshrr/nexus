import { m, useReducedMotion } from 'motion/react';
import { RealisticTrain } from '@/components/landing/RealisticTrain';

const TILE = 960;

// Deterministic skyline: [x, width, height] per building, repeated seamlessly every TILE px.
const FAR = [
  [0, 70, 120],
  [80, 50, 170],
  [140, 80, 100],
  [230, 44, 210],
  [284, 70, 140],
  [364, 90, 96],
  [464, 46, 180],
  [520, 76, 126],
  [606, 56, 150],
  [672, 84, 104],
  [766, 50, 190],
  [826, 70, 130],
  [906, 54, 110],
];
const NEAR = [
  [10, 90, 74],
  [110, 60, 104],
  [180, 100, 62],
  [290, 52, 118],
  [352, 84, 80],
  [446, 70, 96],
  [526, 96, 66],
  [632, 58, 112],
  [700, 90, 78],
  [800, 64, 100],
  [874, 76, 70],
];

function skyline(blocks, fill, windows) {
  const base = 260;
  const shapes = blocks
    .map(([x, w, h]) => {
      const lit = windows
        ? Array.from({ length: Math.floor(h / 26) }, (_, row) =>
            [0, 1, 2]
              .filter((col) => (row * 7 + col * 3 + x) % 4 !== 0 && w > 40 + col * 10)
              .map(
                (col) =>
                  `<rect x="${x + 9 + col * 16}" y="${base - h + 12 + row * 22}" width="7" height="10" fill="#fff" opacity=".5"/>`
              )
              .join('')
          ).join('')
        : '';
      const mast =
        h > 160
          ? `<rect x="${x + w / 2 - 1}" y="${base - h - 26}" width="2" height="26" fill="${fill}"/>`
          : '';
      return `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${fill}"/>${mast}${lit}`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${base}" viewBox="0 0 ${TILE} ${base}">${shapes}</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

const FAR_IMAGE = skyline(FAR, '#d9e5f4', false);
const NEAR_IMAGE = skyline(NEAR, '#bfd2ea', true);

function Cloud({ className, width }) {
  return (
    <svg className={`st-cloud ${className}`} viewBox="0 0 220 70" width={width} aria-hidden="true">
      <path
        d="M20 58Q2 58 4 42Q6 28 24 30Q28 10 52 12Q70 0 90 14Q110 4 128 20Q150 8 164 28Q196 24 200 46Q204 60 184 58Z"
        fill="#fff"
      />
    </svg>
  );
}

/** Bright morning platform with the one incoming train. */
export function PlatformScene({ inView, arrived, onArrive }) {
  const reduce = useReducedMotion();
  return (
    <div className="st-platform" aria-hidden="true">
      <span className="st-sun" />
      <Cloud className="st-cloud-a" width={200} />
      <Cloud className="st-cloud-b" width={150} />
      <Cloud className="st-cloud-c" width={260} />
      <div className="st-skyline st-skyline-far" style={{ backgroundImage: FAR_IMAGE }} />
      <div className="st-skyline st-skyline-near" style={{ backgroundImage: NEAR_IMAGE }} />
      <m.div
        className="st-platform-train"
        initial={reduce ? false : { x: '-112%' }}
        animate={{ x: reduce || inView ? 0 : '-112%' }}
        transition={{ duration: reduce ? 0 : 2.6, ease: [0.16, 1, 0.3, 1] }}
        onAnimationComplete={() => inView && onArrive()}
      >
        <RealisticTrain
          id="platform-train"
          doorsOpen={reduce || arrived}
          moving={inView && !arrived && !reduce}
        />
      </m.div>
      <div className="st-platform-edge" />
      <div className="st-rails st-rails-light" />
    </div>
  );
}
