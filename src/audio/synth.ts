/**
 * Offline synthesis of every instrument sound into mono sample arrays.
 * Rendering happens once per pitch and is cached as AudioBuffers by the engine.
 */
import type { Stroke } from '../music/taals';

let seed = 12345;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

interface Partial { f: number; amp: number; decay: number }

/** Sum of exponentially decaying sines (phasor rotation – fast). */
function addPartials(out: Float32Array, sr: number, partials: Partial[]) {
  const nyq = sr * 0.45;
  for (const p of partials) {
    if (p.f <= 0 || p.f >= nyq) continue;
    const w = (2 * Math.PI * p.f) / sr;
    const cr = Math.cos(w), ci = Math.sin(w);
    const ph = rand() * Math.PI * 2;
    let re = Math.cos(ph), im = Math.sin(ph);
    let a = p.amp;
    const d = Math.exp(-p.decay / sr);
    for (let i = 0; i < out.length; i++) {
      out[i] += a * im;
      const r2 = re * cr - im * ci;
      im = re * ci + im * cr;
      re = r2;
      a *= d;
      if (a < 1e-5) break;
    }
  }
}

/** Filtered, decaying noise burst. */
function addNoise(out: Float32Array, sr: number, amp: number, decay: number, lpHz = 0, hpHz = 0) {
  const n = Math.min(out.length, Math.floor((sr * 7) / decay));
  const aLp = lpHz ? 1 - Math.exp((-2 * Math.PI * lpHz) / sr) : 1;
  const aHp = hpHz ? Math.exp((-2 * Math.PI * hpHz) / sr) : 0;
  let lp = 0, hpIn = 0, hpOut = 0, e = amp;
  const d = Math.exp(-decay / sr);
  for (let i = 0; i < n; i++) {
    lp += aLp * (rand() * 2 - 1 - lp);
    let y = lp;
    if (hpHz) {
      hpOut = aHp * (hpOut + y - hpIn);
      hpIn = y;
      y = hpOut;
    }
    out[i] += y * e;
    e *= d;
  }
}

function envelope(out: Float32Array, sr: number, attack: number, release: number) {
  const na = Math.max(1, Math.floor(attack * sr));
  for (let i = 0; i < na && i < out.length; i++) out[i] *= i / na;
  const nr = Math.max(1, Math.floor(release * sr));
  for (let i = 0; i < nr && i < out.length; i++) out[out.length - 1 - i] *= i / nr;
}

function normalize(out: Float32Array, peak: number) {
  let m = 0;
  for (let i = 0; i < out.length; i++) m = Math.max(m, Math.abs(out[i]));
  if (m > 0) {
    const g = peak / m;
    for (let i = 0; i < out.length; i++) out[i] *= g;
  }
  return out;
}

const alloc = (sr: number, dur: number) => new Float32Array(Math.floor(sr * dur));

/** RBJ biquad, applied in place (offline). */
function biquad(x: Float32Array, sr: number, type: 'peak' | 'highshelf' | 'highpass', f: number, q: number, db = 0) {
  const A = Math.pow(10, db / 40);
  const w = (2 * Math.PI * f) / sr;
  const cs = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'peak') {
    b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A;
  } else if (type === 'highshelf') {
    const s = 2 * Math.sqrt(A) * al;
    b0 = A * (A + 1 + (A - 1) * cs + s); b1 = -2 * A * (A - 1 + (A + 1) * cs); b2 = A * (A + 1 + (A - 1) * cs - s);
    a0 = A + 1 - (A - 1) * cs + s; a1 = 2 * (A - 1 - (A + 1) * cs); a2 = A + 1 - (A - 1) * cs - s;
  } else {
    b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al;
  }
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i];
    const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    x[i] = y0;
  }
}

