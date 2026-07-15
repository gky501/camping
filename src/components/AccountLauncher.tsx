import { ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from './AuthGate';

export function AccountLauncher() {
  const { user, openAccount } = useAuth();
  return (
    <button className="account-launcher" type="button" onClick={openAccount} title="Account and security">
      <span className="account-launcher-icon"><UserRound size={18} /></span>
      <span><small>Signed in</small><strong>{user.displayName}</strong></span>
      <ShieldCheck className="account-launcher-shield" size={17} />
    </button>
  );
}
