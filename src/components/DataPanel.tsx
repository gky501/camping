import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Cloud, Database, Download, FileJson, HardDrive, ShieldCheck, Upload, XCircle } from 'lucide-react';
import type { AppState } from '../types';

interface DataPanelProps {
  state: AppState;
  mode: 'cloud' | 'local';
}

interface BackupSummary {
  sites: number;
  stays: number;
  profiles: number;
  parks: number;
  campers: number;
}

function backupSummary(state: AppState): BackupSummary {
  return {
    sites: state.sites?.length ?? 0,
    stays: state.stays?.length ?? 0,
    profiles: state.profiles?.length ?? 0,
    parks: state.parks?.length ?? 0,
    campers: state.campers?.length ?? 0,
  };
}

function looksLikeBackup(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<AppState>;
  return Array.isArray(state.sites) && Array.isArray(state.stays) && Array.isArray(state.profiles);
}

export function DataPanel({ state, mode }: DataPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<AppState>();
  const [fileName, setFileName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const currentSummary = useMemo(() => backupSummary(state), [state]);
  const selectedSummary = useMemo(() => backup ? backupSummary(backup) : undefined, [backup]);

  function downloadBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `camp-ledger-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function chooseFile(file?: File) {
    setMessage('');
    setError('');
    setBackup(undefined);
    setFileName(file?.name ?? '');
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!looksLikeBackup(parsed)) throw new Error('That file does not look like a Camp Ledger backup.');
      setBackup(parsed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to read that backup file.');
    }
  }

  async function restoreToCloud() {
    if (!backup || importing) return;
    if (!window.confirm('Import this backup into the new Cloudflare D1 database? The importer only works while that database is empty. Your downloaded backup file will not be changed.')) return;
    setImporting(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/data/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backup),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || `Import failed with status ${response.status}.`);
      setMessage('Backup imported to D1. Reloading Camp Ledger from the cloud…');
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to import the backup.');
      setImporting(false);
    }
  }

  return (
    <section className="content-page data-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Backup and storage</p>
          <h2>Your data</h2>
          <p>Download a complete copy of Camp Ledger or import one of your JSON backups into a new, empty Cloudflare D1 database.</p>
        </div>
      </div>

      <div className={`storage-status-card ${mode}`}>
        <span className="storage-status-icon">{mode === 'cloud' ? <Cloud /> : <HardDrive />}</span>
        <div>
          <p className="eyebrow">Current storage</p>
          <h3>{mode === 'cloud' ? 'Cloudflare D1' : 'This browser only'}</h3>
          <p>{mode === 'cloud' ? 'Camp Ledger loaded successfully from the database bound as DB.' : 'Your current entries are still in this browser. Keep your downloaded backups until the cloud import is complete.'}</p>
        </div>
        <span className={`storage-state-pill ${mode}`}>{mode === 'cloud' ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}{mode === 'cloud' ? 'Cloud connected' : 'Backups required'}</span>
      </div>

      <div className="data-tool-grid">
        <article className="data-tool-card">
          <div className="data-tool-heading"><span><Download /></span><div><h3>Download another backup</h3><p>Saves parks, campsites, trips, ratings, campers, wish-list items, and preferences as one JSON file.</p></div></div>
          <div className="backup-count-grid">
            <span><strong>{currentSummary.stays}</strong> trips</span>
            <span><strong>{currentSummary.sites}</strong> sites</span>
            <span><strong>{currentSummary.campers}</strong> campers</span>
          </div>
          <button type="button" className="primary-button" onClick={downloadBackup}><Download size={17} /> Download current data</button>
        </article>

        <article className="data-tool-card restore-card">
          <div className="data-tool-heading"><span><Database /></span><div><h3>Import a backup to D1</h3><p>Select one of the files you already downloaded. Nothing is uploaded until you press Import.</p></div></div>
          <input ref={inputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void chooseFile(event.target.files?.[0])} />
          <button type="button" className="backup-file-picker" onClick={() => inputRef.current?.click()}>
            <FileJson size={24} />
            <span><strong>{fileName || 'Choose a Camp Ledger backup'}</strong><small>JSON files only</small></span>
            <Upload size={19} />
          </button>

          {selectedSummary && (
            <div className="selected-backup-summary">
              <div><CheckCircle2 size={19} /><strong>Backup is readable</strong></div>
              <div className="backup-count-grid">
                <span><strong>{selectedSummary.stays}</strong> trips</span>
                <span><strong>{selectedSummary.sites}</strong> sites</span>
                <span><strong>{selectedSummary.parks}</strong> parks</span>
                <span><strong>{selectedSummary.campers}</strong> campers</span>
              </div>
            </div>
          )}

          {error && <div className="data-message error"><XCircle size={18} /> {error}</div>}
          {message && <div className="data-message success"><CheckCircle2 size={18} /> {message}</div>}

          <button type="button" className="primary-button" disabled={!backup || importing} onClick={() => void restoreToCloud()}>
            <Cloud size={17} /> {importing ? 'Importing…' : 'Import backup to cloud'}
          </button>
          <p className="restore-warning">The one-time importer refuses to overwrite a D1 database that already contains Camp Ledger data. Your downloaded backup remains unchanged.</p>
        </article>
      </div>
    </section>
  );
}