/** One string as a digital waveguide (Karplus–Strong) with a fractional-delay tuned loop. */
function waveguideString(out: Float32Array, sr: number, f: number, amp: number, t60: number) {
  const L = sr / f;
  const b = 0.06; // loop low-pass: small = bright, long-sustaining harmonics
  const D0 = L - b;
  let M = 1;
  while (M < L + 8) M <<= 1;
  const mask = M - 1;
  const buf = new Float64Array(M);
  const g = Math.pow(10, -3 / (t60 * f));

  // Excitation: soft finger pluck = triangle (plucked ~1/5 along) + a little smoothed noise.
  const Li = Math.floor(L);
  const exc = new Float64Array(Li);
  const pp = Math.floor(Li * 0.2);
  let lp = 0;
  const aN = 1 - Math.exp((-2 * Math.PI * Math.min(f * 8, 4000)) / sr);
  for (let i = 0; i < Li; i++) {
    const tri = i < pp ? i / pp : (Li - i) / (Li - pp);
    lp += aN * (rand() * 2 - 1 - lp);
    exc[i] = tri + 0.25 * lp;
  }
  let mean = 0;
  for (let i = 0; i < Li; i++) mean += exc[i];
  mean /= Li;
  let peak = 0;
  for (let i = 0; i < Li; i++) { exc[i] -= mean; peak = Math.max(peak, Math.abs(exc[i])); }

  let w = 0, yPrev = 0;
  for (let i = 0; i < out.length; i++) {
    // 3rd-order Lagrange fractional read at (w - D0)
    const pos = w - D0;
    const ip = Math.floor(pos);
    const d = pos - ip + 1; // 1..2 → use points ip-1..ip+2
    const xm1 = buf[(ip - 1) & mask], x0 = buf[ip & mask], x1 = buf[(ip + 1) & mask], x2 = buf[(ip + 2) & mask];
    const y =
      xm1 * (-(d - 1) * (d - 2) * (d - 3)) / 6 +
      x0 * (d * (d - 2) * (d - 3)) / 2 +
      x1 * (-d * (d - 1) * (d - 3)) / 2 +
      x2 * (d * (d - 1) * (d - 2)) / 6;
    const e = i < Li ? exc[i] / peak : 0;
    buf[w & mask] = g * ((1 - b) * y + b * yPrev) + e;
    yPrev = y;
    out[i] += amp * y;
    w++;
  }
}

/**
 * Jawari: the string grazes a curved bridge on one side of its swing. Modelled as one-sided
 * clipping (relative to the current loudness, so the buzz lasts the whole note) shaped by a
 * resonant band that slowly sweeps downward — the swirling "jhaaa" of a well-set tanpura.
 */
function addJawari(x: Float32Array, sr: number, amount: number, sweepStart: number, sweepEnd: number, tau: number) {
  const n = x.length;
  const rel = Math.exp(-1 / (0.08 * sr));
  const Q = 2.2;
  const k = 1 / Q;
  let env = 0, ic1 = 0, ic2 = 0;
  let a1 = 0, a2 = 0, a3 = 0;
  const buzz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if ((i & 31) === 0) {
      const t = i / sr;
      const fc = sweepEnd + (sweepStart - sweepEnd) * Math.exp(-t / tau);
      const g = Math.tan((Math.PI * Math.min(fc, sr * 0.45)) / sr);
      a1 = 1 / (1 + g * (g + k));
      a2 = g * a1;
      a3 = g * a2;
    }
    const y = x[i];
    const ay = Math.abs(y);
    env = ay > env ? ay : env * rel;
    const shaped = Math.max(y, -0.3 * env); // bridge contact on one side of the swing
    // TPT state-variable band-pass
    const v3 = shaped - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    buzz[i] = v1;
  }
  for (let i = 0; i < n; i++) x[i] += amount * buzz[i];
}

/** Tanpura string: two slightly detuned polarisations + jawari + gourd body resonance. */
export function renderTanpura(sr: number, f0: number, dur: number, variant = 0): Float32Array {
  seed = 1 + variant * 7919 + Math.round(f0 * 100);
  const out = alloc(sr, dur);
  const t60 = f0 < 90 ? 16 : f0 < 160 ? 13 : 10;
  waveguideString(out, sr, f0, 1, t60);
  waveguideString(out, sr, f0 * Math.pow(2, (1.2 + rand()) / 1200), 0.5, t60 * 0.85);
  addJawari(out, sr, 4 * (0.9 + rand() * 0.2), 3600 + rand() * 600, 650, 2.6 + rand() * 0.8);
  biquad(out, sr, 'highpass', 45, 0.7);
  biquad(out, sr, 'peak', 210, 1.2, 4); // gourd
  biquad(out, sr, 'highshelf', 7000, 0.7, -8); // tame fizz
  envelope(out, sr, 0.004, 1.2);
  return normalize(out, 0.9);
}

const harm = (f0: number, ratios: number[], amps: number[], decays: number[]): Partial[] =>
  ratios.map((r, i) => ({ f: f0 * r, amp: amps[i], decay: decays[i] }));

