/** YIN pitch detection. Returns Hz or null when there's no clear pitch. */
export function detectPitch(buf: Float32Array, sr: number): number | null {
  const N = buf.length;
  let rms = 0;
  for (let i = 0; i < N; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / N) < 0.01) return null;

  const maxTau = Math.min(Math.floor(N / 2), Math.floor(sr / 55));
  const minTau = Math.floor(sr / 1400);
  const W = N - maxTau;
  const d = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) {
      const x = buf[i] - buf[i + tau];
      s += x * x;
    }
    d[tau] = s;
  }
  d[0] = 1;
  let run = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    run += d[tau];
    d[tau] = run ? (d[tau] * tau) / run : 1;
  }
  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) {
    if (d[t] < 0.15) {
      while (t + 1 <= maxTau && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 1) return null;
  const x0 = d[tau - 1];
  const x2 = tau + 1 <= maxTau ? d[tau + 1] : d[tau];
  const denom = x0 + x2 - 2 * d[tau];
  const better = denom ? tau + (x0 - x2) / (2 * denom) : tau;
  return sr / better;
}
