import { parseNotes } from './notation';
import type { Preset } from '../store';

/**
 * Raag → swaras used (union of aroha/avaroha), in codes:
 * S r R g G m M P d D n N  (lowercase = komal, M = tivra Ma).
 * Edit freely — tanpura tuning and swar mandal strings are derived from this.
 */
const RAAGS: [string, string][] = [
  ['Abhogi', 'S R g m D'],
  ['Adana', 'S R g m P d n N'],
  ['Ahir Bhairav', 'S r G m P D n'],
  ['Alhaiya Bilawal', 'S R G m P D n N'],
  ['Asavari', 'S R g m P d n'],
  ['Asavari (Komal Rishabh)', 'S r g m P d n'],
  ['Bageshri', 'S R g m P D n'],
  ['Bahar', 'S R g m P D n N'],
  ['Bairagi', 'S r m P n'],
  ['Barwa', 'S R g G m P D n N'],
  ['Basant', 'S r G m M P d N'],
  ['Basant Mukhari', 'S r G m P d n'],
  ['Bhairav', 'S r G m P d N'],
  ['Bhairavi', 'S r g m P d n'],
  ['Bhatiyar', 'S r G m M P D N'],
  ['Bhimpalasi', 'S R g m P D n'],
  ['Bhinna Shadja', 'S G m D N'],
  ['Bhupali', 'S R G P D'],
  ['Bhupal Todi', 'S r g P d'],
  ['Bihag', 'S R G m M P D N'],
  ['Bilaskhani Todi', 'S r g m P d n'],
  ['Bilawal', 'S R G m P D N'],
  ['Brindavani Sarang', 'S R m P n N'],
  ['Chandrakauns', 'S g m d N'],
  ['Charukeshi', 'S R G m P d n'],
  ['Chhayanat', 'S R G m M P D N'],
  ['Darbari Kanada', 'S R g m P d n'],
  ['Des', 'S R G m P D n N'],
  ['Deshkar', 'S R G P D'],
  ['Desi', 'S R g m P D n'],
  ['Dhani', 'S g m P n'],
  ['Dhanashree', 'S R g m P D n'],
  ['Durga', 'S R m P D'],
  ['Gara', 'S R g G m P D n N'],
  ['Gaud Malhar', 'S R G m P D n N'],
  ['Gaud Sarang', 'S R G m M P D N'],
  ['Gavati', 'S R G m P n'],
  ['Gorakh Kalyan', 'S R m P D n'],
  ['Gujari Todi', 'S r g M d N'],
  ['Gunakali', 'S r m P d'],
  ['Hamir', 'S R G m M P D N'],
  ['Hamsadhwani', 'S R G P N'],
  ['Hindol', 'S G M D N'],
  ['Jaijaiwanti', 'S R g G m P D n N'],
  ['Janasammohini', 'S R G P D n'],
  ['Jaunpuri', 'S R g m P d n'],
  ['Jhinjhoti', 'S R G m P D n'],
  ['Jog', 'S g G m P n'],
  ['Jogiya', 'S r m P d N'],
  ['Jogkauns', 'S g G m d n'],
  ['Kafi', 'S R g m P D n'],
  ['Kalavati', 'S G P D n'],
  ['Kalingada', 'S r G m P d N'],
  ['Kalyan', 'S R G M P D N'],
  ['Kamod', 'S R G m M P D N'],
  ['Kaunsi Kanada', 'S R g m P d n'],
  ['Kaushik Dhwani', 'S G m D N'],
  ['Kedar', 'S R G m M P D N'],
  ['Khamaj', 'S R G m P D n N'],
  ['Kirwani', 'S R g m P d N'],
  ['Lalit', 'S r G m M d N'],
  ['Madhukauns', 'S g M P n'],
  ['Madhmad Sarang', 'S R m P n'],
  ['Madhuvanti', 'S R g M P D N'],
  ['Malgunji', 'S R g G m P D n'],
  ['Malkauns', 'S g m d n'],
  ['Mand', 'S R G m P D N'],
  ['Manj Khamaj', 'S R g G m P D n N'],
  ['Maru Bihag', 'S R G m M P D N'],
  ['Marwa', 'S r G M D N'],
  ['Megh', 'S R m P n'],
  ['Miyan Malhar', 'S R g m P D n N'],
  ['Miyan ki Todi', 'S r g M P d N'],
  ['Mishra Pilu', 'S R g G m P d D n N'],
  ['Multani', 'S r g M P d N'],
  ['Nand', 'S R G m M P D N'],
  ['Nat Bhairav', 'S R G m P d N'],
  ['Nayaki Kanada', 'S R g m P n'],
  ['Pahadi', 'S R G m P D n N'],
  ['Paraj', 'S r G m M P d N'],
  ['Patdeep', 'S R g m P D N'],
  ['Pilu', 'S R g G m P d D n N'],
  ['Puriya', 'S r G M D N'],
  ['Puriya Dhanashree', 'S r G M P d N'],
  ['Puriya Kalyan', 'S r G M P D N'],
  ['Purvi', 'S r G m M P d N'],
  ['Rageshri', 'S R G m D n'],
  ['Ramkali', 'S r G m M P d n N'],
  ['Saraswati', 'S R M P D n'],
  ['Shahana', 'S R G m P D n N'],
  ['Shankara', 'S R G P D N'],
  ['Shivranjani', 'S R g P D'],
  ['Shree', 'S r G M P d N'],
  ['Shuddh Kalyan', 'S R G M P D N'],
  ['Shuddh Sarang', 'S R m M P D N'],
  ['Shyam Kalyan', 'S R G m M P D N'],
  ['Sindh Bhairavi', 'S r R g G m P d D n N'],
  ['Sindhura', 'S R g m P D n'],
  ['Sohni', 'S r G M D N'],
  ['Sur Malhar', 'S R m P D n N'],
  ['Tilak Kamod', 'S R G m P D n N'],
  ['Tilang', 'S G m P n N'],
  ['Todi', 'S r g M P d N'],
  ['Vibhas', 'S r G P d'],
  ['Yaman', 'S R G M P D N'],
  ['Yaman Kalyan', 'S R G m M P D N'],
];

/** First tanpura string: Pa if present, otherwise Ma, Dha, Ni… */
function pickT1(n: number[]): number {
  for (const c of [7, 5, 9, 11, 8, 10, 6]) if (n.includes(c)) return c;
  return 7;
}
function pickT2(n: number[], t1: number): number | null {
  for (const c of [11, 10, 9, 8, 5, 4, 3]) if (c !== t1 && n.includes(c)) return c;
  return null;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const RAAG_PRESETS: Preset[] = RAAGS.map(([name, codes]) => {
  const notes = parseNotes(codes);
  const t1 = pickT1(notes);
  return { id: 'raag-' + slug(name), name, builtin: true, t1, t2: pickT2(notes, t1), taalId: 'teentaal', bpm: 125, notes };
});
