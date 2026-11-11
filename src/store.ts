import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Notation } from './music/notation';
import { getTaal } from './music/taals';

export const CHANNELS = ['tanpura1', 'tanpura2', 'tabla', 'manjira', 'surpeti', 'mandal', 'metronome'] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABEL: Record<Channel, string> = {
  tanpura1: 'Tanpura 1', tanpura2: 'Tanpura 2', tabla: 'Tabla', manjira: 'Manjira',
  surpeti: 'Sur-peti', mandal: 'Swar Mandal', metronome: 'Metronome',
};

export interface MixCh { vol: number; pan: number; mute: boolean }
export interface TanpuraCfg {
  /** First string, semitones above Sa (played in mandra saptak). null = tanpura off. */
  first: number | null;
  /** Optional extra (5th) string. */
  fifth: number | null;
  /** Seconds per full pluck cycle. */
  speed: number;
}
export type SurMode = 'P' | 'm' | 'N' | 'S';
export type Mode = 'tabla' | 'metronome';
export type Tab = 'play' | 'drone' | 'mandal' | 'presets' | 'more';

export interface Preset {
  id: string;
  name: string;
  builtin?: boolean;
  saMidi?: number;
  fineCents?: number;
  t1: number | null;
  t2: number | null;
  taalId: string;
  bpm: number;
  notes: number[];
  mode?: Mode;
}

export interface AppState {
  tab: Tab;
  notation: Notation;
  harmoniumNames: boolean;
  keepAwake: boolean;

  saMidi: number;
  fineCents: number;

  mode: Mode;
  taalId: string;
  bpm: number;
  metro: { beats: number; sub: number; accent: boolean };

  playing: boolean;
  rhythmOn: boolean;
  droneOn: boolean;

  tanpura: [TanpuraCfg, TanpuraCfg];
  /** Real recorded tanpura (Pa / Ma tunings) or the physical-model synth. */
  tanpuraSound: 'recorded' | 'modelled';
  /** Real recorded theka (where available) or stroke-by-stroke bols. */
  tablaSound: 'theka' | 'bols';
  surpeti: { on: boolean; mode: SurMode };
  manjiraOn: boolean;
  mandal: { notes: number[]; auto: boolean };

  mix: Record<Channel, MixCh>;
  master: number;
  eq: string;

  presetId: string | null;
  presetName: string;
  favorites: string[];
  custom: Preset[];

  set: (p: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;
}

const defaultMix = (): Record<Channel, MixCh> => ({
  tanpura1: { vol: 0.8, pan: -0.25, mute: false },
  tanpura2: { vol: 0.7, pan: 0.25, mute: false },
  tabla: { vol: 0.9, pan: 0, mute: false },
  manjira: { vol: 0.4, pan: 0.15, mute: false },
  surpeti: { vol: 0.35, pan: 0, mute: false },
  mandal: { vol: 0.6, pan: -0.1, mute: false },
  metronome: { vol: 0.8, pan: 0, mute: false },
});

export const DEFAULTS = {
  tab: 'play' as Tab,
  notation: 'indian' as Notation,
  harmoniumNames: true,
  keepAwake: true,
  saMidi: 49, // C#3
  fineCents: 0,
  mode: 'tabla' as Mode,
  taalId: 'teentaal',
  bpm: 125,
  metro: { beats: 4, sub: 1, accent: true },
  playing: false,
  rhythmOn: true,
  droneOn: true,
  tanpura: [
    { first: 7, fifth: null, speed: 4.6 },
    { first: null, fifth: null, speed: 5.2 },
  ] as [TanpuraCfg, TanpuraCfg],
  tanpuraSound: 'recorded' as 'recorded' | 'modelled',
  tablaSound: 'theka' as 'theka' | 'bols',
  surpeti: { on: false, mode: 'P' as SurMode },
  manjiraOn: true,
  mandal: { notes: [0, 2, 4, 5, 7, 9, 11], auto: false },
  mix: defaultMix(),
  master: 0.9,
  eq: 'Flat',
  presetId: null as string | null,
  presetName: 'Free practice',
  favorites: [] as string[],
  custom: [] as Preset[],
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (p) => set(p as Partial<AppState>),
    }),
    {
      name: 'rythm-state',
      version: 1,
      partialize: (s) => {
        const { playing: _p, set: _s, ...rest } = s;
        return rest;
      },
    },
  ),
);

export const update = (p: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => useStore.getState().set(p);

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function tempoRange(s: Pick<AppState, 'mode' | 'taalId'>): [number, number] {
  return s.mode === 'metronome' ? [20, 400] : getTaal(s.taalId).range;
}

export function setBpm(bpm: number) {
  const s = useStore.getState();
  const [lo, hi] = tempoRange(s);
  update({ bpm: Math.round(clamp(bpm, lo, hi)) });
}

export function setTaal(taalId: string) {
  const taal = getTaal(taalId);
  update((s) => ({ taalId, bpm: clamp(s.bpm, taal.range[0], taal.range[1]) }));
}

export function setTanpura(k: 0 | 1, patch: Partial<TanpuraCfg>) {
  update((s) => {
    const tanpura = [...s.tanpura] as [TanpuraCfg, TanpuraCfg];
    tanpura[k] = { ...tanpura[k], ...patch };
    return { tanpura };
  });
}

export function setMix(ch: Channel, patch: Partial<MixCh>) {
  update((s) => ({ mix: { ...s.mix, [ch]: { ...s.mix[ch], ...patch } } }));
}

export function applyPreset(p: Preset) {
  update((s) => ({
    presetId: p.id,
    presetName: p.name,
    tanpura: [{ ...s.tanpura[0], first: p.t1 }, { ...s.tanpura[1], first: p.t2 }],
    taalId: p.taalId,
    bpm: p.bpm,
    mode: p.mode ?? 'tabla',
    mandal: { ...s.mandal, notes: p.notes },
    ...(p.saMidi != null ? { saMidi: p.saMidi, fineCents: p.fineCents ?? 0 } : {}),
  }));
}

export function currentAsPreset(name: string, includeSa: boolean): Preset {
  const s = useStore.getState();
  return {
    id: 'my-' + Date.now().toString(36),
    name,
    t1: s.tanpura[0].first,
    t2: s.tanpura[1].first,
    taalId: s.taalId,
    bpm: s.bpm,
    mode: s.mode,
    notes: s.mandal.notes,
    ...(includeSa ? { saMidi: s.saMidi, fineCents: s.fineCents } : {}),
  };
}

export function toggleFavorite(id: string) {
  update((s) => ({
    favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [...s.favorites, id],
  }));
}
