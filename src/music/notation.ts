export type Notation = 'indian' | 'western';

export const WESTERN = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const SWARA = ['Sa', 'Re', 'Re', 'Ga', 'Ga', 'Ma', 'Ma', 'Pa', 'Dha', 'Dha', 'Ni', 'Ni'];
export const SWARA_LONG = [
  'Sa', 'Komal Re', 'Re', 'Komal Ga', 'Ga', 'Ma', 'Tivra Ma', 'Pa', 'Komal Dha', 'Dha', 'Komal Ni', 'Ni',
];
/** Harmonium scale names used by Indian musicians (C = Safed 1, C♯ = Kali 1 …). */
export const HARMONIUM = [
  'Safed 1', 'Kali 1', 'Safed 2', 'Kali 2', 'Safed 3', 'Safed 4', 'Kali 3', 'Safed 5', 'Kali 4', 'Safed 6', 'Kali 5', 'Safed 7',
];
/** Bhatkhande-style single letter codes, index = semitones above Sa. */
export const CODES = 'SrRgGmMPdDnN';

/** Sa can be tuned from A2 to E4. */
export const SA_MIN = 45;
export const SA_MAX = 64;

export const mod12 = (n: number) => ((n % 12) + 12) % 12;
export const isKomal = (pc: number) => pc === 1 || pc === 3 || pc === 8 || pc === 10;
export const isTivra = (pc: number) => pc === 6;

export const midiFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const freqMidi = (f: number) => 69 + 12 * Math.log2(f / 440);
export const midiName = (m: number, octave = true) =>
  WESTERN[mod12(Math.round(m))] + (octave ? String(Math.floor(Math.round(m) / 12) - 1) : '');

/** Frequency of a note `semi` semitones above Sa (negative = lower octave). */
export const semiHz = (saMidi: number, cents: number, semi: number) => midiFreq(saMidi + semi + cents / 100);

export function parseNotes(codes: string): number[] {
  const set = new Set<number>();
  for (const c of codes.replace(/\s/g, '')) {
    const i = CODES.indexOf(c);
    if (i >= 0) set.add(i);
  }
  set.add(0);
  return [...set].sort((a, b) => a - b);
}

/** Plain-text note name (for places where styled labels can't be used). */
export function noteText(semi: number, notation: Notation, saMidi: number, octave = false) {
  if (notation === 'western') return midiName(saMidi + semi, octave);
  return SWARA_LONG[mod12(semi)];
}

/** Swar mandal strings: every raag note from mandra Pa up to taar Pa. */
export function mandalStrings(notes: number[]): number[] {
  const out: number[] = [];
  for (let s = -5; s <= 19; s++) if (notes.includes(mod12(s))) out.push(s);
  return out;
}
