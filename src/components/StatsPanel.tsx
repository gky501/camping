import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, DollarSign, LocateFixed, MapPin, Moon, Navigation, TentTree, Trophy, Truck } from 'lucide-react';
import { distanceMiles } from '../lib/geo';
import { calculateOverall, formatScore } from '../lib/scoring';
import type { CamperProfile, Campsite, HomeBase, PreferenceProfile, Stay } from '../types';

interface StatsPanelProps {
  sites: Campsite[];
  stays: Stay[];
  campers: CamperProfile[];
  profile: PreferenceProfile;
  homeBase: HomeBase;
  onSaveHomeBase: (homeBase: HomeBase) => void;
}

interface StayLocation {
  park: string;
  state: string;
  area?: string;
  loop: string;
  siteNumber: string;
  latitude: number;
  longitude: number;
}

function locationForStay(stay: Stay, sites: Campsite[]): StayLocation | undefined {
  return stay.siteSnapshot ?? sites.find((site) => site.id === stay.siteId);
}

function parkKey(location?: StayLocation): string {
  return location ? `${location.park.trim().toLowerCase()}::${location.state.trim().toLowerCase()}` : 'unknown';
}

function siteLabel(location?: StayLocation): string {
  if (!location) return 'Unknown campsite';
  return [location.park, location.area, location.loop ? `Loop ${location.loop}` : '', location.siteNumber ? `Site ${location.siteNumber}` : ''].filter(Boolean).join(' · ');
}

function parkLabel(location?: StayLocation): string {
  if (!location) return 'Unknown park';
  return `${location.park}, ${location.state}`;
}

function currency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

