import umpsa from '@/assets/university-logos/umpsa.webp';
import universitiMalaya from '@/assets/university-logos/universiti-malaya.webp';
import inti from '@/assets/university-logos/inti.webp';
import mmu from '@/assets/university-logos/mmu.webp';
import sunwayCollege from '@/assets/university-logos/sunway-college.webp';
import sunwayUniversity from '@/assets/university-logos/sunway-university.webp';
import taylorsCollege from '@/assets/university-logos/taylors-college.webp';
import taylorsUniversity from '@/assets/university-logos/taylors-university.webp';
import unisza from '@/assets/university-logos/unisza.webp';
import utem from '@/assets/university-logos/utem.webp';
import utm from '@/assets/university-logos/utm.webp';

/**
 * Universities with a logo on the landing page. `x`/`y` place the pin on the 920x480 map
 * (projected from the campus latitude and longitude; approximate). `dx` nudges a Klang Valley pin
 * sideways when the map is zoomed in there, so logos stay near their campus without overlapping.
 */
export const KLANG = { x: 182, y: 292.5, radius: 20 };

export const universities = [
  {
    id: 'um',
    name: 'Universiti Malaya',
    logo: universitiMalaya,
    state: 'W.P. Kuala Lumpur',
    x: 180.2,
    y: 283.4,
    cluster: true,
    match: /universiti malaya|university of malaya/i,
  },
  {
    id: 'sunway-university',
    name: 'Sunway University',
    logo: sunwayUniversity,
    state: 'Selangor',
    x: 176.9,
    y: 287,
    dx: -5.4,
    cluster: true,
    match: /sunway university/i,
  },
  {
    id: 'sunway-college',
    name: 'Sunway College',
    logo: sunwayCollege,
    state: 'Selangor',
    x: 177.6,
    y: 288.6,
    dx: -1.4,
    cluster: true,
    match: /sunway college/i,
  },
  {
    id: 'taylors-university',
    name: "Taylor's University",
    logo: taylorsUniversity,
    state: 'Selangor',
    x: 181.5,
    y: 287.4,
    dx: -0.6,
    cluster: true,
    match: /taylor.?s university/i,
  },
  {
    id: 'taylors-college',
    name: "Taylor's College",
    logo: taylorsCollege,
    state: 'Selangor',
    x: 180.4,
    y: 288.9,
    dx: 5.2,
    cluster: true,
    match: /taylor.?s college/i,
  },
  {
    id: 'mmu',
    name: 'Multimedia University',
    logo: mmu,
    state: 'Selangor',
    x: 179.4,
    y: 296.2,
    cluster: true,
    match: /multimedia university/i,
  },
  {
    id: 'inti',
    name: 'INTI International University',
    logo: inti,
    state: 'Negeri Sembilan',
    x: 189.4,
    y: 303.3,
    cluster: true,
    match: /\binti\b/i,
  },
  {
    id: 'utm',
    name: 'Universiti Teknologi Malaysia',
    logo: utm,
    state: 'Johor',
    x: 309.7,
    y: 385.5,
    match: /teknologi malaysia/i,
  },
  {
    id: 'utem',
    name: 'Universiti Teknikal Malaysia Melaka',
    logo: utem,
    state: 'Melaka',
    x: 223.5,
    y: 336.6,
    match: /teknikal malaysia/i,
  },
  {
    id: 'umpsa',
    name: 'Universiti Malaysia Pahang Al-Sultan Abdullah',
    logo: umpsa,
    state: 'Pahang',
    x: 276.4,
    y: 245.1,
    match: /malaysia pahang/i,
  },
  {
    id: 'unisza',
    name: 'Universiti Sultan Zainal Abidin',
    logo: unisza,
    state: 'Terengganu',
    x: 273.8,
    y: 136.1,
    match: /sultan zainal abidin/i,
  },
];

/** Logo for a catalogue university name, if we have one. */
export function logoFor(name) {
  return universities.find((university) => university.match.test(name ?? ''))?.logo ?? null;
}
