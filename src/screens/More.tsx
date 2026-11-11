import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { CHANNELS, CHANNEL_LABEL, DEFAULTS, setMix, update, useStore } from '../store';
import { engine, EQ_PRESETS } from '../audio/engine';
import { detectPitch } from '../audio/pitch';
import { freqMidi, midiName, SA_MAX, SA_MIN } from '../music/notation';
import { NoteLabel } from '../components/NoteLabel';
import { Icon } from '../components/Icon';
import { Card, Chip, Row, Segmented, Slider, Toggle } from '../components/ui';

type Section = 'mixer' | 'tuner' | 'record' | 'settings';

// ───────────────────────── Mixer ─────────────────────────
function Mixer() {
  const mix = useStore((s) => s.mix);
  const master = useStore((s) => s.master);
  const eq = useStore((s) => s.eq);
  return (
    <>
      <Card>
        <Row label="Master">
          <Slider value={master} min={0} max={1} step={0.01} onChange={(v) => update({ master: v })} label="Master volume" />
        </Row>
      </Card>
      <Card>
        {CHANNELS.map((c) => (
          <div className="mix-ch" key={c}>
            <div className="mix-top">
              <span className={mix[c].mute ? 'muted' : ''}>{CHANNEL_LABEL[c]}</span>
              <button className={`mute ${mix[c].mute ? 'on' : ''}`} onClick={() => setMix(c, { mute: !mix[c].mute })}>
                {mix[c].mute ? 'Muted' : 'M'}
              </button>
            </div>
            <div className="mix-ctl">
              <span className="mix-cap">Vol</span>
              <Slider value={mix[c].vol} min={0} max={1} step={0.01} onChange={(vol) => setMix(c, { vol })} label={`${CHANNEL_LABEL[c]} volume`} />
              <span className="mix-cap">Pan</span>
              <div className="pan">
                <Slider value={mix[c].pan} min={-1} max={1} step={0.05} onChange={(pan) => setMix(c, { pan })} label={`${CHANNEL_LABEL[c]} pan`} />
              </div>
            </div>
          </div>
        ))}
      </Card>
      <Card>
        <div className="label">Equalizer</div>
        <div className="chips wrap">
          {Object.keys(EQ_PRESETS).map((k) => (
            <Chip key={k} on={eq === k} onClick={() => update({ eq: k })}>{k}</Chip>
          ))}
        </div>
      </Card>
      <button className="link center-block" onClick={() => update({ mix: DEFAULTS.mix, master: DEFAULTS.master, eq: 'Flat' })}>Reset mixer</button>
    </>
  );
}

// ───────────────────────── Tuner ─────────────────────────
function Tuner() {
  const saMidi = useStore((s) => s.saMidi);
  const fineCents = useStore((s) => s.fineCents);
  const [on, setOn] = useState(false);
  const [hz, setHz] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => () => stopRef.current(), []);

  const start = async () => {
    setErr('');
    try {
      const ctx = engine.wakeCtx();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 4096;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      const hist: number[] = [];
      const id = window.setInterval(() => {
        an.getFloatTimeDomainData(buf);
        const f = detectPitch(buf, ctx.sampleRate);
        if (f) {
          hist.push(f);
          if (hist.length > 5) hist.shift();
          setHz([...hist].sort((a, b) => a - b)[Math.floor(hist.length / 2)]);
        } else if (hist.length) {
          hist.shift();
          if (!hist.length) setHz(null);
        }
      }, 70);
      stopRef.current = () => {
        clearInterval(id);
        src.disconnect();
        stream.getTracks().forEach((t) => t.stop());
        setOn(false);
      };
      setOn(true);
    } catch {
      setErr('Microphone access was blocked. Allow it in your browser settings and try again.');
    }
  };

  // Position relative to Sa (with fine tuning), in semitones.
  const rel = hz ? freqMidi(hz) - (saMidi + fineCents / 100) : 0;
  const semi = Math.round(rel);
  const cents = Math.round((rel - semi) * 100);
  const inTune = Math.abs(cents) <= 5;

  const setAsSa = () => {
    if (!hz) return;
    let m = freqMidi(hz);
    while (m < SA_MIN - 0.5) m += 12;
    while (m > SA_MAX + 0.5) m -= 12;
    const r = Math.round(m);
    update({ saMidi: r, fineCents: Math.round((m - r) * 100) });
  };

  return (
    <Card className="tuner">
      <div className={`tuner-note ${hz ? (inTune ? 'ok' : '') : 'idle'}`}>
        {hz ? <NoteLabel semi={semi} octave /> : '—'}
      </div>
      <div className="tuner-sub">{hz ? `${midiName(freqMidi(hz))} · ${hz.toFixed(1)} Hz` : on ? 'Play or sing a note…' : 'Tuner is off'}</div>
      <div className="meter">
        <div className="meter-scale">
          <span>−50</span><span>0</span><span>+50</span>
        </div>
        <div className="meter-track">
          <div className="meter-center" />
          {hz && <div className={`meter-needle ${inTune ? 'ok' : ''}`} style={{ left: `${50 + cents}%` }} />}
        </div>
        <div className={`meter-cents ${inTune ? 'ok' : ''}`}>{hz ? `${cents > 0 ? '+' : ''}${cents}¢` : ''}</div>
      </div>
      <div className="strum-row">
        <button className={on ? 'pill big' : 'btn-primary'} onClick={() => (on ? stopRef.current() : void start())}>
          <Icon name="mic" size={18} /> {on ? 'Stop tuner' : 'Start tuner'}
        </button>
        {on && <button className="pill big" disabled={!hz} onClick={setAsSa}>Set as Sa</button>}
      </div>
      {err && <p className="error">{err}</p>}
      <p className="muted small center">Notes are shown relative to your Sa. “Set as Sa” tunes the app to your instrument.</p>
    </Card>
  );
}

