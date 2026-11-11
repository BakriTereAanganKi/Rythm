import { useStore, update, type Tab } from '../store';
import { togglePlay, useBeat } from '../audio/engine';
import { getTaal } from '../music/taals';
import { Icon } from './Icon';

const TABS: [Tab, string, string][] = [
  ['play', 'Play', 'metronome'],
  ['drone', 'Drone', 'wave'],
  ['mandal', 'Mandal', 'harp'],
  ['presets', 'Presets', 'list'],
  ['more', 'More', 'more'],
];

export function BottomNav() {
  const tab = useStore((s) => s.tab);
  return (
    <nav className="nav">
      {TABS.map(([id, label, icon]) => (
        <button key={id} className={tab === id ? 'on' : ''} onClick={() => update({ tab: id })}>
          <Icon name={icon} size={24} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

/** Spotify-style "now playing" bar shown on every tab except Play. */
export function MiniPlayer() {
  const s = useStore();
  const ev = useBeat();
  const live = s.playing && s.rhythmOn && ev;
  const total = s.mode === 'tabla' ? getTaal(s.taalId).matras : s.metro.beats;
  const progress = live ? ((ev.index + 1) / total) * 100 : 0;
  return (
    <div className="mini" onClick={() => update({ tab: 'play' })}>
      <div className={`mini-beat ${live && ev.sam ? 'sam' : ''}`}>{live ? ev.index + 1 : '–'}</div>
      <div className="mini-text">
        <div className="mini-title">{s.presetName}</div>
        <div className="mini-sub">
          {s.mode === 'tabla' ? getTaal(s.taalId).name : `Metronome ${s.metro.beats}`} · {s.bpm} bpm
          {live ? ` · ${ev.bol}` : ''}
        </div>
      </div>
      <button
        className="mini-play" aria-label={s.playing ? 'Pause' : 'Play'}
        onClick={(e) => { e.stopPropagation(); void togglePlay(); }}
      >
        <Icon name={s.playing ? 'pause' : 'play'} size={24} />
      </button>
      <div className="mini-progress" style={{ width: `${progress}%` }} />
    </div>
  );
}
