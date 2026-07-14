import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Bookmark, Cloud, CloudOff, Map, Plus, Settings2, TentTree } from 'lucide-react';
import { CampsitesPanel } from './components/CampsitesPanel';
import { DiaryPanel } from './components/DiaryPanel';
import { MapPanel } from './components/MapPanel';
import { PreferencesPanel } from './components/PreferencesPanel';
import { StayModal } from './components/StayModal';
import { WishlistModal } from './components/WishlistModal';
import { WishlistPanel } from './components/WishlistPanel';
import { createSiteRemote, createStayRemote, deleteProfileRemote, deleteSiteRemote, loadAppState, persistLocal, saveProfileRemote, saveSiteRemote, updateStayRemote } from './lib/api';
import { createId } from './lib/id';
import type { AppState, Campsite, PreferenceProfile, Stay, StayDraft, WishlistSiteDraft } from './types';

const tabs = [
  { id: 'map', label: 'Map', icon: Map },
  { id: 'diary', label: 'Diary', icon: BookOpen },
  { id: 'wishlist', label: 'Wish list', icon: Bookmark },
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
  const [editingStay, setEditingStay] = useState<Stay | undefined>();
  const [showStayModal, setShowStayModal] = useState(false);
  const [showWishlistModal, setShowWishlistModal] = useState(false);
  const [wishlistSite, setWishlistSite] = useState<Campsite | undefined>();

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
    setEditingStay(undefined);
    setStaySite(site);
    setShowStayModal(true);
  }

  function openEditStay(stay: Stay) {
    setEditingStay(stay);
    setStaySite(state?.sites.find((site) => site.id === stay.siteId));
    setShowStayModal(true);
  }

  function closeStayModal() {
    setShowStayModal(false);
    setStaySite(undefined);
    setEditingStay(undefined);
  }

  function selectSite(site: Campsite) {
    setSelectedSiteId(site.id);
  }

  function saveStay(draft: StayDraft) {
    if (!state) return;
    const stay: Stay = {
      id: editingStay?.id ?? createId('stay'),
      siteId: draft.siteId,
      siteSnapshot: draft.siteSnapshot,
      arrivalDate: draft.arrivalDate,
      departureDate: draft.departureDate,
      nights: draft.nights,
      nightlyRate: draft.nightlyRate,
      journal: draft.journal,
      weather: draft.weather,
      wouldReturn: draft.wouldReturn,
      observations: draft.observations,
      createdAt: editingStay?.createdAt ?? new Date().toISOString(),
    };

    let workingSites = draft.createSite ? [...state.sites, draft.createSite] : [...state.sites];
    if (draft.updateSiteDetails) {
      workingSites = workingSites.map((site) => site.id === draft.siteId ? { ...site, ...draft.updateSiteDetails } : site);
    }

    const nextSites = workingSites.map((site) => {
      if (site.id !== draft.siteId) return site;
      const currentFacts = { ...site.currentFacts };
      for (const key of draft.updateCurrentKeys) {
        const value = draft.observations[key];
        if (value === undefined) delete currentFacts[key];
        else currentFacts[key] = value;
      }
      return { ...site, currentFacts, status: 'visited' as const };
    });

    const nextStays = editingStay
      ? state.stays.map((item) => item.id === editingStay.id ? stay : item)
      : [...state.stays, stay];

    setState({ ...state, sites: nextSites, stays: nextStays });
    closeStayModal();
    setTab('diary');

    void (async () => {
      if (draft.createSite) await createSiteRemote({ ...draft.createSite, status: 'visited' });
      else if (draft.updateSiteDetails) await saveSiteRemote({ ...draft.updateSiteDetails, status: 'visited' });
      if (editingStay) await updateStayRemote(draft, stay);
      else await createStayRemote(draft, stay);
    })().catch(() => setMode('local'));
  }

  function openWishlist(site?: Campsite) {
    setWishlistSite(site);
    setShowWishlistModal(true);
  }

  function saveWishlistSite(draft: WishlistSiteDraft) {
    if (!state) return;

    if (wishlistSite) {
      const updated: Campsite = { ...wishlistSite, ...draft, status: 'wishlist' };
      setState({ ...state, sites: state.sites.map((site) => site.id === updated.id ? updated : site) });
      setSelectedSiteId(updated.id);
      setWishlistSite(undefined);
      setShowWishlistModal(false);
      setTab('wishlist');
      saveSiteRemote(updated).catch(() => setMode('local'));
      return;
    }

    const site: Campsite = {
      id: createId('site'),
      ...draft,
      viewTypes: [],
      currentFacts: {},
      seasonalRatings: {},
      legacyStayCount: 0,
      favorite: false,
      status: 'wishlist',
    };
    setState({ ...state, sites: [...state.sites, site] });
    setSelectedSiteId(site.id);
    setWishlistSite(undefined);
    setShowWishlistModal(false);
    setTab('wishlist');
    createSiteRemote(site).catch(() => setMode('local'));
  }

  function deleteWishlistSite(site: Campsite) {
    if (!state) return;
    const label = [site.park, site.area, site.loop, `Site ${site.siteNumber}`].filter(Boolean).join(' · ');
    if (!window.confirm(`Delete ${label} from the wish list?`)) return;
    setState({ ...state, sites: state.sites.filter((item) => item.id !== site.id) });
    if (selectedSiteId === site.id) setSelectedSiteId(undefined);
    deleteSiteRemote(site.id).catch(() => setMode('local'));
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
      name: `${profile.name.trim() || 'Preference profile'} copy`,
    };
    saveProfile(copy);
  }

  function deleteProfile(profile: PreferenceProfile) {
    if (!state || state.profiles.length <= 1) return;
    if (!window.confirm(`Delete the preference profile “${profile.name}”? Campsite reviews and diary entries will not be deleted.`)) return;
    const profiles = state.profiles.filter((item) => item.id !== profile.id);
    setState({ ...state, profiles });
    setActiveProfileId(profiles[0]?.id ?? '');
    deleteProfileRemote(profile.id).catch(() => setMode('local'));
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
        {tab === 'diary' && <DiaryPanel sites={state.sites} stays={state.stays} onAdd={() => openStay()} onEdit={openEditStay} />}
        {tab === 'wishlist' && (
          <WishlistPanel
            sites={state.sites}
            stays={state.stays}
            profile={activeProfile}
            onSelect={(site) => { selectSite(site); setTab('map'); }}
            onLogStay={openStay}
            onAdd={() => openWishlist()}
            onEdit={openWishlist}
            onDelete={deleteWishlistSite}
          />
        )}
        {tab === 'sites' && (
          <CampsitesPanel
            sites={state.sites}
            stays={state.stays}
            profile={activeProfile}
            onSelect={(site) => { selectSite(site); setTab('map'); }}
            onLogStay={openStay}
          />
        )}
        {tab === 'preferences' && <PreferencesPanel profile={activeProfile} canDelete={state.profiles.length > 1} onSave={saveProfile} onDuplicate={duplicateProfile} onDelete={deleteProfile} />}
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={20} /><span>{label}</span></button>
        ))}
      </nav>

      {showStayModal && <StayModal sites={state.sites} initialSite={staySite} initialStay={editingStay} onClose={closeStayModal} onSave={saveStay} />}
      {showWishlistModal && <WishlistModal site={wishlistSite} onClose={() => { setShowWishlistModal(false); setWishlistSite(undefined); }} onSave={saveWishlistSite} />}
    </div>
  );
}
