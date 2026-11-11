import { useState } from 'react';
import { useStore, update, setTaal } from '../store';
import { TAALS, getTaal } from '../music/taals';
import { togglePlay } from '../audio/engine';
import { thekaFor } from '../audio/thekaRecordings';
import { BeatDisplay } from '../components/BeatDisplay';
import { TempoControl } from '../components/TempoControl';
import { TanpuraRow } from '../components/TanpuraRow';
import { SaName } from '../components/NoteLabel';
import { Icon } from '../components/Icon';
import { Card, Chip, Segmented, Sheet } from '../components/ui';

export function NotationToggle() {
  const notation = useStore((s) => s.notation);
  return (
    <Segmented
      small value={notation} onChange={(v) => update({ notation: v })}
      options={[['indian', 'सा'], ['western', 'C']]}
    />
  );
}

function TaalPicker() {
  const taalId = useStore((s) => s.taalId);
  const tablaSound = useStore((s) => s.tablaSound);
  const [open, setOpen] = useState(false);
  const taal = getTaal(taalId);
  const i = TAALS.findIndex((t) => t.id === taal.id);
  const step = (d: number) => setTaal(TAALS[(i + d + TAALS.length) % TAALS.length].id);
  return (
    <div className="stepper">
      <button className="icon-btn" onClick={() => step(-1)} aria-label="Previous taal"><Icon name="chevL" /></button>
      <button className="stepper-main" onClick={() => setOpen(true)}>
        <span>{taal.name}</span>
        <span className="stepper-sub">
          {taal.matras} matras · {taal.vibhags.join('+')}
          {thekaFor(taal.id) && tablaSound === 'theka' && <span className="rec-badge">● recorded theka</span>}
        </span>
      </button>
      <button className="icon-btn" onClick={() => step(1)} aria-label="Next taal"><Icon name="chevR" /></button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Choose taal">
        <div className="list">
          {TAALS.map((t) => (
            <button key={t.id} className={`list-item ${t.id === taalId ? 'on' : ''}`} onClick={() => { setTaal(t.id); setOpen(false); }}>
              <div className="list-main">
                <div className="list-title">{t.name}</div>
                <div className="list-sub">{t.matras} matras · {t.vibhags.join(' + ')} · {t.marks.join(' ')}</div>
              </div>
              {thekaFor(t.id) && <span className="badge">recorded</span>}
              {t.bhajan && <span className="badge">manjira</span>}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function MetroPicker() {
  const metro = useStore((s) => s.metro);
  const set = (p: Partial<typeof metro>) => update((s) => ({ metro: { ...s.metro, ...p } }));
  return (
    <div className="metro">
      <div className="chips scroll">
        {[2, 3, 4, 5, 6, 7, 9, 12].map((b) => (
          <Chip key={b} on={metro.beats === b} onClick={() => set({ beats: b })}>{b}/{b === 6 || b === 9 || b === 12 ? 8 : 4}</Chip>
        ))}
      </div>
      <div className="metro-row">
        <Segmented
          small value={metro.sub} onChange={(sub) => set({ sub })}
          options={[[1, '♩'], [2, '♫'], [3, '3'], [4, '4']]}
        />
        <Chip on={metro.accent} onClick={() => set({ accent: !metro.accent })}>Accent 1</Chip>
      </div>
    </div>
  );
}

export function Play() {
  const mode = useStore((s) => s.mode);
  const presetName = useStore((s) => s.presetName);
  const playing = useStore((s) => s.playing);
  const rhythmOn = useStore((s) => s.rhythmOn);
  const droneOn = useStore((s) => s.droneOn);

  return (
    <div className="page">
      <header className="top">
        <div>
          <div className="eyebrow">Now practicing</div>
          <h1 className="title">{presetName}</h1>
          <div className="sub">Sa <SaName /></div>
        </div>
        <NotationToggle />
      </header>

      <Segmented value={mode} onChange={(m) => update({ mode: m })} options={[['tabla', 'Tabla'], ['metronome', 'Metronome']]} />
      {mode === 'tabla' ? <TaalPicker /> : <MetroPicker />}

      <BeatDisplay />
      <TempoControl />

      <div className="transport">
        <button className={`side-toggle ${rhythmOn ? 'on' : ''}`} onClick={() => update({ rhythmOn: !rhythmOn })}>
          <Icon name={mode === 'tabla' ? 'drum' : 'metronome'} />
          <span>{mode === 'tabla' ? 'Tabla' : 'Click'}</span>
        </button>
        <button className="play-btn" onClick={() => void togglePlay()} aria-label={playing ? 'Pause' : 'Play'}>
          <Icon name={playing ? 'pause' : 'play'} size={34} />
        </button>
        <button className={`side-toggle ${droneOn ? 'on' : ''}`} onClick={() => update({ droneOn: !droneOn })}>
          <Icon name="wave" />
          <span>Drone</span>
        </button>
      </div>

      <Card>
        <TanpuraRow k={0} />
        <TanpuraRow k={1} />
      </Card>
    </div>
  );
}
