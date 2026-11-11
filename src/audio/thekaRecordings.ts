/**
 * Real theka recordings, cut into one slice per matra (so they follow any tempo and retune to Sa).
 * Each slice = [offset in file (s), natural length up to the next matra (s), total length incl. the
 * stroke's WSOLA-extended ring (s)] — the ring lets slower tempos sound natural instead of choked.
 *
 * Teentaal: "Tabla Teentaal with Baya" by tablage on Freesound (https://freesound.org/s/525154/),
 * CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Recorded at ~186 bpm, 2 cycles.
 * Changes: cut per matra, ring extended, retuned.
 */
export interface ThekaRecording {
  taalId: string;
  file: string;
  /** Tempo of the original performance. */
  bpm: number;
  /** Measured dayan pitch (Hz) — retuned to the user's Sa at playback. */
  dayan: number;
  cycles: number;
  slices: [number, number, number][];
  title: string;
  source: string;
}

export const THEKA_RECORDINGS: ThekaRecording[] = [
  {
    taalId: 'teentaal',
    file: 'theka/teentaal.wav',
    bpm: 185.54,
    dayan: 268.7,
    cycles: 2,
    title: 'Tabla Teentaal with Baya (tablage)',
    source: 'https://freesound.org/s/525154/',
    slices: [
    [0, 0.31701, 1.70537],
    [1.71537, 0.33, 1.71837],
    [3.44374, 0.33701, 1.72537],
    [5.17912, 0.32302, 1.71138],
    [6.9005, 0.329, 1.71737],
    [8.62787, 0.33, 1.71837],
    [10.35624, 0.31501, 1.70338],
    [12.06961, 0.32499, 1.71336],
    [13.79297, 0.32701, 1.71537],
    [15.51834, 0.33501, 1.72338],
    [17.25172, 0.30701, 1.69537],
    [18.9571, 0.33, 1.71837],
    [20.68546, 0.3, 1.68837],
    [22.38383, 0.30701, 1.69537],
    [24.08921, 0.33501, 1.72338],
    [25.82259, 0.28701, 1.67537],
    [27.50796, 0.35, 1.73837],
    [29.25633, 0.302, 1.69036],
    [30.95669, 0.33, 1.71837],
    [32.68506, 0.29399, 1.68236],
    [34.37741, 0.358, 1.74637],
    [36.13379, 0.29701, 1.68537],
    [37.82916, 0.33701, 1.72537],
    [39.56454, 0.308, 1.69637],
    [41.27091, 0.321, 1.70937],
    [42.99027, 0.348, 1.73637],
    [44.73664, 0.3, 1.68837],
    [46.43501, 0.33, 1.71837],
    [48.16338, 0.309, 1.69737],
    [49.87075, 0.3, 1.68837],
    [51.56912, 0.33501, 1.72338],
    [53.30249, 0.331, 1.71937],
    ],
  },
];

export const thekaFor = (taalId: string) => THEKA_RECORDINGS.find((r) => r.taalId === taalId) ?? null;
