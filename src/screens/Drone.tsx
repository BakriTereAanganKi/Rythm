import { useStore, update, setTanpura, clamp, type SurMode } from '../store';
import { SA_MIN, SA_MAX, WESTERN, HARMONIUM, SWARA, semiHz } from '../music/notation';
import { TanpuraRow } from '../components/TanpuraRow';
import { SaName, NoteLabel } from '../components/NoteLabel';
import { Icon } from '../components/Icon';
import { Card, Chip, Row, Segmented, Slider, Toggle } from '../components/ui';
import { pickSample, sampleRate } from '../audio/tanpuraSamples';
import { NotationToggle } from './Play';

const BLACK = new Set([1, 3, 6, 8, 10]);

function SaPicker() {
  const saMidi = useStore((s) => s.saMidi);
  const cents = useStore((s) => s.fineCents);
  const notation = useStore((s) => s.notation);
  const octave = Math.floor(saMidi / 12) - 1;
  const setSa = (m: number) => update({ saMidi: clamp(m, SA_MIN, SA_MAX) });
  const setCents = (c: number) => update({ fineCents: clamp(Math.round(c), -50, 50) });
  const white = [0, 2, 4, 5, 7, 9, 11];

  const key = (pc: number) => {
    const m = (octave + 1) * 12 + pc;
    const disabled = m < SA_MIN || m > SA_MAX;
    return { m, disabled, on: m === saMidi };
  };

  return (
    <Card>
      <div className="card-head">
        <div>
          <div className="label">Sa (tonic)</div>
          <div className="big-value"><SaName /></div>
          <div className="muted small">{semiHz(saMidi, cents, 0).toFixed(2)} Hz · {cents >= 0 ? '+' : ''}{cents}¢</div>
        </div>
        <div className="octave">
          <button className="icon-btn" onClick={() => setSa(saMidi - 12)} disabled={saMidi - 12 < SA_MIN} aria-label="Octave down"><Icon name="chevL" /></button>
          <span>Oct {octave}</span>
          <button className="icon-btn" onClick={() => setSa(saMidi + 12)} disabled={saMidi + 12 > SA_MAX} aria-label="Octave up"><Icon name="chevR" /></button>
        </div>
      </div>

      <div className="piano">
        <div className="piano-white">
          {white.map((pc) => {
            const k = key(pc);
            return (
              <button key={pc} disabled={k.disabled} className={k.on ? 'on' : ''} onClick={() => setSa(k.m)}>
                <span>{WESTERN[pc]}</span>
                {notation === 'indian' && <small>{HARMONIUM[pc].replace('Safed ', 'S')}</small>}
              </button>
            );
          })}
        </div>
        <div className="piano-black">
          {Array.from({ length: 12 }, (_, pc) => pc).filter((pc) => BLACK.has(pc)).map((pc) => {
            const k = key(pc);
            const left = { 1: 1, 3: 2, 6: 4, 8: 5, 10: 6 }[pc]!;
            return (
              <button
                key={pc} disabled={k.disabled} className={k.on ? 'on' : ''} onClick={() => setSa(k.m)}
                style={{ left: `calc(${(left / 7) * 100}% - 6.5%)` }}
              >
                <span>{WESTERN[pc]}</span>
                {notation === 'indian' && <small>{HARMONIUM[pc].replace('Kali ', 'K')}</small>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="fine">
        <span className="label">Fine tune</span>
        <div className="tempo-slider">
          <button className="round-btn" onClick={() => setCents(cents - 1)} aria-label="−1 cent"><Icon name="minus" /></button>
          <Slider value={cents} min={-50} max={50} onChange={setCents} label="Fine tune in cents" />
          <button className="round-btn" onClick={() => setCents(cents + 1)} aria-label="+1 cent"><Icon name="plus" /></button>
        </div>
        {cents !== 0 && <button className="link" onClick={() => setCents(0)}>Reset to 0¢</button>}
      </div>
    </Card>
  );
}

function TanpuraCard({ k }: { k: 0 | 1 }) {
  const cfg = useStore((s) => s.tanpura[k]);
  const recorded = useStore((s) => s.tanpuraSound === 'recorded');
  const saHz = useStore((s) => semiHz(s.saMidi, s.fineCents, 0));
  const on = cfg.first !== null;
  // Full recording for Pa/Ma (4 strings); otherwise every string is a real recorded pluck, retuned.
  const sample = recorded && cfg.fifth === null ? pickSample(cfg.first, saHz) : null;
  return (
    <Card>
      <div className="card-head">
        <div>
          <div className="card-title">Tanpura {k + 1}</div>
          <div className="muted small">
            {on ? (
              <>
                Strings: <NoteLabel semi={cfg.first! - 12} octave />
                {cfg.fifth !== null && <> · <NoteLabel semi={cfg.fifth - 12} octave /></>} · <NoteLabel semi={0} /> · <NoteLabel semi={0} /> · <NoteLabel semi={-12} octave />
              </>
            ) : 'Off'}
          </div>
        </div>
      </div>
      <TanpuraRow k={k} label="First string" />
      {on && (
        <p className={recorded ? 'hint' : 'hint muted'}>
          {!recorded
            ? 'Modelled (synthesised) tanpura'
            : sample
              ? `● Your ${sample.title.replace(/^Tanpura \((.+)\)$/, '$1')} recording, full length · ${(() => { const c = Math.round(1200 * Math.log2(sampleRate(sample, saHz))); return c === 0 ? 'exact pitch' : `${c > 0 ? '+' : ''}${c}¢ to match your Sa`; })()}`
              : '● Real tanpura strings — each pluck is a recording, retuned to this tuning'}
        </p>
      )}
      <TanpuraRow k={k} field="fifth" label="5th string" />
      {!sample && (
        <Row label="Pluck speed" sub={`${cfg.speed.toFixed(1)} s per cycle`}>
          <Slider value={-cfg.speed} min={-9} max={-2.5} step={0.1} onChange={(v) => setTanpura(k, { speed: -v })} label="Pluck speed" />
        </Row>
      )}
    </Card>
  );
}

const SUR: [SurMode, number[]][] = [['P', [0, 7]], ['m', [0, 5]], ['N', [0, 11]], ['S', [0]]];

export function Drone() {
  const surpeti = useStore((s) => s.surpeti);
  const manjiraOn = useStore((s) => s.manjiraOn);
  const droneOn = useStore((s) => s.droneOn);
  const tanpuraSound = useStore((s) => s.tanpuraSound);
  return (
    <div className="page">
      <header className="top">
        <div>
          <div className="eyebrow">Shruti</div>
          <h1 className="title">Drone</h1>
        </div>
        <NotationToggle />
      </header>

      <SaPicker />

      <Card>
        <Row label="Drone" sub="Tanpuras + sur-peti">
          <Toggle on={droneOn} onChange={(v) => update({ droneOn: v })} label="Drone" />
        </Row>
        <Row label="Tanpura sound" sub={tanpuraSound === 'recorded' ? 'Your recording for each scale (Pa); real strings for other tunings' : 'Synthesised string model'}>
          <Segmented small value={tanpuraSound} onChange={(v) => update({ tanpuraSound: v })} options={[['recorded', 'Recorded'], ['modelled', 'Modelled']]} />
        </Row>
      </Card>

      <TanpuraCard k={0} />
      <TanpuraCard k={1} />

      <Card>
        <Row label="Sur-peti" sub="Shruti box reed drone">
          <Toggle on={surpeti.on} onChange={(on) => update((s) => ({ surpeti: { ...s.surpeti, on } }))} label="Sur-peti" />
        </Row>
        <div className="chips">
          {SUR.map(([m, notes]) => (
            <Chip key={m} on={surpeti.mode === m} onClick={() => update((s) => ({ surpeti: { ...s.surpeti, mode: m } }))}>
              {notes.map((n, i) => <span key={n}>{i > 0 && ' · '}<NoteLabel semi={n} /></span>)}
            </Chip>
          ))}
        </div>
      </Card>

      <Card>
        <Row label="Manjira" sub="Auto-plays on bhajan taals (Dadra, Keherva, Rupak…)">
          <Toggle on={manjiraOn} onChange={(v) => update({ manjiraOn: v })} label="Manjira" />
        </Row>
      </Card>

      <p className="foot muted small">
        Indian notation: <span className="note swara komal">{SWARA[1]}</span> = komal, <span className="note swara tivra">{SWARA[6]}</span> = tivra,
        dot below = mandra saptak. Sa range A2 – E4.
      </p>
    </div>
  );
}
