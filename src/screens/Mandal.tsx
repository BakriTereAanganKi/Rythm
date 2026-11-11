import { useRef } from 'react';
import { useStore, update } from '../store';
import { mandalStrings } from '../music/notation';
import { engine } from '../audio/engine';
import { NoteLabel } from '../components/NoteLabel';
import { Icon } from '../components/Icon';
import { Card, Row, Toggle } from '../components/ui';
import { NotationToggle } from './Play';

export function Mandal() {
  const notes = useStore((s) => s.mandal.notes);
  const auto = useStore((s) => s.mandal.auto);
  const presetName = useStore((s) => s.presetName);
  const strings = mandalStrings(notes).reverse(); // highest at the top
  const box = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);

  const toggleNote = (n: number) => {
    if (n === 0) return;
    const next = notes.includes(n) ? notes.filter((x) => x !== n) : [...notes, n].sort((a, b) => a - b);
    update((s) => ({ mandal: { ...s.mandal, notes: next } }));
  };

  const flash = (i: number) => {
    const el = box.current?.children[i] as HTMLElement | undefined;
    if (!el) return;
    el.classList.remove('hit');
    void el.offsetWidth;
    el.classList.add('hit');
  };
  const pluck = (i: number) => {
    engine.pluckMandal(strings[i]);
    flash(i);
  };
  const indexAt = (y: number) => {
    const r = box.current!.getBoundingClientRect();
    return Math.max(0, Math.min(strings.length - 1, Math.floor(((y - r.top) / r.height) * strings.length)));
  };

  return (
    <div className="page">
      <header className="top">
        <div>
          <div className="eyebrow">Tuned to {presetName}</div>
          <h1 className="title">Swar Mandal</h1>
        </div>
        <NotationToggle />
      </header>

      <Card>
        <div className="label">Raag notes</div>
        <div className="note-toggles">
          {Array.from({ length: 12 }, (_, n) => (
            <button key={n} className={`note-toggle ${notes.includes(n) ? 'on' : ''}`} onClick={() => toggleNote(n)} disabled={n === 0}>
              <NoteLabel semi={n} />
            </button>
          ))}
        </div>
      </Card>

      <div
        className="strings" ref={box}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const i = indexAt(e.clientY);
          last.current = i;
          pluck(i);
        }}
        onPointerMove={(e) => {
          if (last.current === null) return;
          const i = indexAt(e.clientY);
          if (i === last.current) return;
          const dir = i > last.current ? 1 : -1;
          for (let j = last.current + dir; j !== i + dir; j += dir) pluck(j);
          last.current = i;
        }}
        onPointerUp={() => (last.current = null)}
        onPointerCancel={() => (last.current = null)}
      >
        {strings.map((semi) => (
          <div className="string" key={semi}>
            <span className="string-label"><NoteLabel semi={semi} octave /></span>
            <span className="string-line" />
          </div>
        ))}
      </div>
      <p className="muted small center">Swipe across the strings to play</p>

      <div className="strum-row">
        <button className="pill big" onClick={() => engine.strum(1)}><Icon name="up" size={18} /> Strum up</button>
        <button className="pill big" onClick={() => engine.strum(-1)}><Icon name="down" size={18} /> Strum down</button>
      </div>

      <Card>
        <Row label="Auto-strum on sam" sub="Strums once every cycle while the taal plays">
          <Toggle on={auto} onChange={(v) => update((s) => ({ mandal: { ...s.mandal, auto: v } }))} label="Auto strum" />
        </Row>
      </Card>
    </div>
  );
}
