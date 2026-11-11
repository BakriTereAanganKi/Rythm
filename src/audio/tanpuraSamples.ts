/**
 * The user's full tanpura recordings (licensed), one per scale, all Pa tuning — streamed whole
 * (≈20 min each) rather than looped, at native pitch with only fine-tune cents applied.
 * "Tanpura (all scales)" by Amitava Sarkar / MUSIFINE, and "Tanpura (F# Scale)" by Nawaraj Khatri.
 *
 * `sa` = measured Sa (Hz); `start` = where the playing begins (s); `end` = where the closing fade
 * begins (s) — the app crossfades back to the start there; `gain` evens out loudness between tracks.
 */
export interface TanpuraSample {
  id: string;
  file: string;
  title: string;
  by: string;
  /** First-string tuning: 7 = Pa (semitones above Sa). */
  first: 7 | 5;
  sa: number;
  start: number;
  end: number;
  gain: number;
}

const MUSIFINE = 'Amitava Sarkar, MUSIFINE';
const rec = (id: string, key: string, sa: number, start: number, end: number, gain: number, by = MUSIFINE, title = `${key} Scale Tanpura`): TanpuraSample => ({
  id, file: `tanpura-full/${id}.mp3`, title, by, first: 7, sa, start, end, gain,
});

export const TANPURA_SAMPLES: TanpuraSample[] = [
  rec('Ds3', 'D#', 155.92, 0.75, 1196.52, 0.841),
  rec('E3', 'E', 165.24, 0.75, 1197.52, 0.75),
  rec('F3', 'F', 174.96, 0.5, 1196.27, 0.804),
  rec('Fs3', 'F#', 185.0, 18, 1819.56, 1.288, 'Nawaraj Khatri', 'Tanpura (F# Scale)'),
  rec('G3', 'G', 196.4, 0.25, 1197.77, 0.776),
  rec('Gs3', 'G#', 208.07, 0.25, 1197.52, 0.767),
  rec('A3', 'A', 220.51, 0.25, 1197.52, 0.822),
  rec('As3', 'A#', 233.62, 0.25, 1197.27, 0.776),
  rec('B3', 'B', 247.58, 0.5, 1196.52, 0.804),
  rec('C4', 'C', 262.08, 0.5, 1197.77, 0.902),
  rec('Cs4', 'C#', 277.82, 0.5, 1198.02, 0.776),
  rec('D4', 'D', 294.17, 0.5, 1197.02, 0.841),
];

export const sampleUrl = (s: TanpuraSample) => `/${s.file}`;

/**
 * Recording for a first-string tuning at a given Sa: the one in the same scale (pitch class),
 * whatever its octave — e.g. Sa = C#3 plays the "C# Scale" recording. Null if no recording exists.
 */
export function pickSample(first: number | null, saHz: number): TanpuraSample | null {
  const c = TANPURA_SAMPLES.filter((s) => s.first === first);
  if (!c.length) return null;
  const centsOff = (s: TanpuraSample) => {
    const d = (((1200 * Math.log2(saHz / s.sa)) % 1200) + 1800) % 1200 - 600; // distance within an octave
    return Math.abs(d);
  };
  return c.reduce((a, b) => (centsOff(b) < centsOff(a) ? b : a));
}

/** Playback rate for a recording: same octave as recorded, corrected only by the cents difference. */
export function sampleRate(s: TanpuraSample, saHz: number): number {
  const target = saHz * Math.pow(2, Math.round(Math.log2(s.sa / saHz)));
  return target / s.sa;
}

/**
 * Single acoustic tanpura strings (one pluck each) by luckylittleraven on Freesound, CC0 —
 * a tanpura tuned to C# (https://freesound.org/people/luckylittleraven/packs/23512/).
 * Used for any tuning without a full recording: every string is a real pluck, retuned.
 * `semi` = position relative to this tanpura's Sa (C#3); `f` = measured pitch in Hz.
 */
export interface StringSample { file: string; semi: number; f: number; title: string; source: string }

export const STRING_SAMPLES: StringSample[] = [
  { file: 'strings/kharaj-Cs2.wav', semi: -12, f: 69.3, title: 'Tanpura note Low C sharp', source: 'https://freesound.org/s/416597/' },
  { file: 'strings/pa-Gs2.wav', semi: -5, f: 103.65, title: 'Tanpura note G sharp', source: 'https://freesound.org/s/416598/' },
  { file: 'strings/dha-As2.wav', semi: -3, f: 116.34, title: 'Tanpura note A sharp', source: 'https://freesound.org/s/416606/' },
  { file: 'strings/sa-Cs3.wav', semi: 0, f: 138.27, title: 'Tanpura note C sharp', source: 'https://freesound.org/s/416605/' },
];

export const stringUrl = (s: StringSample) => `/tanpura/${s.file}`;

/**
 * Which recorded string to use for a string `semi` semitones from Sa, and its playback rate.
 * The string set is moved by whole octaves to stay within ±6 semitones of the recorded
 * register, so retuning never sounds chipmunked (high Sa → strings an octave lower).
 */
export function stringFor<T extends { semi: number; f: number }>(samples: T[], semi: number, saHz: number) {
  const base = 138.27;
  const reg = saHz * Math.pow(2, -Math.round(Math.log2(saHz / base)));
  const s = samples.reduce((a, b) => (Math.abs(semi - b.semi) < Math.abs(semi - a.semi) ? b : a));
  return { sample: s, rate: (reg * Math.pow(2, semi / 12)) / s.f };
}
