import { CalendarClock, History, PackageCheck, Plus, Trash2, Wrench } from 'lucide-react';
import {
  equipmentConditionLabel,
  equipmentLifeInfo,
  equipmentLifeStatusLabel,
  equipmentLogActionLabel,
  formatEquipmentDate,
} from '../lib/equipment';
import { createId } from '../lib/id';
import type { EquipmentCondition, EquipmentInventory, EquipmentItem, EquipmentLogAction, EquipmentLogEntry } from '../types';

interface EquipmentManagerProps {
  inventory: EquipmentInventory;
  onSave: (inventory: EquipmentInventory) => void;
}

const ACTIONS: EquipmentLogAction[] = ['replaced', 'repaired', 'serviced', 'cleaned', 'inspected'];

function todayValue(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
}

function parseAction(value: string): EquipmentLogAction | undefined {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '');
  const aliases: Record<string, EquipmentLogAction> = {
    replace: 'replaced', replaced: 'replaced', repair: 'repaired', repaired: 'repaired',
    service: 'serviced', serviced: 'serviced', clean: 'cleaned', cleaned: 'cleaned',
    inspect: 'inspected', inspected: 'inspected',
  };
  return aliases[normalized];
}

export function EquipmentManager({ inventory, onSave }: EquipmentManagerProps) {
  function saveItems(items: EquipmentItem[]) {
    onSave({ items });
  }

  function updateItem(itemId: string, changes: Partial<EquipmentItem>) {
    saveItems(inventory.items.map((item) => item.id === itemId ? { ...item, ...changes } : item));
  }

  function addItem() {
    const label = window.prompt('Equipment name:')?.trim();
    if (!label) return;
    saveItems([
      ...inventory.items,
      { id: createId('equipment'), label, condition: 'good', updatedAt: new Date().toISOString(), log: [] },
    ]);
  }

  function editItem(item: EquipmentItem) {
    const label = window.prompt('Equipment name:', item.label)?.trim();
    if (!label) return;
    const note = window.prompt('Optional condition note:', item.note ?? '');
    if (note === null) return;
    updateItem(item.id, { label, note: note.trim() || undefined, updatedAt: new Date().toISOString() });
  }

  function updateCondition(item: EquipmentItem, condition: EquipmentCondition) {
    updateItem(item.id, { condition, updatedAt: new Date().toISOString() });
  }

  function setReplacementSchedule(item: EquipmentItem) {
    const intervalAnswer = window.prompt(
      'Replace every how many months? Leave blank to remove the replacement schedule.',
      item.replacementIntervalMonths ? String(item.replacementIntervalMonths) : '',
    );
    if (intervalAnswer === null) return;

    const trimmedInterval = intervalAnswer.trim();
    const interval = trimmedInterval ? Number(trimmedInterval) : undefined;
    if (interval !== undefined && (!Number.isFinite(interval) || interval < 1 || interval > 600)) {
      window.alert('Enter a replacement lifespan between 1 and 600 months.');
      return;
    }

    const dateAnswer = window.prompt(
      'Last replaced date (YYYY-MM-DD). Leave blank if it has not been recorded yet.',
      item.lastReplacedDate ?? '',
    );
    if (dateAnswer === null) return;
    const lastReplacedDate = dateAnswer.trim() || undefined;
    if (lastReplacedDate && !validDate(lastReplacedDate)) {
      window.alert('Enter the date as YYYY-MM-DD.');
      return;
    }

    updateItem(item.id, {
      replacementIntervalMonths: interval ? Math.round(interval) : undefined,
      lastReplacedDate,
      updatedAt: new Date().toISOString(),
    });
  }

  function logActivity(item: EquipmentItem) {
    const answer = window.prompt(`Activity (${ACTIONS.map(equipmentLogActionLabel).join(', ')}):`, 'Replaced');
    if (answer === null) return;
    const action = parseAction(answer);
    if (!action) {
      window.alert('Choose Replaced, Repaired, Serviced, Cleaned, or Inspected.');
      return;
    }

    const dateAnswer = window.prompt('Date (YYYY-MM-DD):', todayValue());
    if (dateAnswer === null) return;
    const date = dateAnswer.trim();
    if (!validDate(date)) {
      window.alert('Enter the date as YYYY-MM-DD.');
      return;
    }

    const noteAnswer = window.prompt('Optional note:', '');
    if (noteAnswer === null) return;
    const entry: EquipmentLogEntry = {
      id: createId('equipment-log'),
      action,
      date,
      note: noteAnswer.trim() || undefined,
    };
    const log = [entry, ...(item.log ?? [])].sort((a, b) => b.date.localeCompare(a.date));

    updateItem(item.id, {
      log,
      lastReplacedDate: action === 'replaced' ? date : item.lastReplacedDate,
      condition: action === 'replaced' ? 'good' : item.condition,
      updatedAt: new Date().toISOString(),
    });
  }

  function deleteLog(item: EquipmentItem, logId: string) {
    if (!window.confirm('Delete this equipment log entry?')) return;
    const removed = (item.log ?? []).find((entry) => entry.id === logId);
    const log = (item.log ?? []).filter((entry) => entry.id !== logId);
    const latestReplacement = log.find((entry) => entry.action === 'replaced');
    updateItem(item.id, {
      log,
      lastReplacedDate: removed?.action === 'replaced' ? latestReplacement?.date : item.lastReplacedDate,
    });
  }

  function deleteItem(item: EquipmentItem) {
    if (!window.confirm(`Delete “${item.label}” and its equipment log?`)) return;
    saveItems(inventory.items.filter((entry) => entry.id !== item.id));
  }

  return (
    <>
      <div className="equipment-manager-banner">
        <div className="equipment-manager-copy">
          <span className="equipment-manager-icon"><PackageCheck /></span>
          <div>
            <strong>{inventory.items.length} equipment item{inventory.items.length === 1 ? '' : 's'}</strong>
            <span>Track condition, replacement lifespan, and a simple history of maintenance or replacement.</span>
          </div>
        </div>
        <button className="primary-button" onClick={addItem}><Plus size={17} /> Add equipment</button>
      </div>

      {inventory.items.length ? (
        <div className="equipment-manager-list">
          {inventory.items.map((item) => {
            const life = equipmentLifeInfo(item);
            const scheduleText = item.replacementIntervalMonths
              ? item.lastReplacedDate
                ? `Replace every ${item.replacementIntervalMonths} month${item.replacementIntervalMonths === 1 ? '' : 's'} · next due ${formatEquipmentDate(life.nextDueDate)}`
                : `Replace every ${item.replacementIntervalMonths} month${item.replacementIntervalMonths === 1 ? '' : 's'} · last replacement not recorded`
              : 'No replacement lifespan set';
            const detailText = item.note
              ?? (item.lastReplacedDate ? `Last replaced ${formatEquipmentDate(item.lastReplacedDate)}` : 'No condition note');
            return (
              <article className={`equipment-manager-row equipment-${item.condition} life-${life.status}`} key={item.id}>
                <div className="equipment-manager-item-copy">
                  <strong>{item.label}</strong>
                  <span>{detailText}</span>
                  <small>{scheduleText}</small>
                </div>
                <label className="equipment-condition-field">
                  <span>Condition</span>
                  <select value={item.condition} onChange={(event) => updateCondition(item, event.target.value as EquipmentCondition)}>
                    <option value="good">Good</option>
                    <option value="watch">Watch</option>
                    <option value="replace">Needs replaced</option>
                  </select>
                </label>
                <div className="equipment-status-pills">
                  <span className={`equipment-condition-pill ${item.condition}`}>{equipmentConditionLabel(item.condition)}</span>
                  {life.status !== 'none' && <span className={`equipment-life-pill ${life.status}`}>{equipmentLifeStatusLabel(life.status)}</span>}
                </div>
                <div className="equipment-row-actions">
                  <button className="secondary-button" onClick={() => logActivity(item)}><History size={16} /> Log activity</button>
                  <button className="secondary-button" onClick={() => setReplacementSchedule(item)}><CalendarClock size={16} /> Lifespan</button>
                  <button className="secondary-button" onClick={() => editItem(item)}>Edit</button>
                  <button className="danger-button" onClick={() => deleteItem(item)}><Trash2 size={16} /> Delete</button>
                </div>

                <div className="equipment-maintenance-panel">
                  <div className={`equipment-lifespan-summary ${life.status}`}>
                    <CalendarClock size={17} />
                    <span><strong>{equipmentLifeStatusLabel(life.status)}</strong>{life.status === 'overdue' && life.daysRemaining !== undefined ? ` · ${Math.abs(life.daysRemaining)} days overdue` : ''}{life.status === 'nearing' && life.daysRemaining !== undefined ? ` · ${life.daysRemaining} days remaining` : ''}</span>
                  </div>
                  {(item.log ?? []).length > 0 ? (
                    <details className="equipment-log">
                      <summary><History size={16} /> Equipment log ({item.log?.length})</summary>
                      <div className="equipment-log-list">
                        {(item.log ?? []).map((entry) => (
                          <div className="equipment-log-entry" key={entry.id}>
                            <div><strong>{equipmentLogActionLabel(entry.action)}</strong><span>{formatEquipmentDate(entry.date)}{entry.note ? ` · ${entry.note}` : ''}</span></div>
                            <button title="Delete log entry" onClick={() => deleteLog(item, entry.id)}><Trash2 size={15} /></button>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : (
                    <span className="equipment-no-log">No equipment history yet.</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state equipment-empty-state"><Wrench size={42} /><h3>Add your camping equipment</h3><p>Track hoses, filters, surge protectors, cords, tools, and anything else that may need maintenance or replacement.</p><button className="primary-button" onClick={addItem}><Plus size={17} /> Add first equipment item</button></div>
      )}
    </>
  );
}
