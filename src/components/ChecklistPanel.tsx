import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardCheck, ListPlus, Plus, Settings2, Trash2, Wrench } from 'lucide-react';
import { ChecklistEditDialog, type ChecklistEditDialogConfig } from './ChecklistEditDialog';
import { EquipmentManager } from './EquipmentManager';
import {
  equipmentConditionLabel,
  equipmentLifeInfo,
  equipmentLifeStatusLabel,
  formatEquipmentDate,
} from '../lib/equipment';
import { equipmentAgeLabel } from '../lib/equipmentAge';
import { createId } from '../lib/id';
import type { Campsite, ChecklistSection, ChecklistTemplate, EquipmentInventory, Stay, TripChecklist } from '../types';

const EQUIPMENT_SECTION_ID = 'equipment-inventory';

interface ChecklistPanelProps {
  sites: Campsite[];
  stays: Stay[];
  template: ChecklistTemplate;
  tripChecklists: TripChecklist[];
  equipmentInventory: EquipmentInventory;
  initialStayId?: string;
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

export function ChecklistPanel({
  sites,
  stays,
  template,
  tripChecklists,
  equipmentInventory,
  initialStayId,
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
  const linkedStay = initialStayId ? sortedStays.find((stay) => stay.id === initialStayId) : undefined;
  const [selectedStayId, setSelectedStayId] = useState(linkedStay?.id ?? suggestedStay?.id ?? '');
  const [mode, setMode] = useState<'trip' | 'template' | 'equipment'>('trip');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [editor, setEditor] = useState<ChecklistEditDialogConfig>();

  useEffect(() => {
    if (!initialStayId || !stays.some((stay) => stay.id === initialStayId)) return;
    setSelectedStayId(initialStayId);
    setMode('trip');
  }, [initialStayId, stays]);

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
  const equipmentStatuses = equipmentInventory.items.map((item) => ({ item, life: equipmentLifeInfo(item) }));
  const urgentEquipment = equipmentStatuses.filter(({ item, life }) => item.condition === 'replace' || life.status === 'overdue');
  const attentionEquipment = equipmentStatuses.filter(({ item, life }) =>
    !urgentEquipment.some((entry) => entry.item.id === item.id)
    && (item.condition === 'watch' || life.status === 'nearing'));

  function saveTrip(next: TripChecklist) {
    onSaveTripChecklist({ ...next, checkedItemIds: [...new Set(next.checkedItemIds)] });
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
    setEditor({
      eyebrow: 'This trip only',
      title: 'Add a trip section',
      description: 'Create a section for something unique to this camping trip, such as meals, an event, cold weather, or guests.',
      fieldLabel: 'Section name',
      placeholder: 'Example: Lake day supplies',
      submitLabel: 'Add section',
      onSubmit: (name) => saveTrip({
        ...tripChecklist,
        customSections: [...tripChecklist.customSections, { id: createId('trip-section'), name, items: [] }],
      }),
    });
  }

  function renameTripSection(section: ChecklistSection) {
    setEditor({
      eyebrow: 'This trip only',
      title: 'Rename trip section',
      description: 'Change the section title without affecting any of its checklist items.',
      fieldLabel: 'Section name',
      initialValue: section.name,
      submitLabel: 'Save name',
      onSubmit: (name) => saveTrip({
        ...tripChecklist,
        customSections: tripChecklist.customSections.map((item) => item.id === section.id ? { ...item, name } : item),
      }),
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
    setEditor({
      eyebrow: section.name,
      title: 'Add a trip item',
      description: 'This item will appear only on the selected trip checklist.',
      fieldLabel: 'Checklist item',
      placeholder: 'Example: Pack fishing licenses',
      submitLabel: 'Add item',
      onSubmit: (label) => saveTrip({
        ...tripChecklist,
        customSections: tripChecklist.customSections.map((item) => item.id === section.id
          ? { ...item, items: [...item.items, { id: createId('trip-item'), label }] }
          : item),
      }),
    });
  }

  function renameTripItem(section: ChecklistSection, itemId: string, currentLabel: string) {
    setEditor({
      eyebrow: section.name,
      title: 'Edit trip item',
      description: 'Update the wording for this trip-only checklist item.',
      fieldLabel: 'Checklist item',
      initialValue: currentLabel,
      submitLabel: 'Save item',
      onSubmit: (label) => saveTrip({
        ...tripChecklist,
        customSections: tripChecklist.customSections.map((item) => item.id === section.id
          ? { ...item, items: item.items.map((entry) => entry.id === itemId ? { ...entry, label } : entry) }
          : item),
      }),
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
    setEditor({
      eyebrow: 'Standard checklist',
      title: 'Add a standard section',
      description: 'Standard sections appear on every trip so your regular packing routine stays consistent.',
      fieldLabel: 'Section name',
      placeholder: 'Example: Camper setup',
      submitLabel: 'Add section',
      onSubmit: (name) => onSaveTemplate({
        sections: [...template.sections, { id: createId('section'), name, items: [] }],
      }),
    });
  }

  function updateTemplateSection(sectionId: string, changes: Partial<ChecklistSection>) {
    onSaveTemplate({ sections: template.sections.map((section) => section.id === sectionId ? { ...section, ...changes } : section) });
  }

  function renameTemplateSection(section: ChecklistSection) {
    setEditor({
      eyebrow: 'Standard checklist',
      title: 'Rename standard section',
      description: 'The updated title will appear on every trip checklist.',
      fieldLabel: 'Section name',
      initialValue: section.name,
      submitLabel: 'Save name',
      onSubmit: (name) => updateTemplateSection(section.id, { name }),
    });
  }

  function deleteTemplateSection(section: ChecklistSection) {
    if (!window.confirm(`Delete “${section.name}” and all of its standard items?`)) return;
    onSaveTemplate({ sections: template.sections.filter((item) => item.id !== section.id) });
  }

  function addTemplateItem(section: ChecklistSection) {
    setEditor({
      eyebrow: section.name,
      title: 'Add a standard item',
      description: 'This item will be included automatically on every trip checklist.',
      fieldLabel: 'Checklist item',
      placeholder: 'Example: Check tire pressure',
      submitLabel: 'Add item',
      onSubmit: (label) => updateTemplateSection(section.id, {
        items: [...section.items, { id: createId('item'), label }],
      }),
    });
  }

  function renameTemplateItem(section: ChecklistSection, itemId: string, currentLabel: string) {
    setEditor({
      eyebrow: section.name,
      title: 'Edit standard item',
      description: 'The updated wording will carry across all trip checklists.',
      fieldLabel: 'Checklist item',
      initialValue: currentLabel,
      submitLabel: 'Save item',
      onSubmit: (label) => updateTemplateSection(section.id, {
        items: section.items.map((item) => item.id === itemId ? { ...item, label } : item),
      }),
    });
  }

  function deleteTemplateItem(section: ChecklistSection, itemId: string) {
    updateTemplateSection(section.id, { items: section.items.filter((item) => item.id !== itemId) });
  }

  return (
    <>
      <section className="content-page checklist-page">
        <div className="page-heading checklist-heading">
          <div>
            <p className="eyebrow">Pack it once. Customize every trip.</p>
            <h2>Camping checklist</h2>
            <p>Maintain standard packing items, track equipment condition and lifespan, and add trip-only sections for special plans.</p>
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

              {urgentEquipment.length > 0 && (
                <div className="equipment-trip-alert replacement-alert">
                  <span className="equipment-alert-icon"><AlertTriangle /></span>
                  <div>
                    <strong>{urgentEquipment.length === 1 ? 'Equipment needs attention before this trip' : `${urgentEquipment.length} equipment items need attention before this trip`}</strong>
                    {urgentEquipment.map(({ item, life }) => (
                      <p key={item.id}>
                        {item.label.toUpperCase()} {item.condition === 'replace' ? 'NEEDS TO BE REPLACED' : `REPLACEMENT OVERDUE — DUE ${formatEquipmentDate(life.nextDueDate).toUpperCase()}`}
                        {item.note ? ` — ${item.note}` : ''}
                      </p>
                    ))}
                  </div>
                  <button className="secondary-button" onClick={() => setMode('equipment')}>Review equipment</button>
                </div>
              )}

              {attentionEquipment.length > 0 && (
                <div className="equipment-watch-summary equipment-attention-summary">
                  <AlertTriangle size={17} />
                  <div>
                    <strong>{attentionEquipment.length} equipment item{attentionEquipment.length === 1 ? '' : 's'} to watch</strong>
                    {attentionEquipment.map(({ item, life }) => (
                      <span key={item.id}>{item.label} — {life.status === 'nearing' ? `nearing end of life, due ${formatEquipmentDate(life.nextDueDate)}` : 'condition marked Watch'}</span>
                    ))}
                  </div>
                  <button className="text-button" onClick={() => setMode('equipment')}>Review</button>
                </div>
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
                          const life = equipmentItem ? equipmentLifeInfo(equipmentItem) : undefined;
                          const age = equipmentItem ? equipmentAgeLabel(equipmentItem) : undefined;
                          const itemMessage = equipmentItem?.condition === 'replace'
                            ? 'NEEDS TO BE REPLACED'
                            : life?.status === 'overdue'
                              ? `REPLACEMENT OVERDUE — DUE ${formatEquipmentDate(life.nextDueDate).toUpperCase()}`
                              : life?.status === 'nearing'
                                ? `Nearing end of life — due ${formatEquipmentDate(life.nextDueDate)}`
                                : equipmentItem?.condition === 'watch'
                                  ? `Condition: Watch${equipmentItem.note ? ` — ${equipmentItem.note}` : ''}`
                                  : equipmentItem?.note;
                          return (
                            <div className={`checklist-item ${checkedIds.has(item.id) ? 'checked' : ''} ${equipmentItem ? `equipment-checklist-item equipment-${equipmentItem.condition} life-${life?.status ?? 'none'}` : ''}`} key={item.id}>
                              <label>
                                <input type="checkbox" checked={checkedIds.has(item.id)} onChange={() => toggleItem(item.id)} />
                                <span className="checklist-item-copy"><strong>{item.label}</strong>{age && <small className="equipment-checklist-age">{age} old</small>}{itemMessage && <small>{itemMessage}</small>}</span>
                              </label>
                              {equipmentItem && (
                                <div className="equipment-status-pills checklist-equipment-pills">
                                  <span className={`equipment-condition-pill ${equipmentItem.condition}`}>{equipmentConditionLabel(equipmentItem.condition)}</span>
                                  {life && (life.status === 'nearing' || life.status === 'overdue') && <span className={`equipment-life-pill ${life.status}`}>{equipmentLifeStatusLabel(life.status)}</span>}
                                </div>
                              )}
                              {isCustom && <div className="checklist-item-actions"><button title="Rename item" onClick={() => renameTripItem(section, item.id, item.label)}>Edit</button><button title="Delete item" onClick={() => deleteTripItem(section, item.id)}><Trash2 size={15} /></button></div>}
                            </div>
                          );
                        })}
                        {!visibleItems.length && <p className="checklist-empty-section">{section.items.length ? 'Everything in this section is packed.' : 'No items yet.'}</p>}
                      </div>
                      {isCustom && <div className="checklist-section-actions"><button className="text-button" onClick={() => addTripItem(section)}><Plus size={15} /> Add item</button><button className="text-button" onClick={() => renameTripSection(section)}>Rename</button><button className="text-button destructive-text-button" onClick={() => deleteTripSection(section)}>Delete section</button></div>}
                      {isEquipment && <div className="checklist-section-actions"><button className="text-button" onClick={() => setMode('equipment')}><Wrench size={15} /> Manage equipment</button></div>}
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
          <EquipmentManager inventory={equipmentInventory} onSave={onSaveEquipmentInventory} />
        )}
      </section>

      {editor && <ChecklistEditDialog config={editor} onClose={() => setEditor(undefined)} />}
    </>
  );
}
