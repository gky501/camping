import { useMemo, useState } from 'react';
import { Bookmark, MapPin, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Campsite, PreferenceProfile, Stay } from '../types';
import { SiteCard } from './SiteCard';

export function WishlistPanel({ sites, stays, profile, onSelect, onLogStay, onAdd, onEdit, onDelete }: {
  sites: Campsite[];
  stays: Stay[];
  profile: PreferenceProfile;
  onSelect: (site: Campsite) => void;
  onLogStay: (site: Campsite) => void;
  onAdd: () => void;
  onEdit: (site: Campsite) => void;
  onDelete: (site: Campsite) => void;
}) {
  const [search, setSearch] = useState('');
  const wishlist = useMemo(() => {
    const query = search.toLowerCase().trim();
    return sites
      .filter((site) => site.status === 'wishlist')
      .filter((site) => !query || `${site.park} ${site.state} ${site.area ?? ''} ${site.loop} ${site.siteNumber} ${site.notes}`.toLowerCase().includes(query))
      .sort((a, b) => a.park.localeCompare(b.park) || a.siteNumber.localeCompare(b.siteNumber));
  }, [search, sites]);

  const campgroundCount = new Set(wishlist.map((site) => `${site.park.trim().toLowerCase()}::${site.state.trim().toLowerCase()}`)).size;

  return (
    <section className="content-page wishlist-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Where to next?</p>
          <h2>Wish list</h2>
          <p>Save the campsites that catch your eye, compare the details, and turn one into your next stay when the time is right.</p>
        </div>
        <button className="primary-button" onClick={onAdd}><Plus size={18} /> Add wish-list site</button>
      </div>

      <div className="summary-grid wishlist-summary">
        <div className="summary-card"><Bookmark /><div><strong>{wishlist.length}</strong><span>places waiting to be explored</span></div></div>
        <div className="summary-card"><MapPin /><div><strong>{campgroundCount}</strong><span>campgrounds on your radar</span></div></div>
      </div>

      <label className="search-field page-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search parks, sites, notes, or amenities" /></label>

      {wishlist.length > 0 ? (
        <div className="wishlist-card-grid">
          {wishlist.map((site) => (
            <div className="wishlist-card" key={site.id}>
              <SiteCard site={site} profile={profile} stays={stays} actionLabel="Add stay" onSelect={() => onSelect(site)} onLogStay={() => onLogStay(site)} />
              <details className="wishlist-card-menu-wrap">
                <summary className="wishlist-card-menu-button" aria-label={`More actions for ${site.park}`}><MoreHorizontal size={20} /></summary>
                <div className="wishlist-card-menu">
                  <button type="button" onClick={() => onEdit(site)}><Pencil size={16} /> Edit site</button>
                  <button type="button" className="danger" onClick={() => onDelete(site)}><Trash2 size={16} /> Delete</button>
                </div>
              </details>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state"><Bookmark size={42} /><h3>No wish-list sites found</h3><p>Save a campsite you want to try and it will be ready when you start planning the next trip.</p><button className="primary-button" onClick={onAdd}><Plus size={18} /> Add a site</button></div>
      )}
    </section>
  );
}
