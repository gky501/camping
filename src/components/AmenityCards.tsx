import type { SiteAmenities, SiteFeature } from '../types';

type ChoiceKey = Exclude<keyof SiteAmenities, 'features' | 'siteLengthFeet'>;

const choiceGroups: Array<{
  key: ChoiceKey;
  label: string;
  options: Array<{ value: string; label: string }>;
}> = [
  { key: 'electric', label: 'Electric', options: [{ value: '30amp', label: '30 amp' }, { value: '50amp', label: '50 amp' }, { value: 'none', label: 'None' }] },
  { key: 'water', label: 'Water', options: [{ value: 'yes', label: 'At site' }, { value: 'partial', label: 'Shared / partial' }, { value: 'none', label: 'None' }] },
  { key: 'sewer', label: 'Sewer', options: [{ value: 'site', label: 'At site' }, { value: 'station', label: 'Dump station' }, { value: 'none', label: 'None' }] },
  { key: 'wifi', label: 'Wi-Fi', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
  { key: 'surface', label: 'Parking surface', options: [{ value: 'asphalt', label: 'Asphalt' }, { value: 'concrete', label: 'Concrete' }, { value: 'gravel', label: 'Gravel' }, { value: 'dirt', label: 'Dirt' }, { value: 'grass', label: 'Grass' }] },
  { key: 'entry', label: 'Parking entry', options: [{ value: 'back-in', label: 'Back-in' }, { value: 'pull-through', label: 'Pull-through' }] },
  { key: 'shade', label: 'Shade', options: [{ value: 'full', label: 'Full' }, { value: 'partial', label: 'Partial' }, { value: 'open', label: 'Open' }] },
  { key: 'generator', label: 'Generator use', options: [{ value: 'allowed', label: 'Allowed' }, { value: 'restricted', label: 'Restricted hours' }, { value: 'not-allowed', label: 'Not allowed' }] },
];

const featureOptions: Array<{ value: SiteFeature; label: string }> = [
  { value: 'picnic-table', label: 'Picnic table' },
  { value: 'fire-ring', label: 'Fire ring' },
  { value: 'grill', label: 'Grill' },
  { value: 'waterfront', label: 'Waterfront' },
  { value: 'bathhouse-nearby', label: 'Bathhouse nearby' },
];

export function AmenityCards({ value, onChange }: {
  value: SiteAmenities;
  onChange: (amenities: SiteAmenities) => void;
}) {
  function setChoice(key: ChoiceKey, option: string) {
    const next = { ...value } as SiteAmenities;
    if (next[key] === option) delete next[key];
    else Object.assign(next, { [key]: option });
    onChange(next);
  }

  function toggleFeature(feature: SiteFeature) {
    const current = value.features ?? [];
    const features = current.includes(feature)
      ? current.filter((item) => item !== feature)
      : [...current, feature];
    onChange({ ...value, features });
  }

  return (
    <div className="amenity-editor">
      <p className="amenity-help">Tap a card to select it. Tap the selected card again to clear it.</p>
      {choiceGroups.map((group) => (
        <fieldset className="amenity-group" key={group.key}>
          <legend>{group.label}</legend>
          <div className="amenity-card-grid">
            {group.options.map((option) => {
              const active = value[group.key] === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={active ? 'amenity-card active' : 'amenity-card'}
                  aria-pressed={active}
                  onClick={() => setChoice(group.key, option.value)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <fieldset className="amenity-group">
        <legend>Site features</legend>
        <div className="amenity-card-grid amenity-feature-grid">
          {featureOptions.map((option) => {
            const active = (value.features ?? []).includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                className={active ? 'amenity-card active' : 'amenity-card'}
                aria-pressed={active}
                onClick={() => toggleFeature(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="field amenity-length-field">
        <span>Usable site length in feet</span>
        <input
          type="number"
          min="0"
          step="1"
          value={value.siteLengthFeet ?? ''}
          onChange={(event) => {
            const raw = event.target.value;
            const next = { ...value };
            if (!raw) delete next.siteLengthFeet;
            else next.siteLengthFeet = Number(raw);
            onChange(next);
          }}
          placeholder="Example: 55"
        />
      </label>
    </div>
  );
}
