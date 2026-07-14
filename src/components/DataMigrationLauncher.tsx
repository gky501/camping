import { useEffect, useState } from 'react';
import { Database, X } from 'lucide-react';
import type { AppState } from '../types';
import { DataPanel } from './DataPanel';

const STORAGE_KEY = 'camp-ledger-state-v2-wishlist-only';

function readBrowserState(): AppState | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as AppState : undefined;
  } catch {
    return undefined;
  }
}

export function DataMigrationLauncher() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AppState>();
  const [mode, setMode] = useState<'cloud' | 'local'>('local');

  useEffect(() => {
    if (!open) return;
    setState(readBrowserState());
    fetch('/api/bootstrap', { headers: { Accept: 'application/json' } })
      .then((response) => setMode(response.ok ? 'cloud' : 'local'))
      .catch(() => setMode('local'));
  }, [open]);

  return (
    <>
      <button type="button" className="data-launch-button" onClick={() => setOpen(true)} title="Back up or move Camp Ledger data to Cloudflare D1">
        <Database size={19} />
        <span>Data</span>
      </button>
      {open && (
        <div className="modal-backdrop data-modal-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <div className="modal-card data-modal" role="dialog" aria-modal="true" aria-labelledby="data-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><p className="eyebrow">Backup and cloud setup</p><h2 id="data-modal-title">Camp Ledger data</h2></div>
              <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Close"><X /></button>
            </div>
            {state ? <DataPanel state={state} mode={mode} /> : <div className="data-no-state"><Database size={38} /><h3>No browser dataset was found.</h3><p>Open Camp Ledger in the browser where your entries are visible, then open this Data screen again.</p></div>}
          </div>
        </div>
      )}
    </>
  );
}
