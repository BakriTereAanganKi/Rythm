import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';
import { Icon } from './Icon';

export function Segmented<T extends string | number>({
  options, value, onChange, small,
}: { options: [T, ReactNode][]; value: T; onChange: (v: T) => void; small?: boolean }) {
  return (
    <div className={`seg ${small ? 'seg-sm' : ''}`}>
      {options.map(([v, label]) => (
        <button key={String(v)} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ on, children, onClick, className = '' }: { on?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button className={`chip ${on ? 'on' : ''} ${className}`} onClick={onClick}>
      {children}
    </button>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

export function Slider({
  value, min, max, step = 1, onChange, label,
}: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label?: string }) {
  const p = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range" className="slider" min={min} max={max} step={step} value={value} aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ '--p': `${p}%` } as CSSProperties}
    />
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  if (!open) return null;
  return createPortal(
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Row({ label, children, sub }: { label: ReactNode; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="row">
      <div className="row-label">
        <div>{label}</div>
        {sub && <div className="row-sub">{sub}</div>}
      </div>
      <div className="row-ctl">{children}</div>
    </div>
  );
}
