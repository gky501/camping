import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardCheck, ListPlus, PackageCheck, Plus, Settings2, Trash2, Wrench } from 'lucide-react';
import { equipmentConditionLabel } from '../lib/equipment';
import { createId } from '../lib/id';
import type { Campsite, ChecklistSection, ChecklistTemplate, EquipmentCondition, EquipmentInventory, EquipmentItem, Stay, TripChecklist } from '../types';

const EQUIPMENT_SECTION_ID = 'equipment-inventory';

interface ChecklistPanelProps {
  sites: Campsite[];
  stays: Stay[];
  template: ChecklistTemplate;
  tripChecklists: TripChecklist[];
  equipmentInventory: EquipmentInventory;
  onSaveTemplate: (template: ChecklistTemplate) => void;
  onSaveTripChecklist: (checklist: TripChecklist) => void;
  onSaveEquipmentInventory: (inventory: EquipmentInventory) => void;
}

function stayLabel(stay: Stay, sites: Campsite[]): string {
  const site = sites.find((item) => item.id === stay.siteId);
  const location = stay.siteSnapshot ?? site;
  const area = location?.area?.trim();
  const loop = location?.loop?.trim();
  const parts = [stay.arrivalDate, location?.park ?? 'Unknown park'];
  if (area) parts.push(area);
  if (loop && loop.toLowerCase() !== area?.toLowerCase()) parts.push(`Loop ${loop}`);
  if (location?.siteNumber) parts.push(`Site ${location.siteNumber}`);
  return parts.join(' · ');
}

function sectionItemCount(sections: ChecklistSection[]): number {
  return sections.reduce((total, section) => total + section.items.length, 0);
}

function formatEquipmentUpdated(value?: string): string {
  if (!value) return 'Condition not updated yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Condition updated';
  return `Updated ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)}`;
}