// ───────────────────────── Recorder ─────────────────────────
interface Take { url: string; name: string; ext: string; secs: number }
const useTakes = create<{ takes: Take[] }>(() => ({ takes: [] }));

function Recorder() {
  const takes = useTakes((s) => s.takes);
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const [backing, setBacking] = useState(true);
  const [monitor, setMonitor] = useState(false);
  const [err, setErr] = useState('');
  const stopRef = useRef<() => void>(() => {});
  useEffect(() => () => stopRef.current(), []);

  const start = async () => {
    setErr('');
    try {
      const ctx = engine.wakeCtx();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      engine.setBackingInRecording(backing);
      const src = ctx.createMediaStreamSource(stream);
      const g = ctx.createGain();
      src.connect(g).connect(engine.recDest);
      if (monitor) g.connect(ctx.destination);
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m));
      const mr = new MediaRecorder(engine.recDest.stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      const t0 = Date.now();
      const timer = window.setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 250);
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = () => {
        const type = mr.mimeType || mime || 'audio/webm';
        const blob = new Blob(chunks, { type });
        const n = useTakes.getState().takes.length + 1;
        const take = { url: URL.createObjectURL(blob), name: `Riyaz take ${n}`, ext: type.includes('mp4') ? 'm4a' : 'webm', secs: Math.round((Date.now() - t0) / 1000) };
        useTakes.setState((s) => ({ takes: [take, ...s.takes] }));
      };
      mr.start(250);
      stopRef.current = () => {
        if (mr.state !== 'inactive') mr.stop();
        clearInterval(timer);
        g.disconnect();
        src.disconnect();
        stream.getTracks().forEach((t) => t.stop());
        engine.setBackingInRecording(true);
        setRec(false);
      };
      setSecs(0);
      setRec(true);
    } catch {
      setErr('Could not access the microphone. Allow it in your browser settings and try again.');
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <>
      <Card className="recorder">
        <button className={`rec-btn ${rec ? 'on' : ''}`} onClick={() => (rec ? stopRef.current() : void start())} aria-label={rec ? 'Stop recording' : 'Start recording'}>
          <Icon name={rec ? 'stop' : 'rec'} size={30} />
        </button>
        <div className="rec-time">{rec ? fmt(secs) : 'Ready to record'}</div>
        <p className="muted small center">Sing or play along — your mic is mixed with the backing. Use headphones to avoid echo.</p>
      </Card>
      <Card>
        <Row label="Include backing track" sub="Tabla, tanpura & everything you hear">
          <Toggle on={backing} onChange={setBacking} label="Include backing" />
        </Row>
        <Row label="Hear yourself" sub="Headphones only">
          <Toggle on={monitor} onChange={setMonitor} label="Monitor" />
        </Row>
      </Card>
      {err && <p className="error">{err}</p>}
      {takes.length > 0 && (
        <Card>
          <div className="label">Takes (this session)</div>
          {takes.map((t) => (
            <div className="take" key={t.url}>
              <div className="take-head">
                <span>{t.name}</span>
                <span className="muted small">{fmt(t.secs)}</span>
                <a className="icon-btn" href={t.url} download={`${t.name}.${t.ext}`} aria-label="Download"><Icon name="import" size={18} /></a>
              </div>
              <audio controls src={t.url} />
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

// ───────────────────────── Settings ─────────────────────────
function Settings() {
  const s = useStore();
  return (
    <>
      <Card>
        <Row label="Notation" sub={s.notation === 'indian' ? 'Sa Re Ga Ma Pa Dha Ni' : 'C D E F G A B (actual pitch)'}>
          <Segmented small value={s.notation} onChange={(v) => update({ notation: v })} options={[['indian', 'Indian'], ['western', 'Western']]} />
        </Row>
        <Row label="Harmonium scale names" sub="Show Sa as Safed / Kali (e.g. Kali 1 = C♯)">
          <Toggle on={s.harmoniumNames} onChange={(v) => update({ harmoniumNames: v })} label="Harmonium names" />
        </Row>
        <Row label="Tabla sound" sub={s.tablaSound === 'theka' ? 'Real theka recording where available (Teentaal), bols otherwise' : 'Stroke-by-stroke real bols'}>
          <Segmented small value={s.tablaSound} onChange={(v) => update({ tablaSound: v })} options={[['theka', 'Theka'], ['bols', 'Bols']]} />
        </Row>
        <Row label="Keep screen awake" sub="While playing">
          <Toggle on={s.keepAwake} onChange={(v) => update({ keepAwake: v })} label="Keep awake" />
        </Row>
      </Card>
      <Card>
        <div className="label">About</div>
        <p className="muted small">
          Tanpura (every tuning) and tabla use real recordings, retuned to your Sa. The manjira, sur-peti and
          swar mandal are synthesized live, tuned to your Sa.
        </p>
      </Card>
      <Card>
        <div className="label">Credits</div>
        <p className="muted small">
          Tanpura (every scale, Pa tuning): “Tanpura (all scales)” by Amitava Sarkar, MUSIFINE and “Tanpura (F# Scale)”
          by Nawaraj Khatri — used under your licence.
        </p>
        <p className="muted small">
          Tanpura strings (Ma, Ni and other tunings): single-string recordings by <a href="https://freesound.org/people/luckylittleraven/packs/23512/" target="_blank" rel="noreferrer">luckylittleraven</a> on
          Freesound, CC0.
        </p>
        <p className="muted small">
          Teentaal theka: <a href="https://freesound.org/s/525154/" target="_blank" rel="noreferrer">“Tabla Teentaal with Baya”</a> by tablage on Freesound,{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Cut per matra, ring extended, retuned.
        </p>
        <p className="muted small">
          Tabla strokes: from <a href="https://github.com/oormicreations/naad" target="_blank" rel="noreferrer">Naad</a> by Oormi Creations,
          MIT License — Copyright (c) Oormi Creations and Contributors. Trimmed and retuned.
        </p>
      </Card>
      <button className="link center-block danger"
        onClick={() => confirm('Reset all settings? Your saved presets and favorites will be kept.') &&
          update((st) => ({ ...DEFAULTS, custom: st.custom, favorites: st.favorites, playing: st.playing, tab: 'more' }))}>
        Reset settings
      </button>
    </>
  );
}

export function More() {
  const [sec, setSec] = useState<Section>('mixer');
  return (
    <div className="page">
      <header className="top">
        <div>
          <div className="eyebrow">Tools</div>
          <h1 className="title">{{ mixer: 'Mixer', tuner: 'Tuner', record: 'Record', settings: 'Settings' }[sec]}</h1>
        </div>
      </header>
      <div className="tool-tabs">
        {([['mixer', 'sliders', 'Mixer'], ['tuner', 'tuner', 'Tuner'], ['record', 'mic', 'Record'], ['settings', 'gear', 'Settings']] as [Section, string, string][]).map(([id, icon, label]) => (
          <button key={id} className={sec === id ? 'on' : ''} onClick={() => setSec(id)}>
            <Icon name={icon} size={20} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      {sec === 'mixer' && <Mixer />}
      {sec === 'tuner' && <Tuner />}
      {sec === 'record' && <Recorder />}
      {sec === 'settings' && <Settings />}
    </div>
  );
}
