import { useEffect, useState, type FormEvent } from 'react';
import { Copy, Download, KeyRound, ShieldCheck, Trash2, UserRound, Users, X } from 'lucide-react';
import { useAuth, type AuthUser } from './AuthGate';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
  return payload;
}

function downloadCode(code: string, displayName: string) {
  const blob = new Blob([
    `CAMP LEDGER RECOVERY CODE — ${displayName.toUpperCase()}\n\n`,
    `${code}\n\n`,
    'This code replaces the previous recovery code for this account. Store it privately.\n',
  ], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `camp-ledger-${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-recovery-code.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminAccountsLauncher() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [resetTarget, setResetTarget] = useState<AuthUser>();
  const [deleteTarget, setDeleteTarget] = useState<AuthUser>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<{ displayName: string; code: string }>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || user.role !== 'admin') return;
    setMessage('');
    requestJson<{ users: AuthUser[] }>('/api/auth/users')
      .then((result) => setUsers(result.users))
      .catch((cause) => setMessage(cause instanceof Error ? cause.message : 'Unable to load accounts.'));
  }, [open, user.role]);

  if (user.role !== 'admin') return null;

  function close() {
    setOpen(false);
    setResetTarget(undefined);
    setDeleteTarget(undefined);
    setRecovery(undefined);
    setPassword('');
    setConfirmPassword('');
    setMessage('');
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    if (!resetTarget) return;
    if (password !== confirmPassword) { setMessage('The passwords do not match.'); return; }
    setBusy(true); setMessage('');
    try {
      const result = await requestJson<{ recoveryCode: string; displayName: string }>('/api/auth/admin-users', {
        method: 'PUT',
        body: JSON.stringify({ userId: resetTarget.id, password }),
      });
      setPassword(''); setConfirmPassword(''); setResetTarget(undefined);
      setRecovery({ displayName: result.displayName, code: result.recoveryCode });
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Unable to reset the password.');
    } finally { setBusy(false); }
  }

  async function deleteAccount() {
    if (!deleteTarget) return;
    setBusy(true); setMessage('');
    try {
      const result = await requestJson<{ users: AuthUser[] }>('/api/auth/admin-users', {
        method: 'DELETE',
        body: JSON.stringify({ userId: deleteTarget.id }),
      });
      setUsers(result.users); setDeleteTarget(undefined);
      setMessage('Account deleted. Its active sessions were also removed.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Unable to delete the account.');
    } finally { setBusy(false); }
  }

  async function copyRecovery() {
    if (!recovery) return;
    await navigator.clipboard.writeText(recovery.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <>
      <button className="admin-accounts-launcher" type="button" onClick={() => setOpen(true)} title="Manage household accounts"><Users size={19} /></button>
      {open && <div className="modal-backdrop admin-accounts-backdrop" role="presentation" onMouseDown={close}>
        <div className="modal-card admin-accounts-modal" role="dialog" aria-modal="true" aria-labelledby="admin-accounts-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-header"><div><p className="eyebrow">Administrator</p><h2 id="admin-accounts-title">Household accounts</h2><p>Reset passwords, revoke sessions, or remove an account that should no longer have access.</p></div><button className="icon-button" onClick={close} aria-label="Close"><X /></button></div>

          {recovery ? <section className="admin-recovery-card">
            <ShieldCheck />
            <div><p className="eyebrow">Password reset complete</p><h3>Save {recovery.displayName}'s new recovery code</h3><p>The old password, recovery code, and signed-in sessions no longer work.</p></div>
            <code>{recovery.code}</code>
            <div className="admin-recovery-actions"><button className="secondary-button" onClick={() => void copyRecovery()}><Copy size={17} /> {copied ? 'Copied' : 'Copy'}</button><button className="secondary-button" onClick={() => downloadCode(recovery.code, recovery.displayName)}><Download size={17} /> Download</button><button className="primary-button" onClick={() => setRecovery(undefined)}>Saved</button></div>
          </section> : <>
            <div className="admin-account-list">
              {users.map((account) => <article className="admin-account-row" key={account.id}>
                <span className="admin-account-avatar"><UserRound /></span>
                <div><strong>{account.displayName}</strong><p>@{account.username} · {account.role === 'admin' ? 'Administrator' : 'Household member'}{account.id === user.id ? ' · You' : ''}</p></div>
                {account.id !== user.id && <div className="admin-account-actions"><button className="secondary-button" onClick={() => { setResetTarget(account); setDeleteTarget(undefined); setMessage(''); }}><KeyRound size={16} /> Reset password</button><button className="danger-button" onClick={() => { setDeleteTarget(account); setResetTarget(undefined); setMessage(''); }}><Trash2 size={16} /> Delete</button></div>}
              </article>)}
            </div>

            {resetTarget && <form className="admin-account-action-card" onSubmit={resetPassword}>
              <div><p className="eyebrow">Reset access</p><h3>Set a new password for {resetTarget.displayName}</h3><p>This immediately signs the account out everywhere and creates a new personal recovery code.</p></div>
              <div className="form-grid"><label className="field"><span>New password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} autoComplete="new-password" required /></label><label className="field"><span>Confirm password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={12} autoComplete="new-password" required /></label></div>
              <div className="button-row"><button type="button" className="secondary-button" onClick={() => setResetTarget(undefined)}>Cancel</button><button type="submit" className="primary-button" disabled={busy}><KeyRound size={16} /> Reset password</button></div>
            </form>}

            {deleteTarget && <section className="admin-account-action-card danger-zone-card">
              <div><p className="eyebrow">Permanent removal</p><h3>Delete {deleteTarget.displayName}'s account?</h3><p>This removes the login and all active sessions. Camping trips and shared Camp Ledger data are not deleted.</p></div>
              <div className="button-row"><button className="secondary-button" onClick={() => setDeleteTarget(undefined)}>Cancel</button><button className="danger-button" disabled={busy} onClick={() => void deleteAccount()}><Trash2 size={16} /> Delete account</button></div>
            </section>}
          </>}

          {message && <p className="auth-form-message">{message}</p>}
          {!recovery && <div className="modal-actions"><span className="modal-action-spacer" /><button className="primary-button" onClick={close}>Done</button></div>}
        </div>
      </div>}
    </>
  );
}
