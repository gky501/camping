import './types';

export type CamperMaintenanceCondition = 'good' | 'watch' | 'attention';
export type CamperMaintenanceAction = 'checked' | 'maintained' | 'warrantied';

export interface CamperMaintenanceReminder {
  id: string;
  label: string;
  intervalDays: number;
  lastCompletedDate?: string;
  lastAction?: CamperMaintenanceAction;
  condition: CamperMaintenanceCondition;
  note?: string;
}

declare module './types' {
  interface CamperProfile {
    active?: boolean;
    maintenance?: CamperMaintenanceReminder[];
  }
}
