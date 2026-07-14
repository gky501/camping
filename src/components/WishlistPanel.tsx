import { useMemo, useState } from 'react';
import { Bookmark, MapPin, Plus, Search } from 'lucide-react';
import type { Campsite, PreferenceProfile, Stay } from '../types';
import { SiteCard } from './SiteCard';

export function WishlistPanel({ sites, stays, profile, onSelect, onLogStay, onAdd }: {
  sites: Campsite[];
  stays: Stay[];
  profile: PreferenceProfile;
  onSelect: (site: Campsite) => void;
  onLogStay: (site: Campsite) => void;
  onAdd: () => void;
}) {
  const [search, setSearch] = useState('');
  const wishlist = useMemo(() => {
    const query = search.toLowerCase().trim();
    return sites
      .filter((site) => site.status === 'wishlist')
      .filter((site) => !query || `${site.park} ${site.state} ${site.loop} ${site.siteNumber} ${site.notes}`.toLowerCase().includes(query))
      .sort((a, b) => a.park.localeCompare(b.park) || a.siteNumber.localeCompare(b.siteNumber));
  }, [search, sites]);

  return (
    <section className="content-page">
      <div className="page-heading">
        <div><p className="eyebrow">Places to try</p><h2>Wish list</h2><p>The gray “–” markers are campsites you saved but have not stayed at yet. Logging the first stay automatically moves a site into your camping history.</p></div>
        <button className="primary-button" onClick={onAdd}><Plus size={18} /> Add wish-list site</button>
      </div>
      <div className="summary-grid wishlist-summary">
        <div className="summary-card"><Bookmark /><div><strong>{wishlist.length}</strong><span>saved campsites</span></div></div>
        <div className="summary-card"><MapPin /><div><strong>{new Set(wishlist.map((site) => site.park)).size}</strong><span>campgrounds represented</span></div></div>
      </div>
      <label className="search-field page-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your wish list" /></label>
      {wishlist.length > 0 ? (
        <div className="card-grid">
          {wishlist.map((site) => <SiteCard key={site.id} site={site} profile={profile} stays={stays} onSelect={() => onSelect(site)} onLogStay={() => onLogStay(site)} />)}
        </div>
      ) : (
        <div className="empty-state"><Bookmark size={42} /><h3>No wish-list sites found</h3><p>Save a campsite you want to try, including its exact map coordinates, and it will appear as a gray marker.</p><button className="primary-button" onClick={onAdd}><Plus size={18} /> Add a site</button></div>
      )}
    </section>
  );
}
