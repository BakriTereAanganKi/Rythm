import { useStore } from '../store';
import { SWARA, HARMONIUM, isKomal, isTivra, midiName, mod12 } from '../music/notation';

/**
 * A note shown in the user's notation.
 * Indian: komal = underlined, tivra = tick above, mandra = dot below, taar = dot above.
 * Western: actual pitch name for the current Sa (e.g. G♯2).
 */
export function NoteLabel({ semi, octave = false }: { semi: number; octave?: boolean }) {
  const notation = useStore((s) => s.notation);
  const saMidi = useStore((s) => s.saMidi);
  if (notation === 'western') return <span className="note">{midiName(saMidi + semi, octave)}</span>;
  const pc = mod12(semi);
  const oct = Math.floor(semi / 12);
  const cls = ['note', 'swara'];
  if (isKomal(pc)) cls.push('komal');
  if (isTivra(pc)) cls.push('tivra');
  if (octave && oct < 0) cls.push('mandra');
  if (octave && oct > 0) cls.push('taar');
  return <span className={cls.join(' ')}>{SWARA[pc]}</span>;
}

/** "C♯3" or "Kali 1 · C♯3" depending on settings. */
export function SaName() {
  const saMidi = useStore((s) => s.saMidi);
  const harmonium = useStore((s) => s.harmoniumNames && s.notation === 'indian');
  return (
    <>
      {harmonium && <>{HARMONIUM[mod12(saMidi)]} · </>}
      {midiName(saMidi)}
    </>
  );
}
