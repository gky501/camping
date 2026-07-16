export type MaintenanceCondition = 'good' | 'watch' | 'attention';
export type MaintenanceAction = 'checked' | 'maintained' | 'warrantied';

export interface MaintenanceReminder {
  id: string;
  label: string;
  intervalDays: number;
  lastCompletedDate?: string;
  lastAction?: MaintenanceAction;
  condition: MaintenanceCondition;
  note?: string;
}

export interface CamperMaintenanceRecord {
  active: boolean;
  maintenance: MaintenanceReminder[];
}

export type CamperMaintenanceMap = Record<string, CamperMaintenanceRecord>;

export async function loadCamperMaintenance(): Promise<CamperMaintenanceMap> {
  const response = await fetch('/api/settings/camper-maintenance', { headers: { Accept: 'application/json' } });
  if (!response.ok) return {};
  return await response.json() as CamperMaintenanceMap;
}

export async function saveCamperMaintenance(value: CamperMaintenanceMap): Promise<void> {
  const response = await fetch('/api/settings/camper-maintenance', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error('Unable to save camper maintenance.');
}

export function nextMaintenanceDate(reminder: MaintenanceReminder): string | undefined {
  if (!reminder.lastCompletedDate) return undefined;
  const date = new Date(`${reminder.lastCompletedDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setDate(date.getDate() + reminder.intervalDays);
  return date.toISOString().slice(0, 10);
}

export function maintenanceTiming(reminder: MaintenanceReminder): 'overdue' | 'soon' | 'current' | 'unscheduled' {
  const next = nextMaintenanceDate(reminder);
  if (!next) return 'unscheduled';
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const due = new Date(`${next}T12:00:00`);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return 'overdue';
  if (days <= 14) return 'soon';
  return 'current';
}
