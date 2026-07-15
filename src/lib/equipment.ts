import type { EquipmentCondition, EquipmentInventory, EquipmentItem } from '../types';

export const DEFAULT_EQUIPMENT_INVENTORY: EquipmentInventory = { items: [] };

const VALID_CONDITIONS = new Set<EquipmentCondition>(['good', 'watch', 'replace']);

export function normalizeEquipmentInventory(value?: EquipmentInventory): EquipmentInventory {
  const items = Array.isArray(value?.items) ? value.items : [];
  return {
    items: items
      .filter((item): item is EquipmentItem => Boolean(item?.id && item?.label?.trim()))
      .map((item) => ({
        id: String(item.id),
        label: String(item.label).trim(),
        condition: VALID_CONDITIONS.has(item.condition) ? item.condition : 'good',
        note: item.note?.trim() || undefined,
        updatedAt: item.updatedAt || undefined,
      })),
  };
}

export function equipmentConditionLabel(condition: EquipmentCondition): string {
  if (condition === 'replace') return 'Needs replaced';
  if (condition === 'watch') return 'Watch';
  return 'Good';
}
