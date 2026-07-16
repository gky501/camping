import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BadgeCheck,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Compass,
  Flame,
  MapPin,
  Moon,
  Package,
  Route,
  ShieldCheck,
  Sparkles,
  Star,
  TentTree,
  Trophy,
  Trees,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { distanceMiles } from '../lib/geo';
import { loadCamperMaintenance, maintenanceTiming, type CamperMaintenanceMap } from '../lib/camperMaintenance';
import type { AppState, Campsite, HomeBase, Stay } from '../types';

const STORAGE_KEY = 'camp-ledger-state-v2-wishlist-only';

interface CampingAchievementsProps {
  sites: Campsite[];
  stays: Stay[];
  homeBase: HomeBase;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  unit: string;
  icon: LucideIcon;
}

function locationForStay(stay: Stay, sites: Campsite[]) {
  return stay.siteSnapshot ?? sites.find((site) => site.id === stay.siteId);
}

function parkKey(park: string, state: string): string {
  return `${park.trim().toLowerCase()}::${state.trim().toLowerCase()}`;
}

function seasonForMonth(month: number): string {
  if (month === 11 || month <= 1) return 'winter';
  if (month <= 4) return 'spring';
  if (month <= 7) return 'summer';
  return 'fall';
}

function longestYearStreak(years: number[]): number {
  const unique = [...new Set(years)].sort((a, b) => a - b);
  let longest = unique.length ? 1 : 0;
  let current = longest;
  for (let index = 1; index < unique.length; index += 1) {
    current = unique[index] === unique[index - 1] + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

function metricLabel(value: number, unit: string): string {
  if (unit === 'miles') return `${Math.round(value).toLocaleString()} miles`;
  if (unit === 'year streak') return `${value} ${value === 1 ? 'year' : 'years'} in a row`;
  if (unit === 'ready status') return value ? 'Ready' : 'Not ready';
  return `${value.toLocaleString()} ${unit}`;
}

function readTrackedState(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as AppState : {};
  } catch {
    return {};
  }
}

export function CampingAchievements({ sites, stays, homeBase }: CampingAchievementsProps) {
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [maintenance, setMaintenance] = useState<CamperMaintenanceMap>({});
  const today = new Date().toISOString().slice(0, 10);
  const completed = useMemo(() => stays.filter((stay) => stay.departureDate <= today), [stays, today]);

  useEffect(() => {
    loadCamperMaintenance().then(setMaintenance).catch(() => setMaintenance({}));
  }, []);

  const analytics = useMemo(() => {
    const tracked = readTrackedState();
    const parks = new Map<string, { label: string; trips: number; nights: number }>();
    const states = new Set<string>();
    const seasons = new Set<string>();
    const years = new Map<number, number>();
    const camperTrips = new Map<string, number>();
    let totalNights = 0;
    let weekendTrips = 0;
    let longestTrip = 0;
    let farthestMiles = 0;
    let journalEntries = 0;
    let ratedTrips = 0;

    for (const stay of completed) {
      totalNights += stay.nights;
      longestTrip = Math.max(longestTrip, stay.nights);
      if (stay.journal.trim()) journalEntries += 1;
      if (Object.keys(stay.observations ?? {}).length > 0) ratedTrips += 1;
      if (stay.camperId) camperTrips.set(stay.camperId, (camperTrips.get(stay.camperId) ?? 0) + 1);

      const arrival = new Date(`${stay.arrivalDate}T12:00:00`);
      if (!Number.isNaN(arrival.getTime())) {
        if (arrival.getDay() === 5 || arrival.getDay() === 6) weekendTrips += 1;
        seasons.add(seasonForMonth(arrival.getMonth()));
        years.set(arrival.getFullYear(), (years.get(arrival.getFullYear()) ?? 0) + 1);
      }

      const location = locationForStay(stay, sites);
      if (!location) continue;
      const key = parkKey(location.park, location.state);
      const park = parks.get(key) ?? { label: `${location.park}, ${location.state}`, trips: 0, nights: 0 };
      park.trips += 1;
      park.nights += stay.nights;
      parks.set(key, park);
      states.add(location.state);
      if (Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
        farthestMiles = Math.max(farthestMiles, distanceMiles(homeBase, location));
      }
    }

    const templateItemCount = (tracked.checklistTemplate?.sections ?? []).reduce((sum, section) => sum + section.items.length, 0);
    const completedChecklistCount = (tracked.tripChecklists ?? []).filter((checklist) => {
      const stay = completed.find((item) => item.id === checklist.stayId);
      if (!stay) return false;
      const customCount = checklist.customSections.reduce((sum, section) => sum + section.items.length, 0);
      const total = templateItemCount + customCount;
      return total > 0 && checklist.checkedItemIds.length >= total;
    }).length;

    const equipmentLogs = (tracked.equipmentInventory?.items ?? []).flatMap((item) => item.log ?? []);
    const equipmentServiceCount = equipmentLogs.filter((entry) => ['serviced', 'repaired', 'cleaned', 'inspected'].includes(entry.action)).length;
    const equipmentReplacementCount = equipmentLogs.filter((entry) => entry.action === 'replaced').length;
    const equipmentReady = (tracked.equipmentInventory?.items?.length ?? 0) > 0
      && (tracked.equipmentInventory?.items ?? []).every((item) => item.condition !== 'replace');

    const activeMaintenance = Object.values(maintenance).filter((record) => record.active);
    const maintenanceReminders = activeMaintenance.flatMap((record) => record.maintenance);
    const maintenanceActions = maintenanceReminders.filter((reminder) => Boolean(reminder.lastCompletedDate)).length;
    const scheduledMaintenance = maintenanceReminders.filter((reminder) => Boolean(reminder.lastCompletedDate));
    const maintenanceReady = scheduledMaintenance.length > 0
      && scheduledMaintenance.every((reminder) => maintenanceTiming(reminder) !== 'overdue' && reminder.condition !== 'attention');

    const yearlyTrips = [...years.entries()].sort((a, b) => a[0] - b[0]).slice(-8).map(([year, trips]) => ({ year, trips }));
    const topParks = [...parks.values()].sort((a, b) => b.trips - a.trips || b.nights - a.nights).slice(0, 5);
    const repeatParkMax = Math.max(...[...parks.values()].map((park) => park.trips), 0);
    const yearStreak = longestYearStreak([...years.keys()]);
    const tripLengths = [
      { label: '1 night', count: completed.filter((stay) => stay.nights === 1).length },
      { label: '2 nights', count: completed.filter((stay) => stay.nights === 2).length },
      { label: '3–4 nights', count: completed.filter((stay) => stay.nights >= 3 && stay.nights <= 4).length },
      { label: '5–6 nights', count: completed.filter((stay) => stay.nights >= 5 && stay.nights <= 6).length },
      { label: '7+ nights', count: completed.filter((stay) => stay.nights >= 7).length },
    ];

    return {
      tripCount: completed.length,
      totalNights,
      parkCount: parks.size,
      stateCount: states.size,
      seasonCount: seasons.size,
      weekendTrips,
      longestTrip,
      farthestMiles,
      repeatParkMax,
      yearStreak,
      yearlyTrips,
      topParks,
      tripLengths,
      journalEntries,
      ratedTrips,
      distinctCampers: camperTrips.size,
      mostUsedCamperTrips: Math.max(...camperTrips.values(), 0),
      completedChecklistCount,
      equipmentServiceCount,
      equipmentReplacementCount,
      equipmentReady: Number(equipmentReady),
      maintenanceActions,
      maintenanceReady: Number(maintenanceReady),
    };
  }, [completed, homeBase, maintenance, sites]);

  const achievements: Achievement[] = [
    { id: 'first-stamp', title: 'First Stamp', description: 'Complete your first camping trip.', current: analytics.tripCount, target: 1, unit: 'trips', icon: BadgeCheck },
    { id: 'trail-regular', title: 'Trail Regular', description: 'Complete five camping trips.', current: analytics.tripCount, target: 5, unit: 'trips', icon: Route },
    { id: 'seasoned-camper', title: 'Seasoned Camper', description: 'Complete fifteen camping trips.', current: analytics.tripCount, target: 15, unit: 'trips', icon: Trophy },
    { id: 'night-owl', title: 'Night Owl', description: 'Spend ten nights camping.', current: analytics.totalNights, target: 10, unit: 'nights', icon: Moon },
    { id: 'campfire-veteran', title: 'Campfire Veteran', description: 'Spend fifty nights camping.', current: analytics.totalNights, target: 50, unit: 'nights', icon: Flame },
    { id: 'century-club', title: 'Century Club', description: 'Reach one hundred lifetime camping nights.', current: analytics.totalNights, target: 100, unit: 'nights', icon: Star },
    { id: 'park-hopper', title: 'Park Hopper', description: 'Camp at five different parks.', current: analytics.parkCount, target: 5, unit: 'parks', icon: Trees },
    { id: 'state-explorer', title: 'State Explorer', description: 'Camp in three different states.', current: analytics.stateCount, target: 3, unit: 'states', icon: Compass },
    { id: 'home-away', title: 'Home Away From Home', description: 'Return to the same park three times.', current: analytics.repeatParkMax, target: 3, unit: 'visits', icon: TentTree },
    { id: 'weekend-warrior', title: 'Weekend Warrior', description: 'Start five trips on a Friday or Saturday.', current: analytics.weekendTrips, target: 5, unit: 'weekend trips', icon: CalendarRange },
    { id: 'settle-in', title: 'Settle In', description: 'Complete a trip lasting at least seven nights.', current: analytics.longestTrip, target: 7, unit: 'nights', icon: Sparkles },
    { id: 'four-seasons', title: 'Four-Season Camper', description: 'Camp during winter, spring, summer, and fall.', current: analytics.seasonCount, target: 4, unit: 'seasons', icon: Award },
    { id: 'long-haul', title: 'Long Haul', description: `Camp at least 250 miles from ${homeBase.name}.`, current: Math.round(analytics.farthestMiles), target: 250, unit: 'miles', icon: MapPin },
    { id: 'year-after-year', title: 'Year After Year', description: 'Complete trips in three consecutive years.', current: analytics.yearStreak, target: 3, unit: 'year streak', icon: CalendarRange },
    { id: 'ready-to-roll', title: 'Ready to Roll', description: 'Complete every item on a trip checklist.', current: analytics.completedChecklistCount, target: 1, unit: 'completed checklists', icon: ClipboardCheck },
    { id: 'checklist-champion', title: 'Checklist Champion', description: 'Finish ten complete trip checklists.', current: analytics.completedChecklistCount, target: 10, unit: 'completed checklists', icon: CheckCircle2 },
    { id: 'gear-keeper', title: 'Gear Keeper', description: 'Log five equipment service, repair, cleaning, or inspection activities.', current: analytics.equipmentServiceCount, target: 5, unit: 'gear activities', icon: Package },
    { id: 'fresh-start', title: 'Fresh Start', description: 'Record your first equipment replacement.', current: analytics.equipmentReplacementCount, target: 1, unit: 'replacements', icon: Sparkles },
    { id: 'packed-and-ready', title: 'Packed & Ready', description: 'Keep every tracked equipment item out of Needs replaced status.', current: analytics.equipmentReady, target: 1, unit: 'ready status', icon: ShieldCheck },
    { id: 'maintenance-minder', title: 'Maintenance Minder', description: 'Complete five camper maintenance reminders.', current: analytics.maintenanceActions, target: 5, unit: 'maintenance actions', icon: Wrench },
    { id: 'road-ready', title: 'Road Ready', description: 'Have active scheduled camper maintenance current with nothing overdue or needing attention.', current: analytics.maintenanceReady, target: 1, unit: 'ready status', icon: ShieldCheck },
    { id: 'camper-explorer', title: 'Camper Explorer', description: 'Complete trips using two different campers or setups.', current: analytics.distinctCampers, target: 2, unit: 'campers', icon: Truck },
    { id: 'camper-loyalist', title: 'Camper Loyalist', description: 'Complete ten trips with the same camper.', current: analytics.mostUsedCamperTrips, target: 10, unit: 'trips', icon: Truck },
    { id: 'story-keeper', title: 'Story Keeper', description: 'Write journal notes for ten completed trips.', current: analytics.journalEntries, target: 10, unit: 'journal entries', icon: BookOpen },
    { id: 'site-scout', title: 'Site Scout', description: 'Record campsite observations on ten completed trips.', current: analytics.ratedTrips, target: 10, unit: 'rated trips', icon: Compass },
  ];

  const scoredAchievements = achievements.map((achievement) => ({
    ...achievement,
    earned: achievement.current >= achievement.target,
    progress: Math.min(100, Math.round((achievement.current / achievement.target) * 100)),
  }));
  const earnedCount = scoredAchievements.filter((achievement) => achievement.earned).length;
  const completion = Math.round((earnedCount / scoredAchievements.length) * 100);
  const nextBadge = scoredAchievements.filter((achievement) => !achievement.earned).sort((a, b) => b.progress - a.progress)[0];
  const sortedBadges = [...scoredAchievements].sort((a, b) => Number(b.earned) - Number(a.earned) || b.progress - a.progress);
  const visibleBadges = showAllBadges ? sortedBadges : sortedBadges.slice(0, 8);
  const maxYearTrips = Math.max(...analytics.yearlyTrips.map((entry) => entry.trips), 1);
  const maxLengthCount = Math.max(...analytics.tripLengths.map((entry) => entry.count), 1);
  const maxParkTrips = Math.max(...analytics.topParks.map((entry) => entry.trips), 1);

  return (
    <>
      <div className="stats-section-heading achievement-section-heading"><div><p className="eyebrow">Automatically earned from your Camp Ledger activity</p><h3>Camping achievements</h3></div></div>
      <div className="achievement-summary-grid">
        <article><span><Trophy /></span><div><strong>{earnedCount} of {scoredAchievements.length}</strong><small>badges earned</small></div></article>
        <article><span><Sparkles /></span><div><strong>{completion}%</strong><small>achievement collection complete</small></div></article>
        <article><span><Award /></span><div><strong>{nextBadge?.title ?? 'Collection complete'}</strong><small>{nextBadge ? `${metricLabel(nextBadge.current, nextBadge.unit)} · ${nextBadge.target - nextBadge.current} to go` : 'Every current badge has been earned'}</small></div></article>
      </div>

      <div className="achievement-grid">
        {visibleBadges.map((achievement) => {
          const Icon = achievement.icon;
          return <article className={achievement.earned ? 'achievement-card earned' : 'achievement-card'} key={achievement.id}>
            <div className="achievement-card-top"><span className="achievement-icon"><Icon /></span><span className="achievement-status">{achievement.earned ? <><BadgeCheck size={15} /> Earned</> : `${achievement.progress}%`}</span></div>
            <h4>{achievement.title}</h4>
            <p>{achievement.description}</p>
            <div className="achievement-progress"><i style={{ width: `${achievement.progress}%` }} /></div>
            <small>{achievement.earned ? metricLabel(achievement.current, achievement.unit) : `${metricLabel(achievement.current, achievement.unit)} of ${metricLabel(achievement.target, achievement.unit)}`}</small>
          </article>;
        })}
      </div>
      {sortedBadges.length > 8 && <button className="secondary-button achievement-show-all" onClick={() => setShowAllBadges((current) => !current)}>{showAllBadges ? <ChevronUp size={17} /> : <ChevronDown size={17} />} {showAllBadges ? 'Show fewer badges' : `Show all ${sortedBadges.length} badges`}</button>}

      <div className="stats-section-heading camping-chart-heading"><div><p className="eyebrow">More ways to see your camping history</p><h3>Lifetime charts</h3></div></div>
      <div className="camping-chart-grid">
        <article className="stats-card compact-chart-card">
          <div className="stats-card-heading"><div><p className="eyebrow">Growth over time</p><h3>Trips by year</h3></div><CalendarRange /></div>
          {analytics.yearlyTrips.length ? <div className="year-trip-chart">{analytics.yearlyTrips.map((entry) => <div key={entry.year}><strong>{entry.trips}</strong><span><i style={{ height: `${Math.max(8, (entry.trips / maxYearTrips) * 100)}%` }} /></span><small>{entry.year}</small></div>)}</div> : <p className="stats-empty-note">Complete a trip to begin this chart.</p>}
        </article>

        <article className="stats-card compact-chart-card">
          <div className="stats-card-heading"><div><p className="eyebrow">How long you stay</p><h3>Trip lengths</h3></div><Moon /></div>
          <div className="compact-horizontal-chart">{analytics.tripLengths.map((entry) => <div className="compact-horizontal-row" key={entry.label}><span>{entry.label}</span><div><i style={{ width: `${(entry.count / maxLengthCount) * 100}%` }} /></div><strong>{entry.count}</strong></div>)}</div>
        </article>

        <article className="stats-card compact-chart-card top-parks-chart-card">
          <div className="stats-card-heading"><div><p className="eyebrow">Where you return</p><h3>Most-visited parks</h3></div><Trees /></div>
          {analytics.topParks.length ? <div className="compact-horizontal-chart park-rank-chart">{analytics.topParks.map((entry, index) => <div className="park-rank-row" key={entry.label}><span className="park-rank-number">{index + 1}</span><div className="park-rank-copy"><strong>{entry.label}</strong><small>{entry.trips} trips · {entry.nights} nights</small><div><i style={{ width: `${(entry.trips / maxParkTrips) * 100}%` }} /></div></div></div>)}</div> : <p className="stats-empty-note">Complete a trip to begin ranking parks.</p>}
        </article>
      </div>
    </>
  );
}
