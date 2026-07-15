import { useEffect, useMemo, useState } from 'react';
import { BarChart3, BookOpen, Bookmark, ClipboardCheck, Cloud, CloudOff, Map, Menu, Plus, Settings2, TentTree, Truck, Trees, X } from 'lucide-react';
import { CamperEditModal } from './components/CamperEditModal';
import { CampersPanel } from './components/CampersPanel';
import { CampsitesPanel } from './components/CampsitesPanel';
import { ChecklistPanel } from './components/ChecklistPanel';
import { MapPanel } from './components/MapPanel';
import { ParkEditModal } from './components/ParkEditModal';
import { ParksPanel } from './components/ParksPanel';
import { PassportPanel } from './components/PassportPanel';
import { PreferencesPanel } from './components/PreferencesPanel';
import { StatsPanel } from './components/StatsPanel';
import { StayModal } from './components/StayModal';
import { TripDashboardModal } from './components/TripDashboardModal';
import { WishlistModal } from './components/WishlistModal';
import { WishlistPanel } from './components/WishlistPanel';
import { createCamperRemote, createSiteRemote, createStayRemote, deleteCamperRemote, deleteProfileRemote, deleteSiteRemote, deleteStayRemote, deleteTripPhotoRemote, loadAppState, persistLocal, saveCamperRemote, saveChecklistTemplateRemote, saveEquipmentInventoryRemote, saveHomeBaseRemote, saveParkRemote, saveProfileRemote, saveSiteRemote, saveTripChecklistRemote, saveTripDetailsRemote, updateStayRemote } from './lib/api';
import { DEFAULT_CHECKLIST_TEMPLATE } from './lib/checklistDefaults';
import { DEFAULT_EQUIPMENT_INVENTORY } from './lib/equipment';
import { DEFAULT_HOME_BASE } from './lib/geo';
import { createId } from './lib/id';
import { mergeParkProfiles, renameParkRecords } from './lib/parks';
import type { AppState, CamperProfile, Campsite, ChecklistTemplate, EquipmentInventory, HomeBase, ParkProfile, PreferenceProfile, Stay, StayDraft, TripChecklist, TripDetail, TripDetailsMap, WishlistSiteDraft } from './types';

type TabId = 'passport' | 'places' | 'checklist' | 'stats' | 'campers' | 'wishlist' | 'preferences';
type PlaceView = 'map' | 'parks' | 'sites';

const primaryTabs = [
  { id: 'passport' as const, label: 'Passport', icon: BookOpen },
  { id: 'places' as const, label: 'Places', icon: Map },
  { id: 'checklist' as const, label: 'Checklist', icon: ClipboardCheck },
];

