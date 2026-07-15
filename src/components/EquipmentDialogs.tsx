import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CalendarClock, History, PackagePlus, X } from 'lucide-react';
import { equipmentLogActionLabel } from '../lib/equipment';
import type { EquipmentCondition, EquipmentItem, EquipmentLogAction } from '../types';

const ACTIONS: EquipmentLogAction[] = ['replaced', 'repaired', 'serviced', 'cleaned', 'inspected'];

function todayValue(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function DialogShell({
  eyebrow,
  title,
  description,
  icon,
  submitLabel,
  onClose,
  onSubmit,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop equipment-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="modal-card equipment-dialog" role="dialog" aria-modal="true" aria-labelledby="equipment-dialog-title" onSubmit={onSubmit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="equipment-dialog-header">
          <span className="equipment-dialog-icon">{icon}</span>
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id="equipment-dialog-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="equipment-dialog-body">{children}</div>
        <div className="modal-actions equipment-dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button">{submitLabel}</button>
        </div>
      </form>
    </div>
  );
}

export function EquipmentItemDialog({ item, onClose, onSave }: {
  item?: EquipmentItem;
  onClose: () => void;
  onSave: (value: { label: string; note?: string; condition: EquipmentCondition; inServiceDate?: string }) => void;
}) {
  const [label, setLabel] = useState(item?.label ?? '');
  const [note, setNote] = useState(item?.note ?? '');
  const [condition, setCondition] = useState<EquipmentCondition>(item?.condition ?? 'good');
  const [inServiceDate, setInServiceDate] = useState(item?.inServiceDate ?? '');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setError('Equipment name cannot be blank.');
      inputRef.current?.focus();
      return;
    }
    if (inServiceDate && inServiceDate > todayValue()) {
      setError('The in-service date cannot be in the future.');
      return;
    }
    onSave({ label: trimmed, note: note.trim() || undefined, condition, inServiceDate: inServiceDate || undefined });
    onClose();
  }

  return (
    <DialogShell
      eyebrow={item ? 'Update equipment' : 'Equipment inventory'}
      title={item ? `Edit ${item.label}` : 'Add equipment'}
      description="Keep the item name, age, current condition, and any useful note together."
      icon={<PackagePlus />}
      submitLabel={item ? 'Save equipment' : 'Add equipment'}
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="equipment-dialog-grid">
        <label className="field equipment-dialog-name">
          <span>Equipment name</span>
          <input ref={inputRef} value={label} onChange={(event) => { setLabel(event.target.value); setError(''); }} placeholder="Water filter" aria-invalid={Boolean(error)} />
        </label>
        <label className="field">
          <span>Current condition</span>
          <select value={condition} onChange={(event) => setCondition(event.target.value as EquipmentCondition)}>
            <option value="good">Good</option>
            <option value="watch">Watch</option>
            <option value="replace">Needs replaced</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>In service date <small>Optional</small></span>
        <input type="date" max={todayValue()} value={inServiceDate} onChange={(event) => { setInServiceDate(event.target.value); setError(''); }} />
      </label>
      {error && <p className="equipment-dialog-error">{error}</p>}
      <label className="field">
        <span>Condition note <small>Optional</small></span>
        <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Small leak near the faucet connection" />
      </label>
    </DialogShell>
  );
}

export function EquipmentLogDialog({ item, onClose, onSave }: {
  item: EquipmentItem;
  onClose: () => void;
  onSave: (value: { action: EquipmentLogAction; date: string; note?: string }) => void;
}) {
  const [action, setAction] = useState<EquipmentLogAction>('replaced');
  const [date, setDate] = useState(todayValue());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date) {
      setError('Choose the date this work was completed.');
      return;
    }
    onSave({ action, date, note: note.trim() || undefined });
    onClose();
  }

  return (
    <DialogShell
      eyebrow="Equipment history"
      title={`Log activity for ${item.label}`}
      description="Add one simple maintenance or replacement entry to this item’s history."
      icon={<History />}
      submitLabel="Add log entry"
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="equipment-dialog-grid">
        <label className="field">
          <span>Activity</span>
          <select value={action} onChange={(event) => setAction(event.target.value as EquipmentLogAction)}>
            {ACTIONS.map((value) => <option value={value} key={value}>{equipmentLogActionLabel(value)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(event) => { setDate(event.target.value); setError(''); }} />
        </label>
      </div>
      {error && <p className="equipment-dialog-error">{error}</p>}
      <label className="field">
        <span>Note <small>Optional</small></span>
        <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Replaced with a new Camco filter" />
      </label>
      {action === 'replaced' && <div className="equipment-dialog-callout">Logging a replacement updates the last-replaced date and returns the condition to <strong>Good</strong>.</div>}
    </DialogShell>
  );
}

export function EquipmentLifespanDialog({ item, onClose, onSave }: {
  item: EquipmentItem;
  onClose: () => void;
  onSave: (value: { replacementIntervalMonths?: number; lastReplacedDate?: string }) => void;
}) {
  const [interval, setInterval] = useState(item.replacementIntervalMonths ? String(item.replacementIntervalMonths) : '');
  const [lastReplacedDate, setLastReplacedDate] = useState(item.lastReplacedDate ?? '');
  const [error, setError] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = interval.trim() ? Number(interval) : undefined;
    if (parsed !== undefined && (!Number.isFinite(parsed) || parsed < 1 || parsed > 600)) {
      setError('Enter a lifespan from 1 to 600 months, or leave it blank to remove the schedule.');
      return;
    }
    onSave({
      replacementIntervalMonths: parsed === undefined ? undefined : Math.round(parsed),
      lastReplacedDate: lastReplacedDate || undefined,
    });
    onClose();
  }

  return (
    <DialogShell
      eyebrow="Replacement planning"
      title={`Set lifespan for ${item.label}`}
      description="Camp Ledger will calculate the next replacement date and warn you when it is getting close."
      icon={<CalendarClock />}
      submitLabel="Save lifespan"
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="equipment-dialog-grid">
        <label className="field">
          <span>Replace every</span>
          <div className="equipment-month-input"><input type="number" min="1" max="600" inputMode="numeric" value={interval} onChange={(event) => { setInterval(event.target.value); setError(''); }} placeholder="6" /><span>months</span></div>
        </label>
        <label className="field">
          <span>Last replaced date <small>Optional</small></span>
          <input type="date" value={lastReplacedDate} onChange={(event) => setLastReplacedDate(event.target.value)} />
        </label>
      </div>
      {error && <p className="equipment-dialog-error">{error}</p>}
      <div className="equipment-dialog-callout">Leave the lifespan blank to remove automatic replacement warnings. The equipment history will remain.</div>
    </DialogShell>
  );
}
