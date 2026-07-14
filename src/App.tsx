import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Cloud, CloudOff, Map, Plus, Settings2, TentTree } from 'lucide-react';
import { CampsitesPanel } from './components/CampsitesPanel';
import { DiaryPanel } from './components/DiaryPanel';
import { MapPanel } from './components/MapPanel';
import { PreferencesPanel } from './components/PreferencesPanel';
import { StayModal } from './components/StayModal';
import { createStayRemote, loadAppState, persistLocal, saveProfileRemote } from './lib/api';
import { createId } from './lib/id';
import type { AppState, Campsite, PreferenceProfile, Stay, StayDraft } from './types';

const tabs = [
  { id: 'map', label: 'Map', icon: Map },
  { id: 'diary', label: 'Diary', icon: BookOpen },
  { id: 'sites', label: 'Campsites', icon: TentTree },
  { id: 'preferences', label: 'Preferences', icon: Settings2 },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [mode, setMode] = useState<'cloud' | 'local'>('local');
  const [tab, setTab] = useState<TabId>('map');
  const [activeProfileId, setActiveProfileId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState<string>();
  const [staySite, setStaySite] = useState<Campsite | undefined>();
  const [showStayModal, setShowStayModal] = useState(false);

  useEffect(() => {
    loadAppState().then(({ state: loaded, mode: loadedMode }) => {
      setState(loaded);
      setMode(loadedMode);
      setActiveProfileId(loaded.profiles[0]?.id ?? '');
    });
  }, []);

  useEffect(() => {
    if (state) persistLocal(state);
  }, [state]);

  const activeProfile = useMemo(
    () => state?.profiles.find((profile) => profile.id === activeProfileId) ?? state?.profiles[0],
    [activeProfileId, state],
  );

  function openStay(site?: Campsite) {
    setStaySite(site);
    setShowStayModal(true);
  }

  function selectSite(site: Campsite) {
    setSelectedSiteId(site.id);
  }

  function saveStay(draft: StayDraft) {
    if (!state) return;
    const stay: Stay = {
      id: createId('stay'),
      siteId: draft.siteId,
      arrivalDate: draft.arrivalDate,
      departureDate: draft.departureDate,
      nights: draft.nights,
      nightlyRate: draft.nightlyRate,
      journal: draft.journal,
      weather: draft.weather,
      wouldReturn: draft.wouldReturn,
      observations: draft.observations,
      createdAt: new Date().toISOString(),
    };

    const nextSites = state.sites.map((site) => {
      if (site.id !== draft.siteId || draft.updateCurrentKeys.length === 0) return site;
      const currentFacts = { ...site.currentFacts };
      for (const key of draft.updateCurrentKeys) {
        const value = draft.observations[key];
        if (value === undefined) delete currentFacts[key];
        else currentFacts[key] = value;
      }
      return { ...site, currentFacts, status: 'visited' as const };
    });

    setState({ ...state, sites: nextSites, stays: [...state.stays, stay] });
    setShowStayModal(false);
    setTab('diary');
    createStayRemote(draft, stay).catch(() => setMode('local'));
  }

  function saveProfile(profile: PreferenceProfile) {
    if (!state) return;
    const exists = state.profiles.some((item) => item.id === profile.id);
    const profiles = exists
      ? state.profiles.map((item) => item.id === profile.id ? profile : item)
      : [...state.profiles, profile];
    setState({ ...state, profiles });
    setActiveProfileId(profile.id);
    saveProfileRemote(profile).catch(() => setMode('local'));
  }

  function duplicateProfile(profile: PreferenceProfile) {
    const copy: PreferenceProfile = {
      ...structuredClone(profile),
      id: createId('profile'),
      name: `${profile.name} copy`,
    };
    saveProfile(copy);
  }

  if (!state || !activeProfile) {
    return <div className="loading-screen"><TentTree size={42} /><strong>Loading your campsites…</strong></div>;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="brand" onClick={() => setTab('map')}>
          <span className="brand-mark"><TentTree /></span>
          <span><strong>Camp Ledger</strong><small>Map · ratings · camping diary</small></span>
        </button>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} className={tab === id ? 'nav-button active' : 'nav-button'} onClick={() => setTab(id)}><Icon size={18} /> {label}</button>
          ))}
        </nav>
        <div className="header-actions">
          <label className="profile-picker">
            <span>Viewing as</span>
            <select value={activeProfile.id} onChange={(event) => setActiveProfileId(event.target.value)}>
              {state.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </select>
          </label>
          <span className={`sync-status ${mode}`} title={mode === 'cloud' ? 'Connected to Cloudflare D1' : 'Using browser storage until D1 is connected'}>
            {mode === 'cloud' ? <Cloud size={16} /> : <CloudOff size={16} />}
            {mode === 'cloud' ? 'Cloud' : 'Local demo'}
          </span>
          <button className="primary-button header-add" onClick={() => openStay()}><Plus size={18} /> Log a stay</button>
        </div>
      </header>

      <main className="app-main">
        {tab === 'map' && (
          <MapPanel
            sites={state.sites}
            stays={state.stays}
            profile={activeProfile}
            selectedSiteId={selectedSiteId}
            onSelectSite={selectSite}
            onLogStay={openStay}
          />
        )}
        {tab === 'diary' && <DiaryPanel sites={state.sites} stays={state.stays} onAdd={() => openStay()} />}
        {tab === 'sites' && (
          <CampsitesPanel
            sites={state.sites}
            stays={state.stays}
            profile={activeProfile}
            onSelect={(site) => { selectSite(site); setTab('map'); }}
            onLogStay={openStay}
          />
        )}
        {tab === 'preferences' && <PreferencesPanel profile={activeProfile} onSave={saveProfile} onDuplicate={duplicateProfile} />}
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={20} /><span>{label}</span></button>
        ))}
      </nav>

      {showStayModal && <StayModal sites={state.sites} initialSite={staySite} onClose={() => setShowStayModal(false)} onSave={saveStay} />}
    </div>
  );
}
