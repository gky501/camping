import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Campsite, PreferenceProfile, Stay } from '../types';
import { calculateOverall } from '../lib/scoring';
import { SiteCard } from './SiteCard';

export function CampsitesPanel({ sites, stays, profile, onSelect, onLogStay }: {
  sites: Campsite[];
  stays: Stay[];
  profile: PreferenceProfile;
  onSelect: (site: Campsite) => void;
  onLogStay: (site: Campsite) => void;
}) {
  const [search, setSearch] = useState('');
  const sorted = useMemo(() => {
    const query = search.toLowerCase().trim();
    return sites
      .filter((site) => !query || `${site.park} ${site.state} ${site.loop} ${site.siteNumber} ${site.notes}`.toLowerCase().includes(query))
      .sort((a, b) => (calculateOverall(b, profile) ?? -1) - (calculateOverall(a, profile) ?? -1));
  }, [profile, search, sites]);

  return (
    <section className="content-page">
      <div className="page-heading"><div><p className="eyebrow">Site catalog</p><h2>All campsites</h2><p>Current physical information and personalized scores, separate from each dated stay.</p></div></div>
      <label className="search-field page-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search all campsites" /></label>
      <div className="card-grid">
        {sorted.map((site) => <SiteCard key={site.id} site={site} profile={profile} stays={stays} onSelect={() => onSelect(site)} onLogStay={() => onLogStay(site)} />)}
      </div>
    </section>
  );
}
