import { AlertTriangle, CalendarClock, Check, Plus, ShieldCheck, Trash2, Wrench } from 'lucide-react';
import { useState } from 'react';
import { createId } from '../lib/id';
import { maintenanceTiming, nextMaintenanceDate, type CamperMaintenanceRecord, type MaintenanceAction, type MaintenanceCondition, type MaintenanceReminder } from '../lib/camperMaintenance';

function formatDate(value?: string): string {
  if (!value) return 'Not completed yet';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function intervalLabel(days: number): string {
  if (days % 365 === 0) return `Every ${days / 365} ${days === 365 ? 'year' : 'years'}`;
  if (days % 30 === 0) return `Every ${days / 30} ${days === 30 ? 'month' : 'months'}`;
  return `Every ${days} days`;
}

export function CamperMaintenanceManager({ record, onChange }: {
  record: CamperMaintenanceRecord;
  onChange: (record: CamperMaintenanceRecord) => void;
}) {
  const [label, setLabel] = useState('');
  const [intervalDays, setIntervalDays] = useState('90');

  function addReminder(event: React.FormEvent) {
    event.preventDefault();
    const days = Math.round(Number(intervalDays));
    if (!label.trim() || !Number.isFinite(days) || days < 1) return;
    onChange({
      ...record,
      maintenance: [...record.maintenance, { id: createId('maintenance'), label: label.trim(), intervalDays: days, condition: 'good' }],
    });
    setLabel('');
  }

  function updateReminder(id: string, patch: Partial<MaintenanceReminder>) {
    onChange({ ...record, maintenance: record.maintenance.map((item) => item.id === id ? { ...item, ...patch } : item) });
  }

  function complete(id: string, action: MaintenanceAction) {
    updateReminder(id, { lastCompletedDate: new Date().toISOString().slice(0, 10), lastAction: action, condition: 'good' });
  }

  return (
    <section className="camper-maintenance-section">
      <div className="camper-maintenance-heading">
        <div><p className="eyebrow">Maintenance</p><h3>Service reminders</h3><p>Only campers marked in use generate reminders.</p></div>
        <label className="camper-use-toggle"><input type="checkbox" checked={record.active} onChange={(event) => onChange({ ...record, active: event.target.checked })} /><span>{record.active ? 'In use' : 'Not in use'}</span></label>
      </div>

      {!record.active ? (
        <div className="maintenance-paused"><ShieldCheck size={22} /><div><strong>Maintenance paused</strong><span>This camper remains in trip history, but no reminders are due.</span></div></div>
      ) : (
        <>
          <form className="maintenance-add-form" onSubmit={addReminder}>
            <label className="field"><span>Reminder</span><input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Roof and seals" /></label>
            <label className="field"><span>Repeat every</span><select value={intervalDays} onChange={(event) => setIntervalDays(event.target.value)}><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option><option value="180">6 months</option><option value="365">1 year</option></select></label>
            <button type="submit" className="secondary-button" disabled={!label.trim()}><Plus size={16} /> Add reminder</button>
          </form>

          <div className="maintenance-list">
            {record.maintenance.map((item) => {
              const timing = maintenanceTiming(item);
              const next = nextMaintenanceDate(item);
              return <article className={`maintenance-card ${timing} condition-${item.condition}`} key={item.id}>
                <div className="maintenance-card-top"><div><strong>{item.label}</strong><span>{intervalLabel(item.intervalDays)}</span></div><button type="button" className="icon-button" aria-label={`Delete ${item.label}`} onClick={() => onChange({ ...record, maintenance: record.maintenance.filter((entry) => entry.id !== item.id) })}><Trash2 size={16} /></button></div>
                <div className="maintenance-meta"><span><CalendarClock size={14} /> Last: {formatDate(item.lastCompletedDate)}</span><span className={`maintenance-timing ${timing}`}>{timing === 'overdue' ? 'Overdue' : timing === 'soon' ? 'Due soon' : timing === 'current' ? `Due ${formatDate(next)}` : 'Set first service date'}</span></div>
                <label className="maintenance-condition"><span>Condition</span><select value={item.condition} onChange={(event) => updateReminder(item.id, { condition: event.target.value as MaintenanceCondition })}><option value="good">Good</option><option value="watch">Watch</option><option value="attention">Needs attention</option></select></label>
                <div className="maintenance-actions"><button type="button" onClick={() => complete(item.id, 'checked')}><Check size={15} /> Checked</button><button type="button" onClick={() => complete(item.id, 'maintained')}><Wrench size={15} /> Maintained</button><button type="button" onClick={() => complete(item.id, 'warrantied')}><ShieldCheck size={15} /> Warrantied</button></div>
                {item.condition !== 'good' && <div className="maintenance-warning"><AlertTriangle size={15} /> {item.condition === 'watch' ? 'Keep an eye on this item.' : 'This item needs attention.'}</div>}
              </article>;
            })}
            {!record.maintenance.length && <div className="mini-empty-state">No maintenance reminders yet. Add the first one above.</div>}
          </div>
        </>
      )}
    </section>
  );
}
