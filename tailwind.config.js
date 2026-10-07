/** @type {import('tailwindcss').Config} */
// Design tokens are taken verbatim from docs/ui-specifications.md §0.3–0.5.
// Use only these values. Avoid arbitrary values (text-[17px]) outside genuine one-offs.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    // Deliberately small, fixed breakpoint set — NFR06 requires 375 and 1280;
    // 768 exists so tablets are not served a stretched phone layout.
    screens: {
      sm: '375px',
      md: '768px',
      lg: '1280px',
    },
    extend: {
      colors: {
        ink: {
          900: '#241F1A',
          700: '#4A423A',
          500: '#7A6F63',
          300: '#C4B9AC',
          100: '#E8E1D7',
        },
        paper: '#FAF7F2',
        surface: '#FFFFFF',
        pine: {
          900: '#12332A',
          700: '#1F4438',
          500: '#2F6A55',
          300: '#8DB7A4',
          100: '#DCE8E2',
          50: '#EFF6F2',
        },
        moss: '#8BAA78',
        lime: '#DDEB9D',
        cream: '#F4EBD9',
        sky: '#CBE4E2',
        lilac: '#DDD5EB',
        coral: '#EDB7A5',
        amber: {
          600: '#B26B00',
          100: '#FBEDD6',
        },
        rust: {
          600: '#A33A22',
          100: '#F8E2DC',
        },
        slate: {
          600: '#4B5A66',
          100: '#E3E8EC',
        },
        // RIASEC dimension colours — identity only, never used to carry meaning alone.
        riasec: {
          r: '#6B7F3E',
          i: '#2F6A55',
          a: '#8A4B7D',
          s: '#B26B00',
          e: '#A33A22',
          c: '#4B5A66',
        },
      },
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        hero: ['clamp(3.25rem, 7vw, 6.75rem)', { lineHeight: '0.94', fontWeight: '650', letterSpacing: '-0.045em' }],
        display: ['clamp(2.25rem, 4vw, 3.75rem)', { lineHeight: '1.02', fontWeight: '650', letterSpacing: '-0.035em' }],
        h1: ['30px', { lineHeight: '1.2', fontWeight: '600' }],
        h2: ['24px', { lineHeight: '1.25', fontWeight: '600' }],
        h3: ['20px', { lineHeight: '1.3', fontWeight: '600' }],
        h4: ['16px', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['16px', { lineHeight: '1.6' }],
        'body-sm': ['14px', { lineHeight: '1.55' }],
        caption: ['13px', { lineHeight: '1.45', fontWeight: '500' }],
      },
      spacing: {
        // 4px base scale: 4 8 12 16 24 32 48 64 96 (defaults cover most; add the gaps)
        18: '72px',
        22: '88px',
      },
      borderRadius: {
        input: '10px',
        card: '18px',
        modal: '24px',
        pill: '999px',
      },
      boxShadow: {
        overlay: '0 4px 16px rgba(36,31,26,0.10)',
        panel: '0 8px 32px rgba(36,31,26,0.14)',
        card: '0 14px 40px rgba(31,68,56,0.08)',
        lift: '0 18px 44px rgba(31,68,56,0.14)',
      },
      maxWidth: {
        prose: '68ch',
      },
      transitionTimingFunction: {
        'ease-out-fast': 'cubic-bezier(0, 0, 0.2, 1)',
      },
      transitionDuration: {
        120: '120ms',
        200: '200ms',
      },
    },
  },
  plugins: [],
};
