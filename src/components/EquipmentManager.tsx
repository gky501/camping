import { useState } from 'react';
import { CalendarClock, History, PackageCheck, Plus, Trash2, Wrench } from 'lucide-react';
import {
  equipmentConditionLabel,
  equipmentLifeInfo,
  equipmentLifeStatusLabel,
  equipmentLogActionLabel,
  formatEquipmentDate,
} from '../lib/equipment';
import { equipmentAgeLabel } from '../lib/equipmentAge';
import { createId } from '../lib/id';
import type { EquipmentCondition, EquipmentInventory, EquipmentItem, EquipmentLogAction, EquipmentLogEntry } from '../types';
import { EquipmentItemDialog, EquipmentLifespanDialog, EquipmentLogDialog } from './EquipmentDialogs';

interface EquipmentManagerProps {
  inventory: EquipmentInventory;
  onSave: (inventory: EquipmentInventory) => void;
}

type EquipmentDialogState =
  | { type: 'item'; item?: EquipmentItem }
  | { type: 'log'; item: EquipmentItem }
  | { type: 'lifespan'; item: EquipmentItem };

export function EquipmentManager({ inventory, onSave }: EquipmentManagerProps) {
  const [dialog, setDialog] = useState<EquipmentDialogState>();

  function saveItems(items: EquipmentItem[]) {
    onSave({ items });
  }

  function updateItem(itemId: string, changes: Partial<EquipmentItem>) {
    saveItems(inventory.items.map((item) => item.id === itemId ? { ...item, ...changes } : item));
  }

  function saveItemForm(value: { label: string; note?: string; condition: EquipmentCondition; inServiceDate?: string }) {
    if (dialog?.type !== 'item') return;
    if (dialog.item) {
      updateItem(dialog.item.id, { ...value, updatedAt: new Date().toISOString() });
      return;
    }
    saveItems([
      ...inventory.items,
      {
        id: createId('equipment'),
        ...value,
        updatedAt: new Date().toISOString(),
        log: [],
      },
    ]);
  }

  function saveLogForm(value: { action: EquipmentLogAction; date: string; note?: string }) {
    if (dialog?.type !== 'log') return;
    const item = dialog.item;
    const entry: EquipmentLogEntry = {
      id: createId('equipment-log'),
      ...value,
    };
    const log = [entry, ...(item.log ?? [])].sort((a, b) => b.date.localeCompare(a.date));
    updateItem(item.id, {
      log,
      lastReplacedDate: value.action === 'replaced' ? value.date : item.lastReplacedDate,
      condition: value.action === 'replaced' ? 'good' : item.condition,
      updatedAt: new Date().toISOString(),
    });
  }

  function saveLifespanForm(value: { replacementIntervalMonths?: number; lastReplacedDate?: string }) {
    if (dialog?.type !== 'lifespan') return;
    updateItem(dialog.item.id, { ...value, updatedAt: new Date().toISOString() });
  }

  function updateCondition(item: EquipmentItem, condition: EquipmentCondition) {
    updateItem(item.id, { condition, updatedAt: new Date().toISOString() });
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
            <span>Track age, condition, replacement lifespan, and a simple history of maintenance or replacement.</span>
          </div>
        </div>
        <button className="primary-button" onClick={() => setDialog({ type: 'item' })}><Plus size={17} /> Add equipment</button>
      </div>

      {inventory.items.length ? (
        <div className="equipment-manager-list">
          {inventory.items.map((item) => {
            const life = equipmentLifeInfo(item);
            const age = equipmentAgeLabel(item);
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
                  <div className="equipment-name-line"><strong>{item.label}</strong>{age && <span className="equipment-age-pill">{age} old</span>}</div>
                  <span>{detailText}</span>
                  <small>{item.inServiceDate ? `In service ${formatEquipmentDate(item.inServiceDate)} · ${scheduleText}` : scheduleText}</small>
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
                  <button className="secondary-button" onClick={() => setDialog({ type: 'log', item })}><History size={16} /> Log activity</button>
                  <button className="secondary-button" onClick={() => setDialog({ type: 'lifespan', item })}><CalendarClock size={16} /> Lifespan</button>
                  <button className="secondary-button" onClick={() => setDialog({ type: 'item', item })}>Edit</button>
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
        <div className="empty-state equipment-empty-state"><Wrench size={42} /><h3>Add your camping equipment</h3><p>Track hoses, filters, surge protectors, cords, tools, and anything else that may need maintenance or replacement.</p><button className="primary-button" onClick={() => setDialog({ type: 'item' })}><Plus size={17} /> Add first equipment item</button></div>
      )}

      {dialog?.type === 'item' && <EquipmentItemDialog item={dialog.item} onClose={() => setDialog(undefined)} onSave={saveItemForm} />}
      {dialog?.type === 'log' && <EquipmentLogDialog item={dialog.item} onClose={() => setDialog(undefined)} onSave={saveLogForm} />}
      {dialog?.type === 'lifespan' && <EquipmentLifespanDialog item={dialog.item} onClose={() => setDialog(undefined)} onSave={saveLifespanForm} />}
    </>
  );
}