export function ChecklistPanel({
  sites,
  stays,
  template,
  tripChecklists,
  equipmentInventory,
  onSaveTemplate,
  onSaveTripChecklist,
  onSaveEquipmentInventory,
}: ChecklistPanelProps) {
  const sortedStays = useMemo(
    () => [...stays].sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate)),
    [stays],
  );
  const today = new Date().toISOString().slice(0, 10);
  const suggestedStay = sortedStays.find((stay) => stay.departureDate >= today) ?? sortedStays[0];
  const [selectedStayId, setSelectedStayId] = useState(suggestedStay?.id ?? '');
  const [mode, setMode] = useState<'trip' | 'template' | 'equipment'>('trip');
  const [hideCompleted, setHideCompleted] = useState(false);

  useEffect(() => {
    if (!selectedStayId && suggestedStay) setSelectedStayId(suggestedStay.id);
    if (selectedStayId && !stays.some((stay) => stay.id === selectedStayId)) setSelectedStayId(suggestedStay?.id ?? '');
  }, [selectedStayId, stays, suggestedStay]);

  const selectedStay = sortedStays.find((stay) => stay.id === selectedStayId);
  const storedChecklist = tripChecklists.find((checklist) => checklist.stayId === selectedStayId);
  const tripChecklist: TripChecklist = storedChecklist ?? {
    stayId: selectedStayId,
    checkedItemIds: [],
    customSections: [],
  };
  const equipmentSection: ChecklistSection = {
    id: EQUIPMENT_SECTION_ID,
    name: 'Equipment',
    items: equipmentInventory.items.map((item) => ({ id: item.id, label: item.label })),
  };
  const allSections = [
    ...template.sections,
    ...(equipmentSection.items.length ? [equipmentSection] : []),
    ...tripChecklist.customSections,
  ];
  const allItemIds = allSections.flatMap((section) => section.items.map((item) => item.id));
  const checkedIds = new Set(tripChecklist.checkedItemIds.filter((id) => allItemIds.includes(id)));
  const totalItems = allItemIds.length;
  const completedItems = checkedIds.size;
  const progress = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;
  const replacementItems = equipmentInventory.items.filter((item) => item.condition === 'replace');
  const watchItems = equipmentInventory.items.filter((item) => item.condition === 'watch');

  function saveTrip(next: TripChecklist) {
    onSaveTripChecklist({
      ...next,
      checkedItemIds: [...new Set(next.checkedItemIds)],
    });
  }

  function toggleItem(itemId: string) {
    const nextChecked = checkedIds.has(itemId)
      ? tripChecklist.checkedItemIds.filter((id) => id !== itemId)
      : [...tripChecklist.checkedItemIds, itemId];
    saveTrip({ ...tripChecklist, checkedItemIds: nextChecked });
  }

  function resetTrip() {
    if (!window.confirm('Reset every checked item for this trip? Your custom trip sections will remain.')) return;
    saveTrip({ ...tripChecklist, checkedItemIds: [] });
  }

  function addTripSection() {
    const name = window.prompt('Name this trip-only checklist section:')?.trim();
    if (!name) return;
    saveTrip({
      ...tripChecklist,
      customSections: [...tripChecklist.customSections, { id: createId('trip-section'), name, items: [] }],
    });
  }

  function renameTripSection(section: ChecklistSection) {
    const name = window.prompt('Section name:', section.name)?.trim();
    if (!name) return;
    saveTrip({
      ...tripChecklist,
      customSections: tripChecklist.customSections.map((item) => item.id === section.id ? { ...item, name } : item),
    });
  }

  function deleteTripSection(section: ChecklistSection) {
    if (!window.confirm(`Delete the trip-only section “${section.name}”?`)) return;
    const itemIds = new Set(section.items.map((item) => item.id));
    saveTrip({
      ...tripChecklist,
      customSections: tripChecklist.customSections.filter((item) => item.id !== section.id),
      checkedItemIds: tripChecklist.checkedItemIds.filter((id) => !itemIds.has(id)),
    });
  }

  function addTripItem(section: ChecklistSection) {
    const label = window.prompt(`Add an item to “${section.name}”:`)?.trim();
    if (!label) return;
    saveTrip({
      ...tripChecklist,
      customSections: tripChecklist.customSections.map((item) => item.id === section.id
        ? { ...item, items: [...item.items, { id: createId('trip-item'), label }] }
        : item),
    });
  }

  function renameTripItem(section: ChecklistSection, itemId: string, currentLabel: string) {
    const label = window.prompt('Checklist item:', currentLabel)?.trim();
    if (!label) return;
    saveTrip({
      ...tripChecklist,
      customSections: tripChecklist.customSections.map((item) => item.id === section.id
        ? { ...item, items: item.items.map((entry) => entry.id === itemId ? { ...entry, label } : entry) }
        : item),
    });
  }

  function deleteTripItem(section: ChecklistSection, itemId: string) {
    saveTrip({
      ...tripChecklist,
      customSections: tripChecklist.customSections.map((item) => item.id === section.id
        ? { ...item, items: item.items.filter((entry) => entry.id !== itemId) }
        : item),
      checkedItemIds: tripChecklist.checkedItemIds.filter((id) => id !== itemId),
    });
  }

  function addTemplateSection() {
    const name = window.prompt('New standard checklist section:')?.trim();
    if (!name) return;
    onSaveTemplate({ sections: [...template.sections, { id: createId('section'), name, items: [] }] });
  }

  function updateTemplateSection(sectionId: string, changes: Partial<ChecklistSection>) {
    onSaveTemplate({ sections: template.sections.map((section) => section.id === sectionId ? { ...section, ...changes } : section) });
  }

  function renameTemplateSection(section: ChecklistSection) {
    const name = window.prompt('Section name:', section.name)?.trim();
    if (name) updateTemplateSection(section.id, { name });
  }

  function deleteTemplateSection(section: ChecklistSection) {
    if (!window.confirm(`Delete “${section.name}” and all of its standard items?`)) return;
    onSaveTemplate({ sections: template.sections.filter((item) => item.id !== section.id) });
  }

  function addTemplateItem(section: ChecklistSection) {
    const label = window.prompt(`Add a standard item to “${section.name}”:`)?.trim();
    if (!label) return;
    updateTemplateSection(section.id, { items: [...section.items, { id: createId('item'), label }] });
  }

  function renameTemplateItem(section: ChecklistSection, itemId: string, currentLabel: string) {
    const label = window.prompt('Checklist item:', currentLabel)?.trim();
    if (!label) return;
    updateTemplateSection(section.id, { items: section.items.map((item) => item.id === itemId ? { ...item, label } : item) });
  }

  function deleteTemplateItem(section: ChecklistSection, itemId: string) {
    updateTemplateSection(section.id, { items: section.items.filter((item) => item.id !== itemId) });
  }

  function saveEquipmentItems(items: EquipmentItem[]) {
    onSaveEquipmentInventory({ items });
  }

  function addEquipmentItem() {
    const label = window.prompt('Equipment name:')?.trim();
    if (!label) return;
    saveEquipmentItems([
      ...equipmentInventory.items,
      { id: createId('equipment'), label, condition: 'good', updatedAt: new Date().toISOString() },
    ]);
  }

  function editEquipmentItem(item: EquipmentItem) {
    const label = window.prompt('Equipment name:', item.label)?.trim();
    if (!label) return;
    const note = window.prompt('Optional condition note:', item.note ?? '')?.trim();
    if (note === undefined) return;
    saveEquipmentItems(equipmentInventory.items.map((entry) => entry.id === item.id
      ? { ...entry, label, note: note || undefined, updatedAt: new Date().toISOString() }
      : entry));
  }

  function updateEquipmentCondition(item: EquipmentItem, condition: EquipmentCondition) {
    saveEquipmentItems(equipmentInventory.items.map((entry) => entry.id === item.id
      ? { ...entry, condition, updatedAt: new Date().toISOString() }
      : entry));
  }

  function deleteEquipmentItem(item: EquipmentItem) {
    if (!window.confirm(`Delete “${item.label}” from your equipment list?`)) return;
    saveEquipmentItems(equipmentInventory.items.filter((entry) => entry.id !== item.id));
  }

  return (
    <section className="content-page checklist-page">
      <div className="page-heading checklist-heading">
        <div>
          <p className="eyebrow">Pack it once. Customize every trip.</p>
          <h2>Camping checklist</h2>
          <p>Maintain standard packing items, track equipment condition, and add trip-only sections for special plans.</p>
        </div>
        <div className="checklist-mode-switch" role="group" aria-label="Checklist view">
          <button className={mode === 'trip' ? 'active' : ''} onClick={() => setMode('trip')}><ClipboardCheck size={17} /> Trip checklist</button>
          <button className={mode === 'template' ? 'active' : ''} onClick={() => setMode('template')}><Settings2 size={17} /> Standard items</button>
          <button className={mode === 'equipment' ? 'active' : ''} onClick={() => setMode('equipment')}><Wrench size={17} /> Equipment</button>
        </div>
      </div>

      {mode === 'trip' ? (
        sortedStays.length ? (
          <>
            <div className="checklist-trip-toolbar">
              <label className="field checklist-trip-picker">
                <span>Checklist for</span>
                <select value={selectedStayId} onChange={(event) => setSelectedStayId(event.target.value)}>
                  {sortedStays.map((stay) => <option key={stay.id} value={stay.id}>{stayLabel(stay, sites)}</option>)}
                </select>
              </label>
              <label className="checklist-hide-complete"><input type="checkbox" checked={hideCompleted} onChange={(event) => setHideCompleted(event.target.checked)} /> Hide completed</label>
              <button className="secondary-button" onClick={resetTrip}>Reset checks</button>
              <button className="primary-button" onClick={addTripSection}><ListPlus size={17} /> Add trip section</button>
            </div>

            {replacementItems.length > 0 && (
              <div className="equipment-trip-alert replacement-alert">
                <span className="equipment-alert-icon"><AlertTriangle /></span>
                <div>
                  <strong>{replacementItems.length === 1 ? 'Equipment needs to be replaced' : `${replacementItems.length} equipment items need to be replaced`}</strong>
                  {replacementItems.map((item) => <p key={item.id}>{item.label.toUpperCase()} NEEDS TO BE REPLACED{item.note ? ` — ${item.note}` : ''}</p>)}
                </div>
                <button className="secondary-button" onClick={() => setMode('equipment')}>Review equipment</button>
              </div>
            )}

            {watchItems.length > 0 && (
              <div className="equipment-watch-summary"><AlertTriangle size={17} /><span><strong>{watchItems.length}</strong> equipment item{watchItems.length === 1 ? '' : 's'} marked Watch</span><button className="text-button" onClick={() => setMode('equipment')}>Review</button></div>
            )}

            <div className="checklist-progress-card">
              <div className="checklist-progress-copy">
                <span className="checklist-progress-icon"><CheckCircle2 /></span>
                <div><strong>{completedItems} of {totalItems} packed</strong><span>{selectedStay ? stayLabel(selectedStay, sites) : 'Selected trip'}</span></div>
              </div>
              <div className="checklist-progress-meter" aria-label={`${progress}% complete`}><i style={{ width: `${progress}%` }} /></div>
              <strong className="checklist-progress-number">{progress}%</strong>
            </div>

            <div className="checklist-section-grid">
              {allSections.map((section) => {
                const isCustom = tripChecklist.customSections.some((item) => item.id === section.id);
                const isEquipment = section.id === EQUIPMENT_SECTION_ID;
                const visibleItems = hideCompleted ? section.items.filter((item) => !checkedIds.has(item.id)) : section.items;
                const sectionComplete = section.items.length > 0 && section.items.every((item) => checkedIds.has(item.id));
                return (
                  <article className={`checklist-section-card ${sectionComplete ? 'complete' : ''} ${isEquipment ? 'equipment-checklist-card' : ''}`} key={section.id}>
                    <div className="checklist-section-heading">
                      <div><p className="eyebrow">{isCustom ? 'This trip only' : isEquipment ? 'Condition tracked' : 'Standard section'}</p><h3>{section.name}</h3></div>
                      <span>{section.items.filter((item) => checkedIds.has(item.id)).length}/{section.items.length}</span>
                    </div>
                    <div className="checklist-items">
                      {visibleItems.map((item) => {
                        const equipmentItem = isEquipment ? equipmentInventory.items.find((entry) => entry.id === item.id) : undefined;
                        return (
                          <div className={`checklist-item ${checkedIds.has(item.id) ? 'checked' : ''} ${equipmentItem ? `equipment-checklist-item equipment-${equipmentItem.condition}` : ''}`} key={item.id}>
                            <label>
                              <input type="checkbox" checked={checkedIds.has(item.id)} onChange={() => toggleItem(item.id)} />
                              <span className="checklist-item-copy">
                                <strong>{item.label}</strong>
                                {equipmentItem?.condition === 'replace' && <small>NEEDS TO BE REPLACED</small>}
                                {equipmentItem?.condition === 'watch' && <small>Condition: Watch{equipmentItem.note ? ` — ${equipmentItem.note}` : ''}</small>}
                                {equipmentItem?.condition === 'good' && equipmentItem.note && <small>{equipmentItem.note}</small>}
                              </span>
                            </label>
                            {equipmentItem && <span className={`equipment-condition-pill ${equipmentItem.condition}`}>{equipmentConditionLabel(equipmentItem.condition)}</span>}
                            {isCustom && <div className="checklist-item-actions"><button title="Rename item" onClick={() => renameTripItem(section, item.id, item.label)}>Edit</button><button title="Delete item" onClick={() => deleteTripItem(section, item.id)}><Trash2 size={15} /></button></div>}
                          </div>
                        );
                      })}
                      {!visibleItems.length && <p className="checklist-empty-section">{section.items.length ? 'Everything in this section is packed.' : 'No items yet.'}</p>}
                    </div>
                    {isCustom && <div className="checklist-section-actions"><button className="text-button" onClick={() => addTripItem(section)}><Plus size={15} /> Add item</button><button className="text-button" onClick={() => renameTripSection(section)}>Rename</button><button className="text-button destructive-text-button" onClick={() => deleteTripSection(section)}>Delete section</button></div>}
                    {isEquipment && <div className="checklist-section-actions"><button className="text-button" onClick={() => setMode('equipment')}><Wrench size={15} /> Manage conditions</button></div>}
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="empty-state"><CalendarDays size={42} /><h3>Log a trip first</h3><p>Trip checklists attach to diary entries so each camping trip can keep its own completion and custom sections.</p></div>
        )
      ) : mode === 'template' ? (
        <>
          <div className="checklist-template-banner">
            <div><strong>{template.sections.length} sections · {sectionItemCount(template.sections)} standard items</strong><span>Changes appear on every trip checklist. Existing checked items stay checked as long as the item remains in the standard list.</span></div>
            <button className="primary-button" onClick={addTemplateSection}><Plus size={17} /> Add section</button>
          </div>
          <div className="checklist-section-grid template-grid">
            {template.sections.map((section) => (
              <article className="checklist-section-card template-card" key={section.id}>
                <div className="checklist-section-heading"><div><p className="eyebrow">Standard section</p><h3>{section.name}</h3></div><span>{section.items.length}</span></div>
                <div className="checklist-items">
                  {section.items.map((item) => (
                    <div className="checklist-item template-item" key={item.id}><span>{item.label}</span><div className="checklist-item-actions"><button onClick={() => renameTemplateItem(section, item.id, item.label)}>Edit</button><button onClick={() => deleteTemplateItem(section, item.id)}><Trash2 size={15} /></button></div></div>
                  ))}
                  {!section.items.length && <p className="checklist-empty-section">No standard items in this section.</p>}
                </div>
                <div className="checklist-section-actions"><button className="text-button" onClick={() => addTemplateItem(section)}><Plus size={15} /> Add item</button><button className="text-button" onClick={() => renameTemplateSection(section)}>Rename</button><button className="text-button destructive-text-button" onClick={() => deleteTemplateSection(section)}>Delete section</button></div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="equipment-manager-banner">
            <div className="equipment-manager-copy">
              <span className="equipment-manager-icon"><PackageCheck /></span>
              <div>
                <strong>{equipmentInventory.items.length} equipment item{equipmentInventory.items.length === 1 ? '' : 's'}</strong>
                <span>Equipment appears automatically on every trip checklist. Items marked Needs replaced create a red warning until their condition is updated.</span>
              </div>
            </div>
            <button className="primary-button" onClick={addEquipmentItem}><Plus size={17} /> Add equipment</button>
          </div>

          {equipmentInventory.items.length ? (
            <div className="equipment-manager-list">
              {equipmentInventory.items.map((item) => (
                <article className={`equipment-manager-row equipment-${item.condition}`} key={item.id}>
                  <div className="equipment-manager-item-copy">
                    <strong>{item.label}</strong>
                    <span>{item.note || formatEquipmentUpdated(item.updatedAt)}</span>
                    {item.note && <small>{formatEquipmentUpdated(item.updatedAt)}</small>}
                  </div>
                  <label className="equipment-condition-field">
                    <span>Condition</span>
                    <select value={item.condition} onChange={(event) => updateEquipmentCondition(item, event.target.value as EquipmentCondition)}>
                      <option value="good">Good</option>
                      <option value="watch">Watch</option>
                      <option value="replace">Needs replaced</option>
                    </select>
                  </label>
                  <span className={`equipment-condition-pill ${item.condition}`}>{equipmentConditionLabel(item.condition)}</span>
                  <div className="equipment-row-actions">
                    <button className="secondary-button" onClick={() => editEquipmentItem(item)}>Edit</button>
                    <button className="danger-button" onClick={() => deleteEquipmentItem(item)}><Trash2 size={16} /> Delete</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state equipment-empty-state"><Wrench size={42} /><h3>Add your camping equipment</h3><p>Track hoses, surge protectors, cords, chocks, tools, and anything else that may need maintenance or replacement between trips.</p><button className="primary-button" onClick={addEquipmentItem}><Plus size={17} /> Add first equipment item</button></div>
          )}
        </>
      )}
    </section>
  );
}
