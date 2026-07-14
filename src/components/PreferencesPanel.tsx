import { useEffect, useState } from 'react';
import { Copy, Save, SlidersHorizontal } from 'lucide-react';
import { CRITERIA, MONTHS, type PreferenceProfile } from '../types';

export function PreferencesPanel({ profile, onSave, onDuplicate }: {
  profile: PreferenceProfile;
  onSave: (profile: PreferenceProfile) => void;
  onDuplicate: (profile: PreferenceProfile) => void;
}) {
  const [draft, setDraft] = useState(profile);
  useEffect(() => setDraft(profile), [profile]);

  return (
    <section className="content-page">
      <div className="page-heading">
        <div><p className="eyebrow">Personalized ranking</p><h2>{draft.name}</h2><p>These settings change the match score and map colors without changing any campsite’s original observations.</p></div>
        <div className="button-row"><button className="secondary-button" onClick={() => onDuplicate(draft)}><Copy size={17} /> Duplicate profile</button><button className="primary-button" onClick={() => onSave(draft)}><Save size={17} /> Save changes</button></div>
      </div>
      <div className="preference-columns">
        <div className="settings-card">
          <div className="settings-heading"><SlidersHorizontal /><div><h3>Site priorities</h3><p>0 ignores the area. 5 makes it essential to the calculated score.</p></div></div>
          {CRITERIA.map((criterion) => (
            <label className="weight-row" key={criterion.key}>
              <div><strong>{criterion.label}</strong><small>{criterion.hint}</small></div>
              <input type="range" min="0" max="5" step="0.25" value={draft.criterionWeights[criterion.key]} onChange={(event) => setDraft({ ...draft, criterionWeights: { ...draft.criterionWeights, [criterion.key]: Number(event.target.value) } })} />
              <output>{draft.criterionWeights[criterion.key]}</output>
            </label>
          ))}
        </div>
        <div className="settings-card">
          <div className="settings-heading"><CalendarIcon /><div><h3>Seasonal preferences</h3><p>Lower winter months today; raise them later without rerating any campsite.</p></div></div>
          <div className="month-grid">
            {MONTHS.map((month) => (
              <label className="month-weight" key={month.key}><span>{month.short}</span><input type="number" min="0" max="5" step="0.05" value={draft.monthWeights[month.key]} onChange={(event) => setDraft({ ...draft, monthWeights: { ...draft.monthWeights, [month.key]: Number(event.target.value) } })} /></label>
            ))}
          </div>
          <div className="balance-block">
            <h3>Score balance</h3>
            <label className="weight-row"><div><strong>Physical site quality</strong><small>Levelness, cell service, privacy, and similar ratings</small></div><input type="range" min="0" max="100" value={draft.siteQualityShare} onChange={(event) => { const value = Number(event.target.value); setDraft({ ...draft, siteQualityShare: value, seasonalShare: 100 - value }); }} /><output>{draft.siteQualityShare}%</output></label>
            <label className="weight-row"><div><strong>Seasonal suitability</strong><small>How the site performs during months you care about</small></div><input type="range" min="0" max="100" value={draft.seasonalShare} onChange={(event) => { const value = Number(event.target.value); setDraft({ ...draft, seasonalShare: value, siteQualityShare: 100 - value }); }} /><output>{draft.seasonalShare}%</output></label>
          </div>
        </div>
      </div>
    </section>
  );
}

function CalendarIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/></svg>;
}
