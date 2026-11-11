import { useEffect, useState } from 'react';
import { useStore, setBpm, tempoRange } from '../store';
import { Icon } from './Icon';
import { Slider } from './ui';

/** Log-scaled tempo slider with fine (±1) and coarse (±5, ×½, 2×) controls. */
export function TempoControl() {
  const bpm = useStore((s) => s.bpm);
  const mode = useStore((s) => s.mode);
  const taalId = useStore((s) => s.taalId);
  const [lo, hi] = tempoRange({ mode, taalId });
  const [draft, setDraft] = useState(String(bpm));
  useEffect(() => { setDraft(String(bpm)); }, [bpm]);

  const pos = Math.round((Math.log(bpm / lo) / Math.log(hi / lo)) * 1000);
  const fromPos = (p: number) => setBpm(lo * Math.pow(hi / lo, p / 1000));

  return (
    <div className="tempo">
      <div className="tempo-head">
        <span className="label">Tempo</span>
        <label className="tempo-val">
          <input
            inputMode="numeric" value={draft} aria-label="Tempo in BPM"
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
            onBlur={() => setBpm(Number(draft) || bpm)}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          <span>bpm</span>
        </label>
      </div>
      <div className="tempo-slider">
        <button className="round-btn" onClick={() => setBpm(bpm - 1)} aria-label="Slower by 1"><Icon name="minus" /></button>
        <Slider value={pos} min={0} max={1000} onChange={fromPos} label="Tempo" />
        <button className="round-btn" onClick={() => setBpm(bpm + 1)} aria-label="Faster by 1"><Icon name="plus" /></button>
      </div>
      <div className="tempo-steps">
        <button className="pill" onClick={() => setBpm(bpm / 2)}>×½</button>
        <button className="pill" onClick={() => setBpm(bpm - 5)}>−5</button>
        <span className="tempo-range">{lo}–{hi}</span>
        <button className="pill" onClick={() => setBpm(bpm + 5)}>+5</button>
        <button className="pill" onClick={() => setBpm(bpm * 2)}>2×</button>
      </div>
    </div>
  );
}
