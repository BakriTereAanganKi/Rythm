import { useMemo, useRef, useState } from 'react';
import { useStore, update, applyPreset, currentAsPreset, toggleFavorite, type Preset } from '../store';
import { RAAG_PRESETS } from '../music/raags';
import { getTaal } from '../music/taals';
import { midiName } from '../music/notation';
import { NoteLabel } from '../components/NoteLabel';
import { Icon } from '../components/Icon';
import { Segmented, Sheet, Toggle } from '../components/ui';

type Filter = 'all' | 'fav' | 'mine';

function PresetMeta({ p }: { p: Preset }) {
  return (
    <>
      {p.saMidi != null && <>{midiName(p.saMidi)} · </>}
      T1 {p.t1 === null ? 'Off' : <NoteLabel semi={p.t1} />} · T2 {p.t2 === null ? 'Off' : <NoteLabel semi={p.t2} />} ·{' '}
      {p.mode === 'metronome' ? 'Metronome' : getTaal(p.taalId).name} {p.bpm} bpm
    </>
  );
}

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Presets() {
  const custom = useStore((s) => s.custom);
  const favorites = useStore((s) => s.favorites);
  const presetId = useStore((s) => s.presetId);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [withSa, setWithSa] = useState(true);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const all = useMemo(() => [...custom, ...RAAG_PRESETS].sort((a, b) => a.name.localeCompare(b.name)), [custom]);
  const list = all.filter(
    (p) =>
      (filter === 'all' || (filter === 'fav' ? favorites.includes(p.id) : !p.builtin)) &&
      p.name.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const sections = useMemo(() => {
    const m = new Map<string, Preset[]>();
    for (const p of list) {
      const l = /[a-z]/i.test(p.name[0]) ? p.name[0].toUpperCase() : '#';
      m.set(l, [...(m.get(l) ?? []), p]);
    }
    return [...m.entries()];
  }, [list]);

  const flash = (t: string) => {
    setMsg(t);
    setTimeout(() => setMsg(''), 2200);
  };

  const save = () => {
    const p = currentAsPreset(name.trim() || 'My preset', withSa);
    update((s) => ({ custom: [...s.custom, p], presetId: p.id, presetName: p.name }));
    setSaveOpen(false);
    setName('');
    flash(`Saved “${p.name}”`);
  };

  const importFile = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      const arr: Preset[] = Array.isArray(data) ? data : data.presets;
      const clean = arr
        .filter((p) => p && typeof p.name === 'string' && Array.isArray(p.notes))
        .map((p, i) => ({ ...p, builtin: false, id: `my-${Date.now().toString(36)}-${i}` }));
      update((s) => ({ custom: [...s.custom, ...clean] }));
      flash(`Imported ${clean.length} preset${clean.length === 1 ? '' : 's'}`);
    } catch {
      flash('That file is not a valid presets file');
    }
  };

  return (
    <div className="page presets">
      <header className="top">
        <div>
          <div className="eyebrow">{all.length} presets</div>
          <h1 className="title">Presets</h1>
        </div>
        <div className="head-actions">
          <button className="icon-btn" aria-label="Import presets" onClick={() => fileRef.current?.click()}><Icon name="import" /></button>
          <button className="icon-btn" aria-label="Export my presets"
            onClick={() => (custom.length ? download('rythm-presets.json', { app: 'rythm', version: 1, presets: custom }) : flash('Save a preset first, then export'))}>
            <Icon name="share" />
          </button>
          <button className="icon-btn accent" aria-label="Save current as preset" onClick={() => setSaveOpen(true)}><Icon name="plus" /></button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
      </header>

      <label className="search">
        <Icon name="search" size={18} />
        <input placeholder="Search raags" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <button onClick={() => setQ('')} aria-label="Clear"><Icon name="x" size={16} /></button>}
      </label>

      <Segmented value={filter} onChange={setFilter} options={[
        ['all', `All (${all.length})`],
        ['fav', `Favorites (${favorites.length})`],
        ['mine', `Mine (${custom.length})`],
      ]} />

      <div className="preset-wrap">
        <div className="preset-list">
          {sections.length === 0 && <p className="muted center empty">{filter === 'mine' ? 'Tap + to save your current setup as a preset.' : 'Nothing here yet.'}</p>}
          {sections.map(([letter, items]) => (
            <div key={letter} id={`sec-${letter}`}>
              <div className="sec-head">{letter}</div>
              {items.map((p) => {
                const fav = favorites.includes(p.id);
                return (
                  <div key={p.id} className={`preset ${p.id === presetId ? 'on' : ''}`}>
                    <button className={`star ${fav ? 'fav' : ''}`} onClick={() => toggleFavorite(p.id)} aria-label={fav ? 'Unfavorite' : 'Favorite'}>
                      <Icon name="star" size={20} />
                    </button>
                    <button className="preset-main" onClick={() => { applyPreset(p); flash(`Loaded ${p.name}`); }}>
                      <div className="preset-name">{p.name}</div>
                      <div className="preset-meta"><PresetMeta p={p} /></div>
                    </button>
                    {!p.builtin && (
                      <button className="icon-btn" aria-label="Delete preset"
                        onClick={() => confirm(`Delete “${p.name}”?`) && update((s) => ({ custom: s.custom.filter((c) => c.id !== p.id), favorites: s.favorites.filter((f) => f !== p.id) }))}>
                        <Icon name="trash" size={18} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {sections.length > 6 && (
          <div className="az">
            {sections.map(([l]) => (
              <button key={l} onClick={() => document.getElementById(`sec-${l}`)?.scrollIntoView({ block: 'start' })}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {msg && <div className="toast">{msg}</div>}

      <Sheet open={saveOpen} onClose={() => setSaveOpen(false)} title="Save current setup">
        <input className="text-input" autoFocus placeholder="Preset name, e.g. Yaman – evening riyaz" value={name}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        <div className="row">
          <div className="row-label"><div>Include Sa pitch</div><div className="row-sub">Raag presets keep your current Sa</div></div>
          <Toggle on={withSa} onChange={setWithSa} label="Include Sa" />
        </div>
        <button className="btn-primary" onClick={save}>Save preset</button>
      </Sheet>
    </div>
  );
}
