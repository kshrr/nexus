/** Six original editorial illustrations, not generic icon replacements. */
export function RiasecIllustration({ letter }) {
  const colors = {
    R: '#bd6c47',
    I: '#66838f',
    A: '#bd7d82',
    S: '#85967c',
    E: '#ce9b50',
    C: '#83909b',
  };
  return (
    <svg
      viewBox="0 0 240 160"
      className="rail-interest-art"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="122" cy="78" r="65" fill="#eee8da" />
      <path d="M20 143h202M30 149h28m11 0h105m11 0h26" stroke="#bbc0b3" strokeWidth="2" />
      <path d="M28 44h25m-12-12v24m159-22h16m-8-8v16" stroke="#d4c7af" strokeWidth="2" />
      <g stroke="#24344b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {letter === 'R' && (
          <>
            <path d="M32 129h103v13H32z" fill="#cad0c5" />
            <circle cx="57" cy="140" r="9" fill="#24344b" />
            <circle cx="111" cy="140" r="9" fill="#24344b" />
            <path d="M46 129v-26h73v26M66 103V85h33v18" fill="#fffaf0" />
            <path d="M59 113h47m-41 7h33" />
            <path d="m115 64 16-16 14 14-16 16-5-5-29 28-7-7 29-28z" fill="#d8b16c" />
            <circle cx="163" cy="61" r="13" fill="#e7bf9d" />
            <path d="M149 57c0-19 28-19 29 0h-29" fill="#d8b16c" />
            <path d="M151 78h26l9 41h-43z" fill={colors.R} />
            <path d="m155 119-5 23m22-23 7 23m-28-54-19-11m44 11 10 23" />
          </>
        )}
        {letter === 'I' && (
          <>
            <path d="M43 118h146m-132 0v25m119-25v25" />
            <path d="M61 117h49m-42-7h33l-8-36m-10-3 16-8 5 11-16 8z" fill="#fffaf0" />
            <path d="m86 85-10 13m-10 3h29" />
            <circle cx="159" cy="58" r="13" fill="#e7bf9d" />
            <path d="M146 55c1-16 25-16 26 0" fill="#24344b" />
            <path d="M145 76h27l9 43h-45z" fill={colors.I} />
            <path d="m147 91-26 8m47-9 17 19m-42 11 3 24m22-24 4 24" />
            <circle cx="113" cy="42" r="15" fill="#fffaf0" />
            <path d="m101 53-14 14m18-31h16m-8-8v16" />
          </>
        )}
        {letter === 'A' && (
          <>
            <path d="m44 143 22-103 25 103m-43-25h36" />
            <path d="M39 43h60v70H39z" fill="#fffaf0" />
            <path d="m48 94 18-32 23 37" stroke="#bd7d82" strokeWidth="5" />
            <circle cx="78" cy="59" r="7" fill="#d8b16c" stroke="none" />
            <circle cx="152" cy="59" r="13" fill="#e7bf9d" />
            <path d="M139 54c1-15 26-16 28 3" fill="#24344b" />
            <path d="M140 77h26l9 41h-44z" fill={colors.A} />
            <path d="m141 91-32-7m53 6 9 15m-32 13-1 24m23-24 11 24" />
            <path d="m98 70 15 19" stroke="#d8b16c" strokeWidth="4" />
            <ellipse cx="181" cy="105" rx="19" ry="13" fill="#fffaf0" />
            <circle cx="174" cy="103" r="3" fill="#c7503f" stroke="none" />
            <circle cx="186" cy="101" r="3" fill="#66838f" stroke="none" />
          </>
        )}
        {letter === 'S' && (
          <>
            <path d="M87 33h107v58H87z" fill="#fffaf0" />
            <path d="M104 51h49m-49 12h66m-66 12h27" stroke="#85967c" />
            <circle cx="59" cy="72" r="12" fill="#e7bf9d" />
            <path d="M47 69c1-15 23-15 24 0" fill="#24344b" />
            <path d="M47 89h25l6 29H40z" fill={colors.S} />
            <path d="m68 96 28-13m-46 35-4 24m20-24 5 24" />
            <circle cx="144" cy="108" r="11" fill="#e7bf9d" />
            <path d="M134 104c0-13 21-13 22 0" fill="#24344b" />
            <path d="M132 120h24l8 23h-40z" fill="#66838f" />
            <path d="M91 116h26v18H91z" fill="#fffaf0" />
            <path d="M104 117v16m-9-11h5m8 0h5" />
          </>
        )}
        {letter === 'E' && (
          <>
            <path d="M113 38h81v63h-81z" fill="#fffaf0" />
            <path d="M126 85V70m17 15V59m17 26V48m17 37V57" stroke="#ce9b50" strokeWidth="7" />
            <circle cx="64" cy="67" r="13" fill="#e7bf9d" />
            <path d="M51 63c0-16 26-16 26 0" fill="#24344b" />
            <path d="M52 84h26l10 36H45z" fill={colors.E} />
            <path d="m76 91 30-8m-51 37-4 22m25-22 9 22" />
            <path d="m84 43 27-8v29l-27-8z" fill="#c7503f" />
            <path d="M77 45h7v10h-7zM93 58v14h8V61m17-13h9m-10-12 7-5" />
          </>
        )}
        {letter === 'C' && (
          <>
            <path d="M35 119h163m-148 0v24m133-24v24" />
            <path d="M41 89h58v29H41z" fill="#fffaf0" />
            <path d="M48 89V73h18l5 5h20v11" fill="#d8b16c" />
            <path d="M42 97h54m-51 8h50" />
            <circle cx="146" cy="63" r="12" fill="#e7bf9d" />
            <path d="M134 58c2-14 23-14 24 1" fill="#24344b" />
            <path d="M134 80h25l10 39h-44z" fill={colors.C} />
            <path d="m136 95-21 13m41-13 16 14m-40 10 2 24m24-24 6 24" />
            <rect x="103" y="104" width="25" height="14" fill="#fffaf0" />
            <path d="M107 108h16m-16 4h12" />
            <circle cx="190" cy="47" r="18" fill="#fffaf0" />
            <path d="M190 36v11l8 4" />
          </>
        )}
      </g>
    </svg>
  );
}
