import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Copy, Download, KeyRound, LockKeyhole, LogOut, Plus, RefreshCw, ShieldCheck, TentTree, UserRound, Users, X } from 'lucide-react';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'member';
}

interface AuthContextValue {
  user: AuthUser;
  openAccount: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthGate.');
  return value;
}

interface AuthStatus {
  initialized: boolean;
  authenticated: boolean;
  user?: AuthUser;
}

interface RecoveryNotice {
  title: string;
  code: string;
  detail: string;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
  return payload;
}

function downloadRecoveryCode(code: string, label = 'camp-ledger-recovery-code'): void {
  const blob = new Blob([
    'CAMP LEDGER RECOVERY CODE\n\n',
    `${code}\n\n`,
    'Store this somewhere private. It can reset the account password and is replaced after it is used.\n',
  ], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${label}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function RecoveryCodeCard({ notice, onContinue }: { notice: RecoveryNotice; onContinue: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copyCode() {
    await navigator.clipboard.writeText(notice.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="auth-shell">
      <div className="auth-card recovery-code-card">
        <span className="auth-brand-mark"><ShieldCheck /></span>
        <p className="eyebrow">Account recovery</p>
        <h1>{notice.title}</h1>
        <p>{notice.detail}</p>
        <div className="recovery-code-value">{notice.code}</div>
        <div className="auth-action-row">
          <button className="secondary-button" type="button" onClick={() => void copyCode()}><Copy size={17} /> {copied ? 'Copied' : 'Copy code'}</button>
          <button className="secondary-button" type="button" onClick={() => downloadRecoveryCode(notice.code)}><Download size={17} /> Download</button>
        </div>
        <div className="auth-warning"><KeyRound /><p>This code is shown only now. The emergency master key remains a second way to recover access.</p></div>
        <button className="primary-button auth-wide-button" type="button" onClick={onContinue}>I saved the recovery code</button>
      </div>
    </div>
  );
}

function AccountModal({ user, onClose, onLogout, onRecoveryNotice }: {
  user: AuthUser;
  onClose: () => void;
  onLogout: () => void;
  onRecoveryNotice: (notice: RecoveryNotice) => void;
}) {
  const [currentValue, setCurrentValue] = useState('');
  const [nextValue, setNextValue] = useState('');
  const [confirmValue, setConfirmValue] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newCredential, setNewCredential] = useState('');
  const [newCredentialConfirm, setNewCredentialConfirm] = useState('');
  const [newAdmin, setNewAdmin] = useState(false);

  useEffect(() => {
    if (user.role !== 'admin') return;
    requestJson<{ users: AuthUser[] }>('/api/auth/users').then((result) => setUsers(result.users)).catch(() => undefined);
  }, [user.role]);

  async function changeCredential(event: FormEvent) {
    event.preventDefault();
    if (nextValue !== confirmValue) { setMessage('The new passwords do not match.'); return; }
    setBusy(true); setMessage('');
    try {
      await requestJson('/api/auth/manage', { method: 'POST', body: JSON.stringify({ oldValue: currentValue, newValue: nextValue }) });
      setCurrentValue(''); setNextValue(''); setConfirmValue(''); setMessage('Password updated. Other signed-in devices were logged out.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Unable to update the password.'); }
    finally { setBusy(false); }
  }

  async function rotateRecovery() {
    setBusy(true); setMessage('');
    try {
      const result = await requestJson<{ recoveryCode: string }>('/api/auth/recovery-key', { method: 'POST', body: '{}' });
      onClose();
      onRecoveryNotice({ title: 'New recovery code created', code: result.recoveryCode, detail: 'Your previous personal recovery code no longer works.' });
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Unable to create a new recovery code.'); }
    finally { setBusy(false); }
  }

  async function addHouseholdAccount(event: FormEvent) {
    event.preventDefault();
    if (newCredential !== newCredentialConfirm) { setMessage('The new account passwords do not match.'); return; }
    setBusy(true); setMessage('');
    try {
      const result = await requestJson<{ user: AuthUser; recoveryCode: string }>('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify({ username: newUsername, displayName: newDisplayName, password: newCredential, role: newAdmin ? 'admin' : 'member' }),
      });
      setUsers((current) => [...current, result.user]);
      setNewDisplayName(''); setNewUsername(''); setNewCredential(''); setNewCredentialConfirm(''); setNewAdmin(false);
      onClose();
      onRecoveryNotice({ title: `${result.user.displayName}'s recovery code`, code: result.recoveryCode, detail: `Give this code privately to ${result.user.displayName}. It can reset only that account.` });
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Unable to add the account.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop account-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal-card account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><p className="eyebrow">Private access</p><h2 id="account-title">Account & security</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></div>
        <section className="account-profile-card"><span><UserRound /></span><div><strong>{user.displayName}</strong><p>@{user.username} · {user.role === 'admin' ? 'Administrator' : 'Household member'}</p></div></section>

        <form className="form-section auth-account-section" onSubmit={changeCredential}>
          <div className="section-heading-row"><div><h3>Change password</h3><p>Changing it signs this account out on other devices.</p></div><LockKeyhole /></div>
          <label className="field"><span>Current password</span><input type="password" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} autoComplete="current-password" required /></label>
          <div className="form-grid">
            <label className="field"><span>New password</span><input type="password" value={nextValue} onChange={(event) => setNextValue(event.target.value)} minLength={12} autoComplete="new-password" required /></label>
            <label className="field"><span>Confirm new password</span><input type="password" value={confirmValue} onChange={(event) => setConfirmValue(event.target.value)} minLength={12} autoComplete="new-password" required /></label>
          </div>
          <button className="secondary-button" disabled={busy} type="submit"><LockKeyhole size={17} /> Update password</button>
        </form>

        <section className="form-section auth-account-section">
          <div className="section-heading-row"><div><h3>Personal recovery code</h3><p>Create a replacement code if the saved copy is lost or may have been seen.</p></div><KeyRound /></div>
          <button className="secondary-button" disabled={busy} type="button" onClick={() => void rotateRecovery()}><RefreshCw size={17} /> Generate a new recovery code</button>
        </section>

        {user.role === 'admin' && <form className="form-section auth-account-section" onSubmit={addHouseholdAccount}>
          <div className="section-heading-row"><div><h3>Add a household account</h3><p>Create a separate sign-in for Dillan or another trusted person.</p></div><Users /></div>
          {users.length > 0 && <div className="household-user-list">{users.map((account) => <span key={account.id}><UserRound size={15} /> {account.displayName} <small>@{account.username}</small></span>)}</div>}
          <div className="form-grid">
            <label className="field"><span>Display name</span><input value={newDisplayName} onChange={(event) => setNewDisplayName(event.target.value)} placeholder="Dillan" required /></label>
            <label className="field"><span>Username</span><input value={newUsername} onChange={(event) => setNewUsername(event.target.value)} placeholder="dillan" autoCapitalize="none" required /></label>
            <label className="field"><span>Initial password</span><input type="password" value={newCredential} onChange={(event) => setNewCredential(event.target.value)} minLength={12} autoComplete="new-password" required /></label>
            <label className="field"><span>Confirm password</span><input type="password" value={newCredentialConfirm} onChange={(event) => setNewCredentialConfirm(event.target.value)} minLength={12} autoComplete="new-password" required /></label>
          </div>
          <label className="auth-admin-toggle"><input type="checkbox" checked={newAdmin} onChange={(event) => setNewAdmin(event.target.checked)} /> Allow this person to add other accounts</label>
          <button className="secondary-button" disabled={busy} type="submit"><Plus size={17} /> Create account</button>
        </form>}

        {message && <p className="auth-form-message">{message}</p>}
        <div className="modal-actions"><button className="danger-button" type="button" onClick={onLogout}><LogOut size={17} /> Sign out</button><span className="modal-action-spacer" /><button className="primary-button" type="button" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [user, setUser] = useState<AuthUser>();
  const [screen, setScreen] = useState<'login' | 'setup' | 'reset'>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState<RecoveryNotice>();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [credential, setCredential] = useState('');
  const [credentialConfirm, setCredentialConfirm] = useState('');
  const [masterKey, setMasterKey] = useState('');
  const [resetMethod, setResetMethod] = useState<'personal' | 'emergency'>('personal');
  const [resetCode, setResetCode] = useState('');

  useEffect(() => {
    requestJson<AuthStatus>('/api/auth/status')
      .then((status) => { setInitialized(status.initialized); setUser(status.user); setScreen(status.initialized ? 'login' : 'setup'); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load sign-in.'))
      .finally(() => setLoading(false));
  }, []);

  const contextValue = useMemo(() => user ? { user, openAccount: () => setAccountOpen(true) } : undefined, [user]);

  async function submitSetup(event: FormEvent) {
    event.preventDefault();
    if (credential !== credentialConfirm) { setError('The passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      const result = await requestJson<{ user: AuthUser; recoveryCode: string }>('/api/auth/setup', {
        method: 'POST', body: JSON.stringify({ displayName, username, password: credential, masterKey }),
      });
      setInitialized(true); setUser(result.user); setCredential(''); setCredentialConfirm(''); setMasterKey('');
      setRecoveryNotice({ title: 'Save your recovery code', code: result.recoveryCode, detail: 'This personal code can reset your password without the emergency master key.' });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to secure Camp Ledger.'); }
    finally { setBusy(false); }
  }

  async function submitLogin(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await requestJson<{ user: AuthUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password: credential }) });
      setUser(result.user); setCredential('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  }

  async function submitReset(event: FormEvent) {
    event.preventDefault();
    if (credential !== credentialConfirm) { setError('The new passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      const result = await requestJson<{ user: AuthUser; recoveryCode: string }>('/api/auth/reset', {
        method: 'POST',
        body: JSON.stringify({ username, newPassword: credential, recoveryCode: resetMethod === 'personal' ? resetCode : undefined, masterKey: resetMethod === 'emergency' ? masterKey : undefined }),
      });
      setUser(result.user); setCredential(''); setCredentialConfirm(''); setResetCode(''); setMasterKey('');
      setRecoveryNotice({ title: 'Save your new recovery code', code: result.recoveryCode, detail: 'The old personal recovery code was retired when the password was reset.' });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to reset the password.'); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setAccountOpen(false); setUser(undefined); setUsername(''); setCredential(''); setScreen('login');
  }

  if (loading) return <div className="auth-loading"><TentTree /><strong>Securing Camp Ledger…</strong></div>;
  if (recoveryNotice) return <RecoveryCodeCard notice={recoveryNotice} onContinue={() => setRecoveryNotice(undefined)} />;
  if (user && contextValue) return (
    <AuthContext.Provider value={contextValue}>
      {children}
      {accountOpen && <AccountModal user={user} onClose={() => setAccountOpen(false)} onLogout={() => void logout()} onRecoveryNotice={setRecoveryNotice} />}
    </AuthContext.Provider>
  );

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand"><span className="auth-brand-mark"><TentTree /></span><div><strong>Camp Ledger</strong><small>Private camping journal</small></div></div>

        {screen === 'setup' && <form onSubmit={submitSetup}>
          <p className="eyebrow">First-time security setup</p><h1>Lock down Camp Ledger</h1>
          <p>Create the first administrator account. The emergency master key is separate from your password and remains the final recovery option.</p>
          <label className="field"><span>Emergency master key</span><input type="password" value={masterKey} onChange={(event) => setMasterKey(event.target.value)} autoComplete="off" required /><small>Use the master key provided after this security update is deployed.</small></label>
          <div className="form-grid">
            <label className="field"><span>Your name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Aaron" required /></label>
            <label className="field"><span>Username</span><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="aaron" autoCapitalize="none" required /></label>
            <label className="field"><span>Password</span><input type="password" value={credential} onChange={(event) => setCredential(event.target.value)} minLength={12} autoComplete="new-password" required /></label>
            <label className="field"><span>Confirm password</span><input type="password" value={credentialConfirm} onChange={(event) => setCredentialConfirm(event.target.value)} minLength={12} autoComplete="new-password" required /></label>
          </div>
          {error && <p className="auth-form-error">{error}</p>}
          <button className="primary-button auth-wide-button" disabled={busy} type="submit"><ShieldCheck size={18} /> {busy ? 'Securing…' : 'Create administrator account'}</button>
        </form>}

        {screen === 'login' && <form onSubmit={submitLogin}>
          <p className="eyebrow">Private access</p><h1>Welcome back</h1><p>Sign in to open your trips, equipment, photos, and camping records.</p>
          <label className="field"><span>Username</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoCapitalize="none" autoComplete="username" required /></label>
          <label className="field"><span>Password</span><input type="password" value={credential} onChange={(event) => setCredential(event.target.value)} autoComplete="current-password" required /></label>
          {error && <p className="auth-form-error">{error}</p>}
          <button className="primary-button auth-wide-button" disabled={busy} type="submit"><LockKeyhole size={18} /> {busy ? 'Signing in…' : 'Sign in'}</button>
          <button className="text-button auth-reset-link" type="button" onClick={() => { setError(''); setCredential(''); setScreen('reset'); }}>Forgot your password?</button>
        </form>}

        {screen === 'reset' && <form onSubmit={submitReset}>
          <p className="eyebrow">Account recovery</p><h1>Reset your password</h1><p>Use your personal recovery code, or use the emergency master key as the final fallback.</p>
          <div className="auth-method-toggle"><button type="button" className={resetMethod === 'personal' ? 'active' : ''} onClick={() => setResetMethod('personal')}>Personal recovery code</button><button type="button" className={resetMethod === 'emergency' ? 'active' : ''} onClick={() => setResetMethod('emergency')}>Emergency master key</button></div>
          <label className="field"><span>Username</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoCapitalize="none" required /></label>
          {resetMethod === 'personal'
            ? <label className="field"><span>Recovery code</span><input value={resetCode} onChange={(event) => setResetCode(event.target.value)} placeholder="ABCD-EFGH-IJKL-MNOP-QRST-UVWX" autoCapitalize="characters" required /></label>
            : <label className="field"><span>Emergency master key</span><input type="password" value={masterKey} onChange={(event) => setMasterKey(event.target.value)} autoComplete="off" required /></label>}
          <div className="form-grid">
            <label className="field"><span>New password</span><input type="password" value={credential} onChange={(event) => setCredential(event.target.value)} minLength={12} autoComplete="new-password" required /></label>
            <label className="field"><span>Confirm new password</span><input type="password" value={credentialConfirm} onChange={(event) => setCredentialConfirm(event.target.value)} minLength={12} autoComplete="new-password" required /></label>
          </div>
          {error && <p className="auth-form-error">{error}</p>}
          <button className="primary-button auth-wide-button" disabled={busy} type="submit"><KeyRound size={18} /> {busy ? 'Resetting…' : 'Reset password'}</button>
          <button className="text-button auth-reset-link" type="button" onClick={() => { setError(''); setScreen(initialized ? 'login' : 'setup'); }}>Back to sign in</button>
        </form>}
      </div>
    </div>
  );
}
