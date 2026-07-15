import { FormEvent, useEffect, useRef, useState } from 'react';
import { ClipboardEdit, X } from 'lucide-react';

export interface ChecklistEditDialogConfig {
  eyebrow: string;
  title: string;
  description: string;
  fieldLabel: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel: string;
  onSubmit: (value: string) => void;
}

export function ChecklistEditDialog({ config, onClose }: {
  config: ChecklistEditDialogConfig;
  onClose: () => void;
}) {
  const [value, setValue] = useState(config.initialValue ?? '');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError(`${config.fieldLabel} cannot be blank.`);
      inputRef.current?.focus();
      return;
    }
    config.onSubmit(trimmed);
    onClose();
  }

  return (
    <div className="modal-backdrop checklist-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="modal-card checklist-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="checklist-dialog-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="checklist-dialog-header">
          <span className="checklist-dialog-icon"><ClipboardEdit /></span>
          <div>
            <p className="eyebrow">{config.eyebrow}</p>
            <h2 id="checklist-dialog-title">{config.title}</h2>
            <p>{config.description}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X /></button>
        </div>

        <div className="checklist-dialog-body">
          <label className="field checklist-dialog-field">
            <span>{config.fieldLabel}</span>
            <input
              ref={inputRef}
              value={value}
              onChange={(event) => { setValue(event.target.value); setError(''); }}
              placeholder={config.placeholder}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'checklist-dialog-error' : undefined}
            />
          </label>
          {error && <p className="checklist-dialog-error" id="checklist-dialog-error">{error}</p>}
          <p className="checklist-dialog-help">This change is saved to your shared Camp Ledger data and will be available on your other devices.</p>
        </div>

        <div className="modal-actions checklist-dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button" disabled={!value.trim()}>{config.submitLabel}</button>
        </div>
      </form>
    </div>
  );
}
