import type { EquipmentCondition, EquipmentInventory, EquipmentItem, EquipmentLogAction, EquipmentLogEntry } from '../types';

export const DEFAULT_EQUIPMENT_INVENTORY: EquipmentInventory = { items: [] };

const VALID_CONDITIONS = new Set<EquipmentCondition>(['good', 'watch', 'replace']);
const VALID_LOG_ACTIONS = new Set<EquipmentLogAction>(['replaced', 'repaired', 'serviced', 'cleaned', 'inspected']);

export type EquipmentLifeStatus = 'none' | 'current' | 'nearing' | 'overdue';

export interface EquipmentLifeInfo {
  status: EquipmentLifeStatus;
  nextDueDate?: string;
  daysRemaining?: number;
}

function normalizeDate(value?: string): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : value;
}

function normalizeLogEntry(entry: EquipmentLogEntry): EquipmentLogEntry | undefined {
  if (!entry?.id || !VALID_LOG_ACTIONS.has(entry.action)) return undefined;
  const date = normalizeDate(entry.date);
  if (!date) return undefined;
  return {
    id: String(entry.id),
    action: entry.action,
    date,
    note: entry.note?.trim() || undefined,
  };
}

export function normalizeEquipmentInventory(value?: EquipmentInventory): EquipmentInventory {
  const items = Array.isArray(value?.items) ? value.items : [];
  return {
    items: items
      .filter((item): item is EquipmentItem => Boolean(item?.id && item?.label?.trim()))
      .map((item) => {
        const interval = Number(item.replacementIntervalMonths);
        return {
          id: String(item.id),
          label: String(item.label).trim(),
          condition: VALID_CONDITIONS.has(item.condition) ? item.condition : 'good',
          note: item.note?.trim() || undefined,
          updatedAt: item.updatedAt || undefined,
          replacementIntervalMonths: Number.isFinite(interval) && interval > 0 ? Math.round(interval) : undefined,
          lastReplacedDate: normalizeDate(item.lastReplacedDate),
          log: (Array.isArray(item.log) ? item.log : [])
            .map(normalizeLogEntry)
            .filter((entry): entry is EquipmentLogEntry => Boolean(entry))
            .sort((a, b) => b.date.localeCompare(a.date)),
        };
      }),
  };
}

export function equipmentConditionLabel(condition: EquipmentCondition): string {
  if (condition === 'replace') return 'Needs replaced';
  if (condition === 'watch') return 'Watch';
  return 'Good';
}

export function equipmentLogActionLabel(action: EquipmentLogAction): string {
  return action.charAt(0).toUpperCase() + action.slice(1);
}

export function formatEquipmentDate(value?: string): string {
  if (!value) return 'Not set';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export function equipmentLifeInfo(item: EquipmentItem, now = new Date()): EquipmentLifeInfo {
  if (!item.replacementIntervalMonths || !item.lastReplacedDate) return { status: 'none' };

  const lastReplaced = new Date(`${item.lastReplacedDate}T12:00:00`);
  if (Number.isNaN(lastReplaced.getTime())) return { status: 'none' };

  const nextDue = new Date(lastReplaced);
  nextDue.setMonth(nextDue.getMonth() + item.replacementIntervalMonths);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const daysRemaining = Math.ceil((nextDue.getTime() - today.getTime()) / 86_400_000);
  const nextDueDate = `${nextDue.getFullYear()}-${String(nextDue.getMonth() + 1).padStart(2, '0')}-${String(nextDue.getDate()).padStart(2, '0')}`;

  if (daysRemaining < 0) return { status: 'overdue', nextDueDate, daysRemaining };
  if (daysRemaining <= 30) return { status: 'nearing', nextDueDate, daysRemaining };
  return { status: 'current', nextDueDate, daysRemaining };
}

export function equipmentLifeStatusLabel(status: EquipmentLifeStatus): string {
  if (status === 'overdue') return 'Replacement overdue';
  if (status === 'nearing') return 'Nearing end of life';
  if (status === 'current') return 'Replacement scheduled';
  return 'No replacement schedule';
}
