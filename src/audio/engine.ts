import { useEffect, useState } from 'react';
import { CHANNELS, useStore, type AppState, type Channel, type TanpuraCfg } from '../store';
import { getTaal, vibhagAt, bolStrokes, displayBol, type Stroke } from '../music/taals';
import { semiHz, mandalStrings } from '../music/notation';
import * as synth from './synth';
import { pickSample, sampleRate, sampleUrl, stringFor, stringUrl, STRING_SAMPLES, type TanpuraSample } from './tanpuraSamples';
import { TABLA_SAMPLES, tablaUrl } from './tablaSamples';
import { thekaFor, type ThekaRecording } from './thekaRecordings';

export interface BeatEvent {
  time: number;
  kind: 'taal' | 'metro';
  index: number;
  total: number;
  bol: string;
  mark: string;
  sam: boolean;
}

export const EQ_PRESETS: Record<string, [number, number, number]> = {
  Flat: [0, 0, 0],
  Warm: [3, -1, -2],
  Bright: [-1, 1, 4],
  'Bass Boost': [6, 0, 0],
  Vocal: [-2, 3, 1],
  'Treble Cut': [0, 0, -6],
  Soft: [-2, -2, -3],
  'Small Speakers': [-4, 2, 3],
  Loudness: [4, 0, 3],
};

const LOOKAHEAD = 0.15;
const TP_VARIANTS = 3;
type Voice = { src: AudioBufferSourceNode; g: GainNode };
type Media = {
  el: HTMLAudioElement;
  node: MediaElementAudioSourceNode;
  g: GainNode;
  key: string;
  sample: TanpuraSample;
  /** Already crossfading out into the next copy. */
  xfade: boolean;
};
const SUR_NOTES: Record<string, number[]> = { P: [-5, 0, 12], m: [-7, 0, 12], N: [-1, 0, 12], S: [0, 12] };

/** Strings of a tanpura in plucking order (semitones from Sa). */
export function tanpuraStrings(cfg: TanpuraCfg): number[] {
  if (cfg.first === null) return [];
  return [cfg.first - 12, ...(cfg.fifth !== null ? [cfg.fifth - 12] : []), 0, 0, -12];
}

/** Dayan is tuned to Sa, in the octave closest to the recorded tablas (~275 Hz). */
function dayanHz(s: AppState) {
  const sa = semiHz(s.saMidi, s.fineCents, 0);
  return sa * Math.pow(2, Math.round(Math.log2(275 / sa)));
}

const DAYAN = new Set<Stroke>(['na', 'tin', 'tun', 'ti']);

/** setInterval inside a worker is not throttled when the tab is hidden. */
function makeClock(cb: () => void) {
  const src = 'let id=null;onmessage=e=>{if(e.data==="start"){clearInterval(id);id=setInterval(()=>postMessage(0),25)}else{clearInterval(id)}}';
  try {
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.onmessage = cb;
    return { start: () => w.postMessage('start'), stop: () => w.postMessage('stop') };
  } catch {
    let id: number | undefined;
    return { start: () => { id = window.setInterval(cb, 25); }, stop: () => window.clearInterval(id) };
  }
}

class Engine {
  ctx: AudioContext | null = null;
  recDest!: MediaStreamAudioDestinationNode;
  private ch = {} as Record<Channel, { gain: GainNode; pan: StereoPannerNode }>;
  private masterIn!: GainNode;
  private masterOut!: GainNode;
  private eq!: BiquadFilterNode[];
  private backingToRec = true;
  private bufs = new Map<string, AudioBuffer>();
  /** Real tabla strokes, decoded. Empty until loaded (synth is used meanwhile / on failure). */
  private tabla = new Map<Stroke, { buf: AudioBuffer; pitch: number | null }[]>();
  private tablaReady: Promise<void> | null = null;
  /** Real single tanpura strings (decoded), used for tunings without a full recording. */
  private strings: { buf: AudioBuffer; semi: number; f: number }[] = [];
  private stringsReady: Promise<void> | null = null;
  /** Recorded thekas (decoded), by taal id. */
  private thekas = new Map<string, AudioBuffer | null | Promise<void>>();
  private thekaCycle = 0;
  private lastDayan: Voice | undefined;
  private lastBayan: Voice | undefined;
  private voices = new Set<Voice>();
  private clock = makeClock(() => this.tick());
  running = false;