/** Tabla strokes. `f0` = dayan (right drum) pitch, tuned to Sa. */
export function renderStroke(sr: number, stroke: Stroke, f0: number): Float32Array {
  let out: Float32Array;
  let peak = 0.9;
  switch (stroke) {
    case 'na':
      out = alloc(sr, 0.9);
      addPartials(out, sr, harm(f0, [1, 2, 3, 4, 5, 6], [1, 0.75, 0.6, 0.4, 0.28, 0.15], [6, 8, 11, 15, 19, 24]));
      addNoise(out, sr, 0.35, 400, 6000, 1500);
      break;
    case 'tin':
      out = alloc(sr, 1.2);
      addPartials(out, sr, harm(f0, [1, 2, 3, 4], [1, 0.6, 0.35, 0.15], [3.5, 5, 8, 12]));
      addNoise(out, sr, 0.12, 300, 4000, 800);
      peak = 0.7;
      break;
    case 'tun':
      out = alloc(sr, 1.6);
      addPartials(out, sr, harm(f0, [1, 2, 3], [1, 0.3, 0.1], [2.5, 5, 9]));
      addNoise(out, sr, 0.05, 200, 1500, 100);
      peak = 0.75;
      break;
    case 'ti':
      out = alloc(sr, 0.18);
      addPartials(out, sr, harm(f0, [1, 2, 3, 4.2], [0.4, 0.3, 0.2, 0.15], [40, 50, 60, 70]));
      addNoise(out, sr, 0.7, 90, 5000, 1200);
      peak = 0.5;
      break;
    case 'ge': {
      out = alloc(sr, 1.3);
      // Bayan: low membrane whose pitch drops quickly after the strike.
      let ph = 0, a = 1, a2 = 0.3;
      const d = Math.exp(-3 / sr), d2 = Math.exp(-6 / sr);
      for (let i = 0; i < out.length; i++) {
        const t = i / sr;
        const f = 92 + 38 * Math.exp(-t / 0.03);
        ph += (2 * Math.PI * f) / sr;
        out[i] += a * Math.sin(ph) + a2 * Math.sin(2 * ph);
        a *= d;
        a2 *= d2;
      }
      addNoise(out, sr, 0.3, 60, 300);
      peak = 0.85;
      break;
    }
    case 'ka':
    default:
      out = alloc(sr, 0.15);
      addNoise(out, sr, 0.9, 45, 900, 60);
      addPartials(out, sr, [{ f: 150, amp: 0.5, decay: 40 }]);
      peak = 0.6;
  }
  envelope(out, sr, 0.0015, 0.03);
  return normalize(out, peak);
}

export function renderManjira(sr: number, open: boolean): Float32Array {
  const out = alloc(sr, open ? 2.4 : 0.3);
  const freqs = [2637, 3790, 5180, 6930, 8380, 10150];
  const amps = [0.7, 0.6, 0.5, 0.35, 0.25, 0.15];
  const decays = [2.2, 2.6, 3, 3.5, 4, 5].map((d) => (open ? d : d * 12));
  addPartials(out, sr, freqs.map((f, i) => ({ f, amp: amps[i], decay: decays[i] })));
  addNoise(out, sr, 0.4, open ? 25 : 60, 0, 5000);
  envelope(out, sr, 0.001, 0.05);
  return normalize(out, open ? 0.8 : 0.5);
}

export type ClickKind = 'accent' | 'beat' | 'sub';
export function renderClick(sr: number, kind: ClickKind): Float32Array {
  const out = alloc(sr, 0.08);
  const f = { accent: 1760, beat: 1175, sub: 880 }[kind];
  addPartials(out, sr, [
    { f, amp: 1, decay: 70 },
    { f: f * 2, amp: 0.3, decay: 90 },
  ]);
  addNoise(out, sr, 0.2, 300, 0, 2000);
  envelope(out, sr, 0.0008, 0.01);
  return normalize(out, { accent: 0.9, beat: 0.7, sub: 0.4 }[kind]);
}

/** Bright plucked string for the swar mandal. */
export function renderHarp(sr: number, f0: number): Float32Array {
  const out = alloc(sr, 3.5);
  const partials: Partial[] = [];
  for (let h = 1; h <= 16; h++) {
    partials.push({
      f: f0 * h * (1 + 0.0003 * h * h),
      amp: Math.abs(Math.sin(Math.PI * h * 0.12)) / h,
      decay: 0.9 + 0.35 * h,
    });
  }
  addPartials(out, sr, partials);
  addNoise(out, sr, 0.1, 200, 0, 2000);
  envelope(out, sr, 0.002, 0.2);
  return normalize(out, 0.8);
}

/** Reed-like periodic wave for the sur-peti (shruti box). */
export function reedWave(ctx: BaseAudioContext): PeriodicWave {
  const N = 32;
  const real = new Float32Array(N);
  const imag = new Float32Array(N);
  for (let h = 1; h < N; h++) imag[h] = (1 / h) * (h % 2 ? 1 : 0.6) * Math.exp(-h / 18);
  return ctx.createPeriodicWave(real, imag);
}