export function StatsPanel({ sites, stays, campers, profile, homeBase, onSaveHomeBase }: StatsPanelProps) {
  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const years = new Set(stays.map((stay) => Number(stay.arrivalDate.slice(0, 4))).filter(Number.isFinite));
    years.add(currentYear);
    return [...years].sort((a, b) => b - a);
  }, [currentYear, stays]);
  const [year, setYear] = useState<number>(availableYears.includes(currentYear) ? currentYear : (availableYears[0] ?? currentYear));
  const [homeDraft, setHomeDraft] = useState(homeBase);
  const [locating, setLocating] = useState(false);

  useEffect(() => setHomeDraft(homeBase), [homeBase]);
  useEffect(() => { if (!availableYears.includes(year)) setYear(availableYears[0] ?? currentYear); }, [availableYears, currentYear, year]);

  const yearStays = useMemo(() => stays.filter((stay) => Number(stay.arrivalDate.slice(0, 4)) === year), [stays, year]);
  const yearStats = useMemo(() => {
    const monthlyNights = Array.from({ length: 12 }, () => 0);
    const parks = new Set<string>();
    const states = new Set<string>();
    let nights = 0;
    let cost = 0;
    for (const stay of yearStays) {
      const month = Number(stay.arrivalDate.slice(5, 7)) - 1;
      if (month >= 0 && month < 12) monthlyNights[month] += stay.nights;
      nights += stay.nights;
      cost += (stay.nightlyRate ?? 0) * stay.nights;
      const location = locationForStay(stay, sites);
      if (location) { parks.add(parkKey(location)); states.add(location.state); }
    }
    const today = new Date().toISOString().slice(0, 10);
    return {
      trips: yearStays.length,
      nights,
      cost,
      parks: parks.size,
      states: states.size,
      planned: yearStays.filter((stay) => stay.arrivalDate > today).length,
      completed: yearStays.filter((stay) => stay.departureDate < today).length,
      monthlyNights,
    };
  }, [sites, yearStays]);

  const records = useMemo(() => {
    const siteGroups = new Map<string, { stays: Stay[]; location?: StayLocation }>();
    const parkGroups = new Map<string, { stays: Stay[]; location?: StayLocation; siteIds: Set<string> }>();
    const camperGroups = new Map<string, Stay[]>();

    for (const stay of stays) {
      const location = locationForStay(stay, sites);
      const siteGroup = siteGroups.get(stay.siteId) ?? { stays: [], location };
      siteGroup.stays.push(stay);
      if (!siteGroup.location) siteGroup.location = location;
      siteGroups.set(stay.siteId, siteGroup);

      const key = parkKey(location);
      const parkGroup = parkGroups.get(key) ?? { stays: [], location, siteIds: new Set<string>() };
      parkGroup.stays.push(stay);
      parkGroup.siteIds.add(stay.siteId);
      if (!parkGroup.location) parkGroup.location = location;
      parkGroups.set(key, parkGroup);

      if (stay.camperId) camperGroups.set(stay.camperId, [...(camperGroups.get(stay.camperId) ?? []), stay]);
    }

    const mostStayedSite = [...siteGroups.values()].sort((a, b) => {
      const stayDifference = b.stays.length - a.stays.length;
      return stayDifference || b.stays.reduce((sum, stay) => sum + stay.nights, 0) - a.stays.reduce((sum, stay) => sum + stay.nights, 0);
    })[0];

    const mostVisitedPark = [...parkGroups.values()].sort((a, b) => {
      const stayDifference = b.stays.length - a.stays.length;
      return stayDifference || b.stays.reduce((sum, stay) => sum + stay.nights, 0) - a.stays.reduce((sum, stay) => sum + stay.nights, 0);
    })[0];

    const favoritePark = [...parkGroups.values()].map((group) => {
      const ratedSites = [...group.siteIds]
        .map((id) => sites.find((site) => site.id === id))
        .filter((site): site is Campsite => Boolean(site))
        .map((site) => calculateOverall(site, profile))
        .filter((score): score is number => score !== null);
      return { group, score: ratedSites.length ? ratedSites.reduce((sum, score) => sum + score, 0) / ratedSites.length : null };
    }).filter((entry) => entry.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

    const furthestStay = stays.map((stay) => {
      const location = locationForStay(stay, sites);
      return { stay, location, distance: location ? distanceMiles(homeBase, location) : -1 };
    }).sort((a, b) => b.distance - a.distance)[0];

    const topCamperEntry = [...camperGroups.entries()].sort((a, b) => {
      const nightDifference = b[1].reduce((sum, stay) => sum + stay.nights, 0) - a[1].reduce((sum, stay) => sum + stay.nights, 0);
      return nightDifference || b[1].length - a[1].length;
    })[0];
    const longestStay = [...stays].sort((a, b) => b.nights - a.nights)[0];
    const totalNights = stays.reduce((sum, stay) => sum + stay.nights, 0);
    const totalCost = stays.reduce((sum, stay) => sum + (stay.nightlyRate ?? 0) * stay.nights, 0);

    return {
      mostStayedSite,
      mostVisitedPark,
      favoritePark,
      furthestStay,
      topCamper: topCamperEntry ? campers.find((camper) => camper.id === topCamperEntry[0]) : undefined,
      topCamperStays: topCamperEntry?.[1] ?? [],
      longestStay,
      totalNights,
      totalCost,
      averageNightlyCost: totalNights ? totalCost / totalNights : 0,
    };
  }, [campers, homeBase, profile, sites, stays]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      window.alert('Location is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setHomeDraft((current) => ({ ...current, latitude: position.coords.latitude, longitude: position.coords.longitude }));
        setLocating(false);
      },
      (failure) => {
        window.alert(failure.message || 'Unable to get your current location.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  const maxMonthlyNights = Math.max(...yearStats.monthlyNights, 1);
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hasFurthestDestination = Boolean(records.furthestStay && records.furthestStay.distance >= 0);

  return (
    <section className="content-page stats-page">
      <div className="page-heading stats-heading">
        <div>
          <p className="eyebrow">Your camping year in review</p>
          <h2>Recap & records</h2>
          <p>See where you camped, how often you returned, what it cost, and which places earned a spot in your personal record book.</p>
        </div>
        <label className="field stats-year-picker"><span>Recap year</span><select value={year} onChange={(event) => setYear(Number(event.target.value))}>{availableYears.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
      </div>

      <div className="stats-hero-grid">
        <article className="stats-hero-card"><CalendarDays /><div><strong>{yearStats.trips}</strong><span>trips in {year}</span><small>{yearStats.completed} completed · {yearStats.planned} planned</small></div></article>
        <article className="stats-hero-card"><Moon /><div><strong>{yearStats.nights}</strong><span>nights camped</span><small>{yearStats.parks} parks · {yearStats.states} states</small></div></article>
        <article className="stats-hero-card"><DollarSign /><div><strong>{currency(yearStats.cost)}</strong><span>estimated campsite cost</span><small>{yearStats.nights ? currency(yearStats.cost / yearStats.nights) : '$0'} per night</small></div></article>
      </div>

      <div className="stats-main-grid">
        <article className="stats-card monthly-card">
          <div className="stats-card-heading"><div><p className="eyebrow">Season at a glance</p><h3>Nights by month</h3></div><BarChart3 /></div>
          <div className="month-bar-chart">
            {yearStats.monthlyNights.map((nights, index) => (
              <div className="month-bar-column" key={monthLabels[index]}><span>{nights || ''}</span><div><i style={{ height: `${Math.max(nights ? (nights / maxMonthlyNights) * 100 : 3, 3)}%` }} /></div><small>{monthLabels[index]}</small></div>
            ))}
          </div>
          {!yearStats.trips && <p className="stats-empty-note">No trips are recorded for {year} yet.</p>}
        </article>

        <article className="stats-card home-base-card">
          <div className="stats-card-heading"><div><p className="eyebrow">Distance records</p><h3>Home base</h3></div><Navigation /></div>
          <label className="field"><span>Home base name</span><input value={homeDraft.name} onChange={(event) => setHomeDraft({ ...homeDraft, name: event.target.value })} /></label>
          <div className="form-grid home-coordinate-grid">
            <label className="field"><span>Latitude</span><input type="number" step="any" value={homeDraft.latitude} onChange={(event) => setHomeDraft({ ...homeDraft, latitude: Number(event.target.value) })} /></label>
            <label className="field"><span>Longitude</span><input type="number" step="any" value={homeDraft.longitude} onChange={(event) => setHomeDraft({ ...homeDraft, longitude: Number(event.target.value) })} /></label>
          </div>
          <div className="button-row"><button className="secondary-button" onClick={useCurrentLocation}><LocateFixed size={17} /> {locating ? 'Locating…' : 'Use current location'}</button><button className="primary-button" onClick={() => onSaveHomeBase(homeDraft)}>Save home base</button></div>
          <p className="home-base-help">Distance records use straight-line mileage from this location, so they are useful for comparisons but will be shorter than driving distance.</p>
        </article>
      </div>

      <div className="stats-section-heading"><div><p className="eyebrow">All-time records</p><h3>Your camping record book</h3></div></div>
      <div className="record-card-grid">
        <article className="record-card"><span className="record-icon"><TentTree /></span><div><small>Most-stayed campsite</small><strong>{siteLabel(records.mostStayedSite?.location)}</strong><p>{records.mostStayedSite ? `${records.mostStayedSite.stays.length} stays · ${records.mostStayedSite.stays.reduce((sum, stay) => sum + stay.nights, 0)} nights` : 'No trips yet'}</p></div></article>
        <article className="record-card"><span className="record-icon"><MapPin /></span><div><small>Most-visited park</small><strong>{parkLabel(records.mostVisitedPark?.location)}</strong><p>{records.mostVisitedPark ? `${records.mostVisitedPark.stays.length} stays · ${records.mostVisitedPark.stays.reduce((sum, stay) => sum + stay.nights, 0)} nights` : 'No trips yet'}</p></div></article>
        <article className="record-card"><span className="record-icon"><Trophy /></span><div><small>Favorite park by rating</small><strong>{parkLabel(records.favoritePark?.group.location)}</strong><p>{records.favoritePark ? `${formatScore(records.favoritePark.score)} average site score` : 'Rate more campsites to unlock'}</p></div></article>
        <article className="record-card"><span className="record-icon"><Navigation /></span><div><small>Farthest destination</small><strong>{siteLabel(records.furthestStay?.location)}</strong><p>{hasFurthestDestination && records.furthestStay ? `${Math.round(records.furthestStay.distance).toLocaleString()} miles from ${homeBase.name}` : 'No destination coordinates yet'}</p></div></article>
        <article className="record-card"><span className="record-icon"><Truck /></span><div><small>Most-used camper</small><strong>{records.topCamper?.name ?? 'No camper assigned'}</strong><p>{records.topCamperStays.length ? `${records.topCamperStays.length} trips · ${records.topCamperStays.reduce((sum, stay) => sum + stay.nights, 0)} nights` : 'Assign campers to trips to unlock'}</p></div></article>
        <article className="record-card"><span className="record-icon"><Moon /></span><div><small>Longest trip</small><strong>{records.longestStay ? `${records.longestStay.nights} nights at ${siteLabel(locationForStay(records.longestStay, sites))}` : 'No trips yet'}</strong><p>{records.longestStay ? `${formatDate(records.longestStay.arrivalDate)} – ${formatDate(records.longestStay.departureDate)}` : ''}</p></div></article>
      </div>

      <div className="lifetime-strip">
        <div><strong>{stays.length}</strong><span>lifetime trips</span></div>
        <div><strong>{records.totalNights}</strong><span>lifetime nights</span></div>
        <div><strong>{currency(records.totalCost)}</strong><span>recorded campsite cost</span></div>
        <div><strong>{currency(records.averageNightlyCost)}</strong><span>average nightly cost</span></div>
      </div>
    </section>
  );
}
