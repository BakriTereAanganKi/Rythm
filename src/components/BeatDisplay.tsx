import { useRef } from 'react';
import { useBeat } from '../audio/engine';
import { useStore, setBpm } from '../store';
import { getTaal, layaName, displayBol } from '../music/taals';

/** The black & green "LCD": current matra, bol, vibhag mark, tempo and laya. Tap it to set the tempo. */
export function BeatDisplay({ compact = false }: { compact?: boolean }) {
  const ev = useBeat();
  const mode = useStore((s) => s.mode);
  const taalId = useStore((s) => s.taalId);
  const bpm = useStore((s) => s.bpm);
  const beats = useStore((s) => s.metro.beats);
  const playing = useStore((s) => s.playing && s.rhythmOn);
  const taps = useRef<number[]>([]);

  const taal = getTaal(taalId);
  const total = mode === 'tabla' ? taal.matras : beats;
  const live = playing && ev && ev.kind === (mode === 'tabla' ? 'taal' : 'metro') ? ev : null;
  const index = live ? live.index : 0;
  const bol = live ? live.bol : mode === 'tabla' ? displayBol(taal.theka[0]) : 'Ready';
  const mark = live ? live.mark : mode === 'tabla' ? taal.marks[0] : 'X';

  const tap = () => {
    const now = performance.now();
    const t = taps.current.filter((x) => now - x < 2500);
    t.push(now);
    taps.current = t.slice(-6);
    if (t.length >= 2) {
      const iv = (t[t.length - 1] - t[0]) / (t.length - 1);
      setBpm(60000 / iv);
    }
  };

  // Group dots by vibhag (tabla) or show one per beat (metronome).
  const groups: { mark: string; start: number; size: number }[] =
    mode === 'tabla'
      ? taal.vibhags.map((size, g) => ({ mark: taal.marks[g], size, start: taal.vibhags.slice(0, g).reduce((a, b) => a + b, 0) }))
      : [{ mark: '', size: beats, start: 0 }];

  return (
    <div className={`lcd ${compact ? 'lcd-compact' : ''} ${live ? 'live' : ''}`} onPointerDown={tap} role="button" aria-label="Beat display — tap to set tempo">
      <div className="lcd-top">
        <span className="lcd-mark">{mark}</span>
        <span className="lcd-bpm">
          <b>{bpm}</b> bpm
        </span>
      </div>
      <div className="lcd-main">
        <div key={live?.time ?? 'idle'} className={`lcd-num ${live ? 'pulse' : ''} ${live?.sam ? 'sam' : ''}`}>
          {index + 1}
        </div>
        <div className="lcd-bol">{bol}</div>
      </div>
      <div className="lcd-dots">
        {groups.map((g) => (
          <div className="lcd-group" key={g.start}>
            <div className="lcd-group-dots">
              {Array.from({ length: g.size }, (_, i) => {
                const m = g.start + i;
                return <span key={m} className={`dot ${live && m === index ? 'on' : ''} ${m < index && live ? 'past' : ''}`} />;
              })}
            </div>
            {g.mark && <div className="lcd-group-mark">{g.mark}</div>}
          </div>
        ))}
      </div>
      <div className="lcd-bottom">
        <span>{mode === 'tabla' ? `${layaName(bpm)} laya` : 'Metronome'}</span>
        <span>{total} {mode === 'tabla' ? 'matras' : 'beats'} · tap to set tempo</span>
      </div>
    </div>
  );
}