const moreTabs = [
  { id: 'wishlist' as const, label: 'Wish list', detail: 'Places you want to camp', icon: Bookmark },
  { id: 'campers' as const, label: 'Campers', detail: 'Trailers, tents, and tow setups', icon: Truck },
  { id: 'stats' as const, label: 'Detailed recap', detail: 'Charts, records, and lifetime patterns', icon: BarChart3 },
  { id: 'preferences' as const, label: 'Preferences', detail: 'Scoring and profile settings', icon: Settings2 },
];

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [mode, setMode] = useState<'cloud' | 'local'>('local');
  const [tab, setTab] = useState<TabId>('passport');
  const [placeView, setPlaceView] = useState<PlaceView>('map');
  const [moreOpen, setMoreOpen] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState<string>();
  const [checklistStayId, setChecklistStayId] = useState<string>();
  const [dashboardStay, setDashboardStay] = useState<Stay>();
  const [staySite, setStaySite] = useState<Campsite | undefined>();
  const [editingStay, setEditingStay] = useState<Stay | undefined>();
  const [showStayModal, setShowStayModal] = useState(false);
  const [showWishlistModal, setShowWishlistModal] = useState(false);
  const [wishlistSite, setWishlistSite] = useState<Campsite | undefined>();
  const [parkToEdit, setParkToEdit] = useState<ParkProfile | undefined>();
  const [showCamperModal, setShowCamperModal] = useState(false);
  const [camperToEdit, setCamperToEdit] = useState<CamperProfile | undefined>();

  useEffect(() => {
    loadAppState().then(({ state: loaded, mode: loadedMode }) => {
      setState(loaded);
      setMode(loadedMode);
      setActiveProfileId(loaded.profiles[0]?.id ?? '');
    });
  }, []);

  useEffect(() => { if (state) persistLocal(state); }, [state]);

  const activeProfile = useMemo(
    () => state?.profiles.find((profile) => profile.id === activeProfileId) ?? state?.profiles[0],
    [activeProfileId, state],
  );

  function openTab(nextTab: TabId) { setTab(nextTab); setMoreOpen(false); }
  function openPlace(nextView: PlaceView = 'map') { setPlaceView(nextView); setTab('places'); setMoreOpen(false); }
  function openStay(site?: Campsite) { setEditingStay(undefined); setStaySite(site); setShowStayModal(true); }
  function openEditStay(stay: Stay) { setDashboardStay(undefined); setEditingStay(stay); setStaySite(state?.sites.find((site) => site.id === stay.siteId)); setShowStayModal(true); }
  function closeStayModal() { setShowStayModal(false); setStaySite(undefined); setEditingStay(undefined); }
  function selectSite(site: Campsite) { setSelectedSiteId(site.id); }
  function selectSiteOnMap(site: Campsite) { selectSite(site); openPlace('map'); }
  function openChecklistForStay(stay: Stay) { setDashboardStay(undefined); setChecklistStayId(stay.id); openTab('checklist'); }
  function openDashboardForStay(stay: Stay) { setDashboardStay(stay); }

  function saveStay(draft: StayDraft) {
    if (!state) return;
    const stay: Stay = {
      id: editingStay?.id ?? createId('stay'),
      siteId: draft.siteId,
      camperId: draft.camperId,
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
    if (draft.updateSiteDetails) workingSites = workingSites.map((site) => site.id === draft.siteId ? { ...site, ...draft.updateSiteDetails } : site);
    const nextSites = workingSites.map((site) => {
      if (site.id !== draft.siteId) return site;
      const currentFacts = { ...site.currentFacts };
      for (const key of draft.updateCurrentKeys) {
        const value = draft.observations[key];
        if (value === undefined) delete currentFacts[key]; else currentFacts[key] = value;
      }
      return { ...site, currentFacts, status: 'visited' as const };
    });
    const nextStays = editingStay ? state.stays.map((item) => item.id === editingStay.id ? stay : item) : [...state.stays, stay];
    const nextParks = mergeParkProfiles(state.parks, nextSites, nextStays);

    setState({ ...state, sites: nextSites, stays: nextStays, parks: nextParks });
    closeStayModal();
    openTab('passport');
    void (async () => {
      if (draft.createSite) await createSiteRemote({ ...draft.createSite, status: 'visited' });
      else if (draft.updateSiteDetails) await saveSiteRemote({ ...draft.updateSiteDetails, status: 'visited' });
      if (editingStay) await updateStayRemote(draft, stay); else await createStayRemote(draft, stay);
    })().catch(() => setMode('local'));
  }

  function deleteStay(stay: Stay) {
    if (!state) return;
    const site = state.sites.find((item) => item.id === stay.siteId);
    const location = stay.siteSnapshot ?? site;
    const label = [location?.park, location?.area, location?.loop ? `Loop ${location.loop}` : '', location?.siteNumber ? `Site ${location.siteNumber}` : ''].filter(Boolean).join(' · ');
    if (!window.confirm(`Delete this diary entry${label ? ` for ${label}` : ''}? This cannot be undone.`)) return;

    const otherSiteStays = state.stays.filter((item) => item.id !== stay.id && item.siteId === stay.siteId);
    let deleteOrphanSite = false;
    if (site && otherSiteStays.length === 0) {
      deleteOrphanSite = window.confirm(`This is the only trip connected to this campsite.\n\nSelect OK to also delete the campsite and its map marker.\nSelect Cancel to keep it as a gray wish-list site.`);
    }

    const nextStays = state.stays.filter((item) => item.id !== stay.id);
    const nextSites = deleteOrphanSite
      ? state.sites.filter((item) => item.id !== stay.siteId)
      : state.sites.map((item) => item.id === stay.siteId && otherSiteStays.length === 0 ? { ...item, status: 'wishlist' as const } : item);
    const nextParks = mergeParkProfiles(state.parks, nextSites, nextStays);
    const nextTripDetails = { ...(state.tripDetails ?? {}) };
    const removedDetail = nextTripDetails[stay.id];
    delete nextTripDetails[stay.id];
    setState({
      ...state,
      sites: nextSites,
      stays: nextStays,
      parks: nextParks,
      tripChecklists: (state.tripChecklists ?? []).filter((checklist) => checklist.stayId !== stay.id),
      tripDetails: nextTripDetails,
    });
    if (deleteOrphanSite && selectedSiteId === stay.siteId) setSelectedSiteId(undefined);
    if (checklistStayId === stay.id) setChecklistStayId(undefined);
    if (dashboardStay?.id === stay.id) setDashboardStay(undefined);
    deleteStayRemote(stay.id, deleteOrphanSite).catch(() => setMode('local'));
    saveTripDetailsRemote(nextTripDetails).catch(() => setMode('local'));
    for (const photo of removedDetail?.photos ?? []) deleteTripPhotoRemote(photo.key).catch(() => undefined);
  }

  function openCamper(camper?: CamperProfile) { setCamperToEdit(camper); setShowCamperModal(true); }
  function saveCamper(camper: CamperProfile) {
    if (!state) return;
    const existing = (state.campers ?? []).some((item) => item.id === camper.id);
    const campers = existing ? (state.campers ?? []).map((item) => item.id === camper.id ? camper : item) : [...(state.campers ?? []), camper];
    setState({ ...state, campers });
    setShowCamperModal(false);
    setCamperToEdit(undefined);
    openTab('campers');
    (existing ? saveCamperRemote(camper) : createCamperRemote(camper)).catch(() => setMode('local'));
  }
  function deleteCamper(camper: CamperProfile) {
    if (!state || camper.id === 'camper-tent') return;
    if (!window.confirm(`Delete the camper profile “${camper.name}”? Trips will remain in the Passport but will no longer be tagged to this camper.`)) return;
    setState({ ...state, campers: (state.campers ?? []).filter((item) => item.id !== camper.id), stays: state.stays.map((stay) => stay.camperId === camper.id ? { ...stay, camperId: undefined } : stay) });
    deleteCamperRemote(camper.id).catch(() => setMode('local'));
  }

  function savePark(park: ParkProfile) {
    if (!state || !parkToEdit) return;
    const original = parkToEdit;
    const renamed = renameParkRecords(state.sites, state.stays, original, park);
    const parks = (state.parks ?? []).map((item) => item.id === original.id ? park : item).sort((a, b) => a.name.localeCompare(b.name) || a.state.localeCompare(b.state));
    setState({ ...state, ...renamed, parks });
    setParkToEdit(undefined);
    saveParkRemote(original, park).catch(() => setMode('local'));
  }

  function openWishlist(site?: Campsite) { setWishlistSite(site); setShowWishlistModal(true); }
  function saveWishlistSite(draft: WishlistSiteDraft) {
    if (!state) return;
    if (wishlistSite) {
      const updated: Campsite = { ...wishlistSite, ...draft, status: 'wishlist' };
      setState({ ...state, sites: state.sites.map((site) => site.id === updated.id ? updated : site) });
      setSelectedSiteId(updated.id); setWishlistSite(undefined); setShowWishlistModal(false); openTab('wishlist');
      saveSiteRemote(updated).catch(() => setMode('local'));
      return;
    }
    const site: Campsite = { id: createId('site'), ...draft, viewTypes: [], currentFacts: {}, seasonalRatings: {}, legacyStayCount: 0, favorite: false, status: 'wishlist' };
    setState({ ...state, sites: [...state.sites, site] });
    setSelectedSiteId(site.id); setWishlistSite(undefined); setShowWishlistModal(false); openTab('wishlist');
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
    const profiles = exists ? state.profiles.map((item) => item.id === profile.id ? profile : item) : [...state.profiles, profile];
    setState({ ...state, profiles }); setActiveProfileId(profile.id); saveProfileRemote(profile).catch(() => setMode('local'));
  }
  function duplicateProfile(profile: PreferenceProfile) { saveProfile({ ...structuredClone(profile), id: createId('profile'), name: `${profile.name.trim() || 'Preference profile'} copy` }); }
  function deleteProfile(profile: PreferenceProfile) {
    if (!state || state.profiles.length <= 1) return;
    if (!window.confirm(`Delete the preference profile “${profile.name}”? Campsite reviews and Passport entries will not be deleted.`)) return;
    const profiles = state.profiles.filter((item) => item.id !== profile.id);
    setState({ ...state, profiles }); setActiveProfileId(profiles[0]?.id ?? ''); deleteProfileRemote(profile.id).catch(() => setMode('local'));
  }

  function saveChecklistTemplate(template: ChecklistTemplate) {
    if (!state) return;
    setState({ ...state, checklistTemplate: template });
    saveChecklistTemplateRemote(template).catch(() => setMode('local'));
  }

  function saveTripChecklist(checklist: TripChecklist) {
    if (!state) return;
    const existing = (state.tripChecklists ?? []).some((item) => item.stayId === checklist.stayId);
    const tripChecklists = existing
      ? (state.tripChecklists ?? []).map((item) => item.stayId === checklist.stayId ? checklist : item)
      : [...(state.tripChecklists ?? []), checklist];
    setState({ ...state, tripChecklists });
    saveTripChecklistRemote(checklist).catch(() => setMode('local'));
  }

  function saveEquipmentInventory(equipmentInventory: EquipmentInventory) {
    if (!state) return;
    setState({ ...state, equipmentInventory });
    saveEquipmentInventoryRemote(equipmentInventory).catch(() => setMode('local'));
  }

  function saveHomeBase(homeBase: HomeBase) {
    if (!state) return;
    setState({ ...state, homeBase });
    saveHomeBaseRemote(homeBase).catch(() => setMode('local'));
  }

  function saveTripDetail(stayId: string, detail: TripDetail) {
    if (!state) return;
    const tripDetails: TripDetailsMap = { ...(state.tripDetails ?? {}), [stayId]: detail };
    setState({ ...state, tripDetails });
    saveTripDetailsRemote(tripDetails).catch(() => setMode('local'));
  }

  if (!state || !activeProfile) return <div className="loading-screen"><TentTree size={42} /><strong>Loading your campsites…</strong></div>;

  const moreActive = moreTabs.some((item) => item.id === tab);

  return (
    <div className="app-shell app-shell-v2">
      <header className="app-header app-header-v2">
        <button className="brand" onClick={() => openTab('passport')}><span className="brand-mark"><TentTree /></span><span><strong>Camp Ledger</strong><small>Your camping passport</small></span></button>
        <nav className="desktop-nav primary-nav-v2" aria-label="Primary navigation">
          {primaryTabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'nav-button active' : 'nav-button'} onClick={() => openTab(id)}><Icon size={18} /> {label}</button>)}
          <button className={moreActive || moreOpen ? 'nav-button active' : 'nav-button'} onClick={() => setMoreOpen((open) => !open)}><Menu size={18} /> More</button>
        </nav>
        <div className="header-actions">
          <label className="profile-picker"><span>Viewing as</span><select value={activeProfile.id} onChange={(event) => setActiveProfileId(event.target.value)}>{state.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
          <span className={`sync-status ${mode}`} title={mode === 'cloud' ? 'Connected to Cloudflare D1' : 'Using browser storage until D1 is connected'}>{mode === 'cloud' ? <Cloud size={16} /> : <CloudOff size={16} />}{mode === 'cloud' ? 'Cloud' : 'Local demo'}</span>
          <button className="primary-button header-add" onClick={() => openStay()}><Plus size={18} /> Add trip</button>
        </div>
      </header>

      {moreOpen && <div className="more-menu-backdrop" role="presentation" onMouseDown={() => setMoreOpen(false)}>
        <aside className="more-menu-card" aria-label="More Camp Ledger sections" onMouseDown={(event) => event.stopPropagation()}>
          <div className="more-menu-heading"><div><p className="eyebrow">More</p><h3>Camp Ledger tools</h3></div><button className="icon-button" onClick={() => setMoreOpen(false)} aria-label="Close"><X /></button></div>
          {moreTabs.map(({ id, label, detail, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => openTab(id)}><span><Icon /></span><div><strong>{label}</strong><small>{detail}</small></div></button>)}
        </aside>
      </div>}

      <main className="app-main">
        {tab === 'passport' && <PassportPanel sites={state.sites} stays={state.stays} campers={state.campers ?? []} onAdd={() => openStay()} onEdit={openEditStay} onDelete={deleteStay} onChecklist={openChecklistForStay} onDashboard={openDashboardForStay} onOpenRecap={() => openTab('stats')} />}
        {tab === 'places' && <>
          <nav className="places-subnav" aria-label="Places views">
            <button className={placeView === 'map' ? 'active' : ''} onClick={() => setPlaceView('map')}><Map size={17} /> Map</button>
            <button className={placeView === 'parks' ? 'active' : ''} onClick={() => setPlaceView('parks')}><Trees size={17} /> Parks</button>
            <button className={placeView === 'sites' ? 'active' : ''} onClick={() => setPlaceView('sites')}><TentTree size={17} /> Campsites</button>
          </nav>
          {placeView === 'map' && <MapPanel sites={state.sites} stays={state.stays} profile={activeProfile} selectedSiteId={selectedSiteId} onSelectSite={selectSite} onLogStay={openStay} />}
          {placeView === 'parks' && <ParksPanel parks={state.parks ?? []} sites={state.sites} stays={state.stays} profile={activeProfile} onEdit={setParkToEdit} onSelectSite={selectSiteOnMap} onLogStay={openStay} />}
          {placeView === 'sites' && <CampsitesPanel sites={state.sites} stays={state.stays} profile={activeProfile} onSelect={selectSiteOnMap} onLogStay={openStay} />}
        </>}
        {tab === 'checklist' && <ChecklistPanel sites={state.sites} stays={state.stays} template={state.checklistTemplate ?? DEFAULT_CHECKLIST_TEMPLATE} tripChecklists={state.tripChecklists ?? []} equipmentInventory={state.equipmentInventory ?? DEFAULT_EQUIPMENT_INVENTORY} initialStayId={checklistStayId} onSaveTemplate={saveChecklistTemplate} onSaveTripChecklist={saveTripChecklist} onSaveEquipmentInventory={saveEquipmentInventory} />}
        {tab === 'stats' && <StatsPanel sites={state.sites} stays={state.stays} campers={state.campers ?? []} profile={activeProfile} homeBase={state.homeBase ?? DEFAULT_HOME_BASE} onSaveHomeBase={saveHomeBase} />}
        {tab === 'campers' && <CampersPanel campers={state.campers ?? []} stays={state.stays} sites={state.sites} onAdd={() => openCamper()} onEdit={openCamper} onDelete={deleteCamper} />}
        {tab === 'wishlist' && <WishlistPanel sites={state.sites} stays={state.stays} profile={activeProfile} onSelect={selectSiteOnMap} onLogStay={openStay} onAdd={() => openWishlist()} onEdit={openWishlist} onDelete={deleteWishlistSite} />}
        {tab === 'preferences' && <PreferencesPanel profile={activeProfile} canDelete={state.profiles.length > 1} onSave={saveProfile} onDuplicate={duplicateProfile} onDelete={deleteProfile} />}
      </main>

      <nav className="mobile-nav mobile-nav-v2" aria-label="Mobile navigation">
        {primaryTabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => openTab(id)}><Icon size={20} /><span>{label}</span></button>)}
        <button className={moreActive || moreOpen ? 'active' : ''} onClick={() => setMoreOpen(true)}><Menu size={20} /><span>More</span></button>
      </nav>

      {showStayModal && <StayModal sites={state.sites} campers={state.campers ?? []} initialSite={staySite} initialStay={editingStay} onClose={closeStayModal} onSave={saveStay} />}
      {dashboardStay && <TripDashboardModal stay={dashboardStay} site={state.sites.find((site) => site.id === dashboardStay.siteId)} camper={(state.campers ?? []).find((camper) => camper.id === dashboardStay.camperId)} equipmentInventory={state.equipmentInventory ?? DEFAULT_EQUIPMENT_INVENTORY} detail={state.tripDetails?.[dashboardStay.id]} onSaveDetail={(detail) => saveTripDetail(dashboardStay.id, detail)} onChecklist={() => openChecklistForStay(dashboardStay)} onEdit={() => openEditStay(dashboardStay)} onClose={() => setDashboardStay(undefined)} />}
      {showWishlistModal && <WishlistModal site={wishlistSite} onClose={() => { setShowWishlistModal(false); setWishlistSite(undefined); }} onSave={saveWishlistSite} />}
      {parkToEdit && <ParkEditModal park={parkToEdit} onClose={() => setParkToEdit(undefined)} onSave={savePark} />}
      {showCamperModal && <CamperEditModal camper={camperToEdit} onClose={() => { setShowCamperModal(false); setCamperToEdit(undefined); }} onSave={saveCamper} />}
    </div>
  );
}
