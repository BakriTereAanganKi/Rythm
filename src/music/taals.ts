export type Stroke = 'na' | 'tin' | 'tun' | 'ti' | 'ge' | 'ka';

export interface Taal {
  id: string;
  name: string;
  matras: number;
  /** Size of each vibhag (section). */
  vibhags: number[];
  /** Mark shown at the start of each vibhag: X = sam, 0 = khali, numbers = taali. */
  marks: string[];
  /** One entry per matra. Several bols in one matra are space separated; "-" is a rest. */
  theka: string[];
  /** Bhajan / light taals get automatic manjira. */
  bhajan?: boolean;
  range: [number, number];
  bpm: number;
}

const t = (
  id: string, name: string, vibhags: number[], marks: string[], theka: string[],
  bpm: number, range: [number, number], bhajan = false,
): Taal => ({ id, name, matras: theka.length, vibhags, marks, theka, bpm, range, bhajan });

export const TAALS: Taal[] = [
  t('teentaal', 'Teentaal', [4, 4, 4, 4], ['X', '2', '0', '3'],
    ['Dha', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Tin', 'Tin', 'Ta', 'Ta', 'Dhin', 'Dhin', 'Dha'],
    125, [20, 700]),
  t('ektaal', 'Ektaal', [2, 2, 2, 2, 2, 2], ['X', '0', '2', '0', '3', '4'],
    ['Dhin', 'Dhin', 'Dha Ge', 'Ti Ra Ki Ta', 'Tu', 'Na', 'Kat', 'Ta', 'Dha Ge', 'Ti Ra Ki Ta', 'Dhi', 'Na'],
    90, [10, 500]),
  t('jhaptaal', 'Jhaptaal', [2, 3, 2, 3], ['X', '2', '0', '3'],
    ['Dhi', 'Na', 'Dhi', 'Dhi', 'Na', 'Ti', 'Na', 'Dhi', 'Dhi', 'Na'],
    120, [30, 500], true),
  t('rupak', 'Rupak', [3, 2, 2], ['0', '1', '2'],
    ['Tin', 'Tin', 'Na', 'Dhi', 'Na', 'Dhi', 'Na'],
    120, [30, 500], true),
  t('keherva', 'Keherva', [4, 4], ['X', '0'],
    ['Dha', 'Ge', 'Na', 'Ti', 'Na', 'Ka', 'Dhi', 'Na'],
    140, [40, 500], true),
  t('dadra', 'Dadra', [3, 3], ['X', '0'],
    ['Dha', 'Dhi', 'Na', 'Dha', 'Ti', 'Na'],
    150, [40, 500], true),
  t('jhoomra', 'Jhoomra', [3, 4, 3, 4], ['X', '2', '0', '3'],
    ['Dhin', '- Dha', 'Ti Ra Ki Ta', 'Dhin', 'Dhin', 'Dha Ge', 'Ti Ra Ki Ta', 'Tin', '- Ta', 'Ti Ra Ki Ta', 'Dhin', 'Dhin', 'Dha Ge', 'Ti Ra Ki Ta'],
    50, [15, 200]),
  t('tilwada', 'Tilwada', [4, 4, 4, 4], ['X', '2', '0', '3'],
    ['Dha', 'Ti Ra Ki Ta', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Tin', 'Tin', 'Ta', 'Ti Ra Ki Ta', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Dhin', 'Dhin'],
    50, [15, 200]),
  t('ada-chautaal', 'Ada Chautaal', [2, 2, 2, 2, 2, 2, 2], ['X', '2', '0', '3', '0', '4', '0'],
    ['Dhin', 'Ti Ra Ki Ta', 'Dhi', 'Na', 'Tu', 'Na', 'Kat', 'Ta', 'Ti Ra Ki Ta', 'Dhi', 'Na', 'Dhi', 'Dhi', 'Na'],
    100, [20, 500]),
  t('deepchandi', 'Deepchandi', [3, 4, 3, 4], ['X', '2', '0', '3'],
    ['Dha', 'Dhin', '-', 'Dha', 'Dha', 'Tin', '-', 'Ta', 'Tin', '-', 'Dha', 'Dha', 'Dhin', '-'],
    110, [30, 400], true),
  t('punjabi', 'Punjabi / Addha', [4, 4, 4, 4], ['X', '2', '0', '3'],
    ['Dha', '- Dhin', '- Ka', 'Dha', 'Dha', '- Dhin', '- Ka', 'Dha', 'Dha', '- Tin', '- Ka', 'Ta', 'Ta', '- Dhin', '- Ka', 'Dha'],
    100, [30, 400], true),
  t('jat', 'Jat Taal', [4, 4, 4, 4], ['X', '2', '0', '3'],
    ['Dha', '-', 'Dhin', '-', 'Dha', 'Dha', 'Tin', '-', 'Ta', '-', 'Tin', '-', 'Dha', 'Dha', 'Dhin', '-'],
    110, [30, 400], true),
  t('bhajani', 'Bhajani', [4, 4], ['X', '0'],
    ['Dhin', '- Na', 'Dhin', 'Dhin Na', 'Tin', '- Na', 'Dhin', 'Dhin Na'],
    140, [40, 400], true),
  t('chautaal', 'Chautaal', [2, 2, 2, 2, 2, 2], ['X', '0', '2', '0', '3', '4'],
    ['Dha', 'Dha', 'Din', 'Ta', 'Ki Ta', 'Dha', 'Din', 'Ta', 'Ti Ta', 'Ka Ta', 'Ga Di', 'Ga Na'],
    110, [30, 500]),
  t('dhamar', 'Dhamar', [5, 2, 3, 4], ['X', '2', '0', '3'],
    ['Ka', 'Dhi', 'Ta', 'Dhi', 'Ta', 'Dha', '-', 'Ga', 'Ti', 'Ta', 'Ti', 'Ta', 'Ta', '-'],
    90, [30, 300]),
  t('sooltaal', 'Sooltaal', [2, 2, 2, 2, 2], ['X', '0', '2', '3', '0'],
    ['Dha', 'Dha', 'Din', 'Ta', 'Ki Ta', 'Dha', 'Ti Ta', 'Ka Ta', 'Ga Di', 'Ga Na'],
    110, [30, 500]),
  t('teevra', 'Teevra', [3, 2, 2], ['X', '2', '3'],
    ['Dha', 'Din', 'Ta', 'Ti Ta', 'Ka Ta', 'Ga Di', 'Ga Na'],
    120, [30, 500]),
];

export const TAAL_BY_ID: Record<string, Taal> = Object.fromEntries(TAALS.map((x) => [x.id, x]));
export const getTaal = (id: string) => TAAL_BY_ID[id] ?? TAALS[0];

/** Vibhag info for matra index m (0-based). */
export function vibhagAt(taal: Taal, m: number) {
  let start = 0;
  for (let g = 0; g < taal.vibhags.length; g++) {
    const size = taal.vibhags[g];
    if (m < start + size) return { group: g, start: m === start, mark: taal.marks[g] };
    start += size;
  }
  return { group: 0, start: false, mark: '' };
}

const BOLS: Record<string, Stroke[]> = {
  dha: ['na', 'ge'], dhin: ['tin', 'ge'], dhi: ['tin', 'ge'], din: ['tin', 'ge'], di: ['tin', 'ge'],
  ta: ['na'], na: ['na'], tin: ['tin'], ti: ['ti'], te: ['ti'], ra: ['ti'], re: ['ti'],
  tu: ['tun'], tun: ['tun'],
  ge: ['ge'], ga: ['ge'], gi: ['ge'], ghe: ['ge'],
  ka: ['ka'], ke: ['ka'], ki: ['ka'], kat: ['ka'],
};
export const bolStrokes = (bol: string): Stroke[] => BOLS[bol.toLowerCase()] ?? [];

export function layaName(bpm: number) {
  if (bpm < 30) return 'Ati-Vilambit';
  if (bpm < 70) return 'Vilambit';
  if (bpm < 160) return 'Madhya';
  if (bpm < 320) return 'Drut';
  return 'Ati-Drut';
}

export const displayBol = (matra: string) =>
  matra.split(/\s+/).map((b) => (b === '-' ? '–' : b)).join('');
