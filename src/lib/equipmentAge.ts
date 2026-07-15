import type { EquipmentItem } from '../types';

function parseDate(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function plural(value: number, singular: string): string {
  return `${value} ${singular}${value === 1 ? '' : 's'}`;
}

export function equipmentAgeLabel(item: EquipmentItem, now = new Date()): string | undefined {
  const started = parseDate(item.inServiceDate);
  if (!started) return undefined;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (started.getTime() > today.getTime()) return 'Starts in the future';

  let years = today.getFullYear() - started.getFullYear();
  let cursor = new Date(started);
  cursor.setFullYear(cursor.getFullYear() + years);
  if (cursor.getTime() > today.getTime()) {
    years -= 1;
    cursor = new Date(started);
    cursor.setFullYear(cursor.getFullYear() + years);
  }

  let months = 0;
  while (months < 11) {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + 1);
    if (next.getTime() > today.getTime()) break;
    cursor = next;
    months += 1;
  }

  const remainingDays = Math.max(0, Math.floor((today.getTime() - cursor.getTime()) / 86_400_000));
  const weeks = Math.floor(remainingDays / 7);
  const parts = [
    years ? plural(years, 'year') : '',
    months ? plural(months, 'month') : '',
    weeks ? plural(weeks, 'week') : '',
  ].filter(Boolean);

  if (!parts.length) {
    const totalDays = Math.max(0, Math.floor((today.getTime() - started.getTime()) / 86_400_000));
    return totalDays === 0 ? 'New today' : plural(totalDays, 'day');
  }
  return parts.join(', ');
}