  private nextBeat = 0;
  private beatIdx = 0;
  private rhythmKey = '';
  private rhythmWasOn = false;
  /** Per tanpura: next pluck time, string counter, and the voice still ringing on each string. */
  private tp = [
    { next: 0, idx: 0, on: false, ring: [] as (Voice | undefined)[], media: undefined as Media | undefined },
    { next: 0, idx: 0, on: false, ring: [] as (Voice | undefined)[], media: undefined as Media | undefined },
  ];
  /** Recordings that failed to stream (fall back to real single strings). */
  private mediaFailed = new Set<string>();
  private sur: { oscs: OscillatorNode[]; g: GainNode; key: string } | null = null;

  private events: BeatEvent[] = [];
  private listeners = new Set<(e: BeatEvent | null) => void>();
  last: BeatEvent | null = null;
  private raf = 0;
  private wake: { release: () => Promise<void> } | null = null;
  private prewarmTimer: number | undefined;

  init(): AudioContext {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.masterIn = ctx.createGain();
    const [lo, mid, hi] = (['lowshelf', 'peaking', 'highshelf'] as BiquadFilterType[]).map((type, i) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = [200, 1200, 4500][i];
      return f;
    });
    this.eq = [lo, mid, hi];
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 4;
    this.masterOut = ctx.createGain();
    this.masterIn.connect(lo).connect(mid).connect(hi).connect(comp).connect(this.masterOut);
    this.masterOut.connect(ctx.destination);
    this.recDest = ctx.createMediaStreamDestination();
    this.masterOut.connect(this.recDest);
    for (const c of CHANNELS) {
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      gain.connect(pan).connect(this.masterIn);
      this.ch[c] = { gain, pan };
    }
    this.applyMix(useStore.getState());
    useStore.subscribe((s, p) => {
      this.applyMix(s);
      this.updateSurPeti();
      if (s.saMidi !== p.saMidi || s.fineCents !== p.fineCents || s.tanpura !== p.tanpura || s.mandal !== p.mandal)
        this.schedulePrewarm();
    });
    return ctx;
  }

  /** Resume the context – must be called from a user gesture on iOS. */
  wakeCtx() {
    const ctx = this.init();
    if (ctx.state !== 'running') void ctx.resume();
    return ctx;
  }

  async start() {
    const ctx = this.wakeCtx();
    this.prewarm();
    // Give the real tabla recordings a moment to load so the first beats aren't synthesized.
    const st = useStore.getState();
    const rec = st.tablaSound === 'theka' ? thekaFor(st.taalId) : null;
    await Promise.race([
      Promise.all([this.loadTabla(), this.loadStrings(), rec ? this.loadTheka(rec) : null]),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
    this.thekaCycle = 0;
    this.running = true;
    this.nextBeat = ctx.currentTime + 0.1;
    this.beatIdx = 0;
    this.rhythmKey = '';
    this.tp.forEach((t) => {
      t.on = false;
      t.media = undefined;
    });
    this.events = [];
    this.clock.start();
    this.tick();
    this.updateSurPeti();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
    this.requestWake();
  }

  stop() {
    this.running = false;
    this.clock.stop();
    this.events = [];
    this.last = null;
    this.listeners.forEach((l) => l(null));
    this.updateSurPeti();
    const ctx = this.ctx;
    if (ctx) {
      for (const v of this.voices) {
        v.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        try { v.src.stop(ctx.currentTime + 0.3); } catch { /* already stopped */ }
      }
      for (const t of this.tp) {
        this.fadeMedia(t.media, 0.05);
        t.media = undefined;
      }
    }
    void this.wake?.release().catch(() => {});
    this.wake = null;
  }

  subscribe(fn: (e: BeatEvent | null) => void) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  setBackingInRecording(on: boolean) {
    if (!this.ctx || on === this.backingToRec) return;
    if (on) this.masterOut.connect(this.recDest);
    else this.masterOut.disconnect(this.recDest);
    this.backingToRec = on;
  }

  // ───────────────────────── mix ─────────────────────────
  private applyMix(s: AppState) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const c of CHANNELS) {
      const m = s.mix[c];
      this.ch[c].gain.gain.setTargetAtTime(m.mute ? 0 : m.vol, now, 0.02);
      this.ch[c].pan.pan.setTargetAtTime(m.pan, now, 0.02);
    }
    this.masterOut.gain.setTargetAtTime(s.master, now, 0.02);
    const eq = EQ_PRESETS[s.eq] ?? EQ_PRESETS.Flat;
    this.eq.forEach((f, i) => f.gain.setTargetAtTime(eq[i], now, 0.05));
  }

  // ───────────────────────── buffers ─────────────────────────
  private buf(key: string, make: (sr: number) => Float32Array): AudioBuffer {
    let b = this.bufs.get(key);
    if (!b) {
      const ctx = this.ctx!;
      const data = make(ctx.sampleRate);
      b = ctx.createBuffer(1, data.length, ctx.sampleRate);
      b.getChannelData(0).set(data);
      this.bufs.set(key, b);
    }
    return b;
  }

  private tanpuraBuf(f: number, kharaj: boolean, variant: number) {
    return this.buf(`tp:${f.toFixed(2)}:${kharaj}:${variant}`, (sr) => synth.renderTanpura(sr, f, kharaj ? 11 : 9, variant));
  }
  private strokeBuf(stroke: Stroke, f: number) {
    return this.buf(`tb:${stroke}:${f.toFixed(2)}`, (sr) => synth.renderStroke(sr, stroke, f));
  }
  private harpBuf(f: number) {
    return this.buf(`hp:${f.toFixed(2)}`, (sr) => synth.renderHarp(sr, f));
  }

  /** Render the buffers we're about to need in small async chunks so playback never stutters. */
  private prewarmJobs(): (() => void)[] {
    const s = useStore.getState();
    const jobs: (() => void)[] = [];
    const semis = new Set<number>();
    s.tanpura.forEach((t) => tanpuraStrings(t).forEach((x) => semis.add(x)));
    for (const x of semis)
      for (let v = 0; v < TP_VARIANTS; v++) jobs.push(() => this.tanpuraBuf(semiHz(s.saMidi, s.fineCents, x), x === -12, v));
    const d = dayanHz(s);
    (['na', 'tin', 'tun', 'ti', 'ge', 'ka'] as Stroke[]).forEach((st) => jobs.push(() => this.strokeBuf(st, d)));
    for (const x of mandalStrings(s.mandal.notes)) jobs.push(() => this.harpBuf(semiHz(s.saMidi, s.fineCents, x)));
    return jobs;
  }
  private loadTabla(): Promise<void> {
    if (this.tablaReady) return this.tablaReady;
    const ctx = this.init();
    this.tablaReady = Promise.all(
      TABLA_SAMPLES.map(async (t) => {
        const r = await fetch(tablaUrl(t));
        if (!r.ok) throw new Error(String(r.status));
        const buf = await ctx.decodeAudioData(await r.arrayBuffer());
        return { t, buf };
      }),
    )
      .then((all) => {
        for (const { t, buf } of all) this.tabla.set(t.stroke, [...(this.tabla.get(t.stroke) ?? []), { buf, pitch: t.pitch }]);
      })
      .catch(() => this.tabla.clear());
    return this.tablaReady;
  }

  /**
   * Play one tabla stroke. Uses a random real recording whose pitch is within 5 semitones of the
   * dayan target (retuned exactly to Sa); bayan/closed strokes keep their natural pitch.
   * A new stroke damps whatever is still ringing on the same drum, as a hand does.
   */
  private playStroke(stroke: Stroke, t: number, gain: number, dayan: number) {
    const opts = this.tabla.get(stroke);
    let v: Voice;
    if (opts?.length) {
      const near = opts.filter((o) => o.pitch === null || Math.abs(12 * Math.log2(dayan / o.pitch)) <= 5);
      const pool = near.length
        ? near
        : [opts.reduce((a, b) => (Math.abs(Math.log(dayan / (b.pitch ?? dayan))) < Math.abs(Math.log(dayan / (a.pitch ?? dayan))) ? b : a))];
      const o = pool[Math.floor(Math.random() * pool.length)];
      v = this.play(o.buf, 'tabla', t, gain, o.pitch ? dayan / o.pitch : 1);
    } else {
      v = this.play(this.strokeBuf(stroke, dayan), 'tabla', t, gain);
    }
    const isDayan = DAYAN.has(stroke);
    const prev = isDayan ? this.lastDayan : this.lastBayan;
    if (prev && prev !== v) this.fadeOut(prev, t, stroke === 'ka' ? 0.015 : stroke === 'ti' ? 0.03 : 0.08);
    if (isDayan) this.lastDayan = v;
    else this.lastBayan = v;
  }

  private loadTheka(rec: ThekaRecording): Promise<void> {
    const have = this.thekas.get(rec.taalId);
    if (have instanceof Promise) return have;
    if (have !== undefined) return Promise.resolve();
    const ctx = this.init();
    const p = fetch(`/${rec.file}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      })
      .then((ab) => ctx.decodeAudioData(ab))
      .then((b) => { this.thekas.set(rec.taalId, b); })
      .catch(() => { this.thekas.set(rec.taalId, null); });
    this.thekas.set(rec.taalId, p);
    return p;
  }

  private loadStrings(): Promise<void> {
    if (this.stringsReady) return this.stringsReady;
    const ctx = this.init();
    this.stringsReady = Promise.all(
      STRING_SAMPLES.map(async (sm) => {
        const r = await fetch(stringUrl(sm));
        if (!r.ok) throw new Error(String(r.status));
        return { buf: await ctx.decodeAudioData(await r.arrayBuffer()), semi: sm.semi, f: sm.f };
      }),
    )
      .then((all) => { this.strings = all; })
      .catch(() => { this.strings = []; });
    return this.stringsReady;
  }

  /**
   * Stream a full-length recording (≈20 min) through the mixer with an <audio> element —
   * decoding it whole would need ~450 MB of memory per track. Pitch follows playbackRate.
   */
  private startMedia(sm: TanpuraSample, ch: Channel, offset: number, rate: number, fadeTau: number): Media {
    const ctx = this.ctx!;
    const el = new Audio(`${sampleUrl(sm)}#t=${offset.toFixed(2)}`);
    el.preload = 'auto';
    (el as HTMLAudioElement & { preservesPitch: boolean }).preservesPitch = false;
    el.playbackRate = rate;
    const node = ctx.createMediaElementSource(el);
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(sm.gain, ctx.currentTime, fadeTau);
    node.connect(g).connect(this.ch[ch].gain);
    const m: Media = { el, node, g, key: sm.id, sample: sm, xfade: false };
    el.onerror = () => {
      this.mediaFailed.add(sm.id);
      this.fadeMedia(m, 0.05);
    };
    void el.play().catch(() => {
      this.mediaFailed.add(sm.id);
      this.fadeMedia(m, 0.05);
    });
    return m;
  }

  private fadeMedia(m: Media | undefined, tau: number) {
    if (!m || !this.ctx) return;
    m.g.gain.cancelScheduledValues(this.ctx.currentTime);
    m.g.gain.setTargetAtTime(0, this.ctx.currentTime, tau);
    window.setTimeout(() => {
      m.el.pause();
      m.el.removeAttribute('src');
      m.el.load();
      m.node.disconnect();
      m.g.disconnect();
    }, tau * 8000 + 50);
  }

  private prewarm() {
    void this.loadTabla();
    void this.loadStrings();
    const jobs = this.prewarmJobs();
    const run = () => {
      const job = jobs.shift();
      if (!job) return;
      job();
      this.prewarmTimer = window.setTimeout(run, 0);
    };
    window.clearTimeout(this.prewarmTimer);
    run();
  }
  private schedulePrewarm() {
    window.clearTimeout(this.prewarmTimer);
    this.prewarmTimer = window.setTimeout(() => this.prewarm(), 150);
  }

  private play(
    buf: AudioBuffer, ch: Channel, time: number, gain = 1, rate = 1,
    opts: { loop?: boolean; offset?: number; fadeIn?: number; duration?: number } = {},
  ): Voice {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    src.loop = !!opts.loop;
    const g = ctx.createGain();
    const at = Math.max(time, ctx.currentTime);
    if (opts.fadeIn) {
      g.gain.value = 0;
      g.gain.setTargetAtTime(gain, at, opts.fadeIn);
    } else g.gain.value = gain;
    src.connect(g).connect(this.ch[ch].gain);
    const v = { src, g };
    this.voices.add(v);
    src.onended = () => {
      this.voices.delete(v);
      g.disconnect();
    };
    if (opts.duration !== undefined) src.start(at, opts.offset ?? 0, opts.duration);
    else src.start(at, opts.offset ?? 0);
    return v;
  }

  // ───────────────────────── scheduler ─────────────────────────
  private tick() {
    const ctx = this.ctx;
    if (!ctx || !this.running) return;
    const s = useStore.getState();
    const now = ctx.currentTime;
    const horizon = now + LOOKAHEAD;

    if (this.nextBeat < now - 0.2) this.nextBeat = now + 0.02; // recovered from a stall
    const key = s.mode === 'tabla' ? s.taalId : `m${s.metro.beats}`;
    if (key !== this.rhythmKey || (s.rhythmOn && !this.rhythmWasOn)) {
      this.rhythmKey = key;
      this.beatIdx = 0;
    }
    this.rhythmWasOn = s.rhythmOn;
    while (this.nextBeat < horizon) {
      if (s.mode === 'tabla') this.schedTaal(s, this.nextBeat);
      else this.schedMetro(s, this.nextBeat);
      this.nextBeat += 60 / s.bpm;
    }

    ([0, 1] as const).forEach((k) => this.schedTanpura(s, k, now, horizon));
  }

  private schedTaal(s: AppState, t: number) {
    const taal = getTaal(s.taalId);
    const m = this.beatIdx % taal.matras;
    this.beatIdx = m + 1;
    if (!s.rhythmOn) return;
    const spb = 60 / s.bpm;
    const bols = taal.theka[m].split(/\s+/);
    const v = vibhagAt(taal, m);
    const d = dayanHz(s);
    // Recorded theka: play the real performance's slice for this matra, retuned to Sa.
    const rec = s.tablaSound === 'theka' ? thekaFor(taal.id) : null;
    const tb = rec ? this.thekas.get(rec.taalId) : undefined;
    if (rec && tb === undefined) void this.loadTheka(rec);
    if (rec && tb instanceof AudioBuffer) {
      if (m === 0) this.thekaCycle++;
      const c = this.thekaCycle % rec.cycles;
      const [off, , total] = rec.slices[c * taal.matras + m];
      const sa = semiHz(s.saMidi, s.fineCents, 0);
      const rate = (sa * Math.pow(2, Math.round(Math.log2(rec.dayan / sa)))) / rec.dayan;
      const gain = m === 0 ? 1.08 : 1;
      const v = this.play(tb, 'tabla', t, gain, rate, { offset: off, duration: total });
      if (total / rate > spb) {
        // Next matra arrives before this stroke's ring ends: fade it out right at the next beat.
        v.g.gain.setValueAtTime(gain, t + spb - 0.012);
        v.g.gain.linearRampToValueAtTime(0, t + spb);
        try { v.src.stop(t + spb + 0.02); } catch { /* already scheduled */ }
      }
    } else bols.forEach((bol, i) => {
      const tt = t + (i * spb) / bols.length;
      const g = (i === 0 ? 1 : 0.78) * (m === 0 ? 1.12 : 1) * (0.9 + Math.random() * 0.1);
      for (const st of bolStrokes(bol)) this.playStroke(st, tt, g * (st === 'ge' ? 0.85 : 1), d);
    });
    if (s.manjiraOn && taal.bhajan) {
      const open = v.start;
      this.play(this.buf(`mj:${open}`, (sr) => synth.renderManjira(sr, open)), 'manjira', t, open ? 1 : 0.7);
    }
    if (m === 0 && s.mandal.auto) this.strum(1, t);
    this.events.push({
      time: t, kind: 'taal', index: m, total: taal.matras,
      bol: displayBol(taal.theka[m]), mark: v.start ? v.mark : '', sam: m === 0,
    });
  }

  private schedMetro(s: AppState, t: number) {
    const { beats, sub, accent } = s.metro;
    const m = this.beatIdx % beats;
    this.beatIdx = m + 1;
    if (!s.rhythmOn) return;
    const spb = 60 / s.bpm;
    const kind: synth.ClickKind = m === 0 && accent ? 'accent' : 'beat';
    this.play(this.buf(`ck:${kind}`, (sr) => synth.renderClick(sr, kind)), 'metronome', t);
    for (let k = 1; k < sub; k++)
      this.play(this.buf('ck:sub', (sr) => synth.renderClick(sr, 'sub')), 'metronome', t + (k * spb) / sub);
    this.events.push({
      time: t, kind: 'metro', index: m, total: beats,
      bol: m === 0 && accent ? 'Accent' : 'Beat', mark: m === 0 ? 'X' : '', sam: m === 0,
    });
  }

  private fadeOut(v: Voice | undefined, at: number, tau = 0.15) {
    if (!v) return;
    v.g.gain.setTargetAtTime(0, at, tau);
    try { v.src.stop(at + tau * 8); } catch { /* already stopped */ }
  }

  private schedTanpura(s: AppState, k: 0 | 1, now: number, horizon: number) {
    const cfg = s.tanpura[k];
    const st = this.tp[k];
    const ch: Channel = k ? 'tanpura2' : 'tanpura1';
    const saHz = semiHz(s.saMidi, s.fineCents, 0);

    // The user's full recording for this scale, streamed (Pa tuning; real strings for other tunings).
    const recorded = s.tanpuraSound === 'recorded';
    const pick = s.droneOn && recorded && cfg.fifth === null ? pickSample(cfg.first, saHz) : null;
    const sm = pick && !this.mediaFailed.has(pick.id) ? pick : null;
    if (sm) {
      st.on = false;
      const rate = sampleRate(sm, saHz) * (k ? 1.0004 : 1);
      const m = st.media;
      if (m && m.key === sm.id) {
        if (Math.abs(m.el.playbackRate - rate) > 1e-4) m.el.playbackRate = rate;
        // Near the closing fade: crossfade into a fresh copy from the start — never a gap.
        if (!m.xfade && m.el.currentTime > sm.end - 6) {
          m.xfade = true;
          st.media = this.startMedia(sm, ch, sm.start + 1, rate, 1.2);
          this.fadeMedia(m, 1.2);
        }
        return;
      }
      this.fadeMedia(m, 0.15);
      // Tanpura 2 starts further into the performance so the two never pluck in lockstep.
      const offset = k ? sm.start + (sm.end - sm.start) * 0.37 : sm.start;
      st.media = this.startMedia(sm, ch, offset, rate, 0.3);
      return;
    }
    if (st.media) {
      this.fadeMedia(st.media, 0.15);
      st.media = undefined;
    }

    const strings = tanpuraStrings(cfg);
    if (!s.droneOn || strings.length === 0) {
      st.on = false;
      return;
    }
    if (!st.on) {
      st.on = true;
      st.idx = 0;
      st.ring = [];
      const other = this.tp[1 - k];
      st.next = now + 0.05 + (other.on ? cfg.speed / 2 : 0);
    }
    // Any other tuning: pluck real recorded strings, each retuned (synth only if those failed to load).
    if (recorded && !this.strings.length && this.stringsReady === null) void this.loadStrings();
    const useStrings = recorded && this.strings.length > 0;
    const slot = cfg.speed / (strings.length + 1);
    while (st.next < horizon) {
      const i = st.idx % strings.length;
      const semi = strings[i];
      const f = semiHz(s.saMidi, s.fineCents, semi);
      // Second Sa string is detuned a hair for a natural chorus.
      const rate = i === strings.length - 2 ? 1.0006 : 1;
      const t = st.next + Math.random() * 0.02;
      // Re-plucking a string stops its previous vibration (finger contact) – no pile-up/phasing.
      const prev = st.ring[i];
      if (prev) {
        prev.g.gain.setTargetAtTime(0, t, 0.03);
        try { prev.src.stop(t + 0.3); } catch { /* ended */ }
      }
      const gain = 0.88 + Math.random() * 0.12;
      if (useStrings) {
        const { sample, rate: r } = stringFor(this.strings, semi, saHz);
        st.ring[i] = this.play(sample.buf, ch, t, gain, r * rate);
      } else {
        const variant = Math.floor(Math.random() * TP_VARIANTS);
        st.ring[i] = this.play(this.tanpuraBuf(f, semi === -12, variant), ch, t, gain, rate);
      }
      st.idx++;
      st.next += st.idx % strings.length === 0 ? slot * 2 : slot;
    }
  }

  // ───────────────────────── sur-peti ─────────────────────────
  private updateSurPeti() {
    const ctx = this.ctx;
    if (!ctx) return;
    const s = useStore.getState();
    const want = this.running && s.droneOn && s.surpeti.on;
    const key = want ? `${s.saMidi}:${s.fineCents}:${s.surpeti.mode}` : '';
    if (this.sur && this.sur.key === key) return;
    if (this.sur) {
      const old = this.sur;
      old.g.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      old.oscs.forEach((o) => o.stop(ctx.currentTime + 1));
      this.sur = null;
    }
    if (!want) return;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.18, ctx.currentTime, 0.3);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    lp.Q.value = 0.5;
    g.connect(lp).connect(this.ch.surpeti.gain);
    // Slow bellows swell.
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.22;
    lfoG.gain.value = 0.03;
    lfo.connect(lfoG).connect(g.gain);
    const wave = synth.reedWave(ctx);
    const oscs: OscillatorNode[] = [lfo];
    for (const semi of SUR_NOTES[s.surpeti.mode]) {
      for (const det of [-3, 3]) {
        const o = ctx.createOscillator();
        o.setPeriodicWave(wave);
        o.frequency.value = semiHz(s.saMidi, s.fineCents, semi);
        o.detune.value = det;
        o.connect(g);
        oscs.push(o);
      }
    }
    oscs.forEach((o) => o.start());
    this.sur = { oscs, g, key };
  }

  // ───────────────────────── swar mandal ─────────────────────────
  pluckMandal(semi: number, time?: number, gain = 1) {
    const ctx = this.wakeCtx();
    const s = useStore.getState();
    this.play(this.harpBuf(semiHz(s.saMidi, s.fineCents, semi)), 'mandal', time ?? ctx.currentTime, gain);
  }

  strum(dir: 1 | -1, time?: number) {
    const ctx = this.wakeCtx();
    const strings = mandalStrings(useStore.getState().mandal.notes);
    if (dir < 0) strings.reverse();
    const t0 = time ?? ctx.currentTime + 0.01;
    strings.forEach((semi, i) => this.pluckMandal(semi, t0 + i * 0.045, 0.75));
  }

  // ───────────────────────── UI sync ─────────────────────────
  private loop = () => {
    const ctx = this.ctx;
    if (!ctx || !this.running) return;
    const now = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
    let latest: BeatEvent | null = null;
    while (this.events.length && this.events[0].time <= now) latest = this.events.shift()!;
    if (latest) {
      this.last = latest;
      this.listeners.forEach((l) => l(latest));
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private async requestWake() {
    if (!useStore.getState().keepAwake) return;
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
      this.wake = (await nav.wakeLock?.request('screen')) ?? null;
    } catch { /* not supported / denied */ }
  }
}

export const engine = new Engine();

export async function togglePlay() {
  const s = useStore.getState();
  if (s.playing) {
    engine.stop();
    useStore.setState({ playing: false });
  } else {
    await engine.start();
    useStore.setState({ playing: true });
  }
}

export function useBeat() {
  const [ev, setEv] = useState<BeatEvent | null>(engine.last);
  useEffect(() => engine.subscribe(setEv), []);
  return ev;
}
