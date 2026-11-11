import { useState } from 'react';
import { useStore, setTanpura } from '../store';
import { SWARA_LONG, midiName } from '../music/notation';
import { NoteLabel } from './NoteLabel';
import { Chip, Sheet } from './ui';

const QUICK = [7, 5, 11];

/** Note picker for a tanpura string: Off · Pa · Ma · Ni · … (any other note). */
export function TanpuraRow({ k, field = 'first', label }: { k: 0 | 1; field?: 'first' | 'fifth'; label?: string }) {
  const value = useStore((s) => s.tanpura[k][field]);
  const [open, setOpen] = useState(false);
  const other = value !== null && !QUICK.includes(value);
  const set = (v: number | null) => setTanpura(k, { [field]: v });

  return (
    <div className="tp-row">
      <div className="tp-label">{label ?? `Tanpura ${k + 1}`}</div>
      <div className="chips">
        <Chip on={value === null} onClick={() => set(null)}>Off</Chip>
        {QUICK.map((n) => (
          <Chip key={n} on={value === n} onClick={() => set(n)}><NoteLabel semi={n} /></Chip>
        ))}
        <Chip on={other} onClick={() => setOpen(true)}>{other ? <NoteLabel semi={value!} /> : '…'}</Chip>
      </div>
      <NotePickerSheet
        open={open} onClose={() => setOpen(false)} value={value}
        title={`${label ?? `Tanpura ${k + 1}`} — ${field === 'first' ? 'first string' : 'extra string'}`}
        onPick={(n) => { set(n); setOpen(false); }}
      />
    </div>
  );
}

export function NotePickerSheet({
  open, onClose, value, onPick, title,
}: { open: boolean; onClose: () => void; value: number | null; onPick: (n: number) => void; title: string }) {
  const saMidi = useStore((s) => s.saMidi);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="note-grid">
        {Array.from({ length: 11 }, (_, i) => i + 1).map((n) => (
          <button key={n} className={`note-cell ${value === n ? 'on' : ''}`} onClick={() => onPick(n)}>
            <span className="note-cell-main"><NoteLabel semi={n} /></span>
            <span className="note-cell-sub">{SWARA_LONG[n]} · {midiName(saMidi + n - 12)}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
