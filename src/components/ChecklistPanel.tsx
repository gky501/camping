import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ClipboardCheck, ListPlus, Plus, Settings2, Trash2 } from 'lucide-react';
import { createId } from '../lib/id';
import type { Campsite, ChecklistSection, ChecklistTemplate, Stay, TripChecklist } from '../types';

interface ChecklistPanelProps {
  sites: Campsite[];
  stays: Stay[];
  template: ChecklistTemplate;
  tripChecklists: TripChecklist[];
  onSaveTemplate: (template: ChecklistTemplate) => void;
  onSaveTripChecklist: (checklist: TripChecklist) => void;
}

function stayLabel(stay: Stay, sites: Campsite[]): string {
  const site = sites.find((item) => item.id === stay.siteId);
  const location = stay.siteSnapshot ?? site;
  const park = location?.park ?? 'Unknown park';
  const siteNumber = location?.siteNumber ? ` · Site ${location.siteNumber}` : '';
  return `${stay.arrivalDate} · ${park}${siteNumber}`;
}

function sectionItemCount(sections: ChecklistSection[]): number {
  return sections.reduce((total, section) => total + section.items.length, 0);
}

export function ChecklistPanel({ sites, stays, template, tripChecklists, onSaveTemplate, onSaveTripChecklist }: ChecklistPanelProps) {
  const sortedStays = useMemo(
    () => [...stays].sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate)),
    [stays],
  );
  const today = new Date().toISOString().slice(0, 10);
  const suggestedStay = sortedStays.find((stay) => stay.departureDate >= today) ?? sortedStays[0];
  const [selectedStayId, setSelectedStayId] = useState(suggestedStay?.id ?? '');
  const [mode, setMode] = useState<'trip' | 'template'>('trip');
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
  const allSections = [...template.sections, ...tripChecklist.customSections];
  const allItemIds = allSections.flatMap((section) => section.items.map((item) => item.id));
  const checkedIds = new Set(tripChecklist.checkedItemIds.filter((id) => allItemIds.includes(id)));
  const totalItems = allItemIds.length;
  const completedItems = checkedIds.size;
  const progress = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;

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

  return (
    <section className="content-page checklist-page">
      <div className="page-heading checklist-heading">
        <div>
          <p className="eyebrow">Pack it once. Customize every trip.</p>
          <h2>Camping checklist</h2>
          <p>Maintain one standard packing list, then add trip-only sections for special meals, events, weather, repairs, or guests.</p>
        </div>
        <div className="checklist-mode-switch" role="group" aria-label="Checklist view">
          <button className={mode === 'trip' ? 'active' : ''} onClick={() => setMode('trip')}><ClipboardCheck size={17} /> Trip checklist</button>
          <button className={mode === 'template' ? 'active' : ''} onClick={() => setMode('template')}><Settings2 size={17} /> Standard items</button>
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
                const visibleItems = hideCompleted ? section.items.filter((item) => !checkedIds.has(item.id)) : section.items;
                const sectionComplete = section.items.length > 0 && section.items.every((item) => checkedIds.has(item.id));
                return (
                  <article className={`checklist-section-card ${sectionComplete ? 'complete' : ''}`} key={section.id}>
                    <div className="checklist-section-heading">
                      <div><p className="eyebrow">{isCustom ? 'This trip only' : 'Standard section'}</p><h3>{section.name}</h3></div>
                      <span>{section.items.filter((item) => checkedIds.has(item.id)).length}/{section.items.length}</span>
                    </div>
                    <div className="checklist-items">
                      {visibleItems.map((item) => (
                        <div className={`checklist-item ${checkedIds.has(item.id) ? 'checked' : ''}`} key={item.id}>
                          <label><input type="checkbox" checked={checkedIds.has(item.id)} onChange={() => toggleItem(item.id)} /><span>{item.label}</span></label>
                          {isCustom && <div className="checklist-item-actions"><button title="Rename item" onClick={() => renameTripItem(section, item.id, item.label)}>Edit</button><button title="Delete item" onClick={() => deleteTripItem(section, item.id)}><Trash2 size={15} /></button></div>}
                        </div>
                      ))}
                      {!visibleItems.length && <p className="checklist-empty-section">{section.items.length ? 'Everything in this section is packed.' : 'No items yet.'}</p>}
                    </div>
                    {isCustom && <div className="checklist-section-actions"><button className="text-button" onClick={() => addTripItem(section)}><Plus size={15} /> Add item</button><button className="text-button" onClick={() => renameTripSection(section)}>Rename</button><button className="text-button destructive-text-button" onClick={() => deleteTripSection(section)}>Delete section</button></div>}
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="empty-state"><CalendarDays size={42} /><h3>Log a trip first</h3><p>Trip checklists attach to diary entries so each camping trip can keep its own completion and custom sections.</p></div>
        )
      ) : (
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
      )}
    </section>
  );
}
