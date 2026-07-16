import { useEffect, useState } from 'react';
import { ChevronDown, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from './AuthGate';
import { AdminAccountsLauncher } from './AdminAccountsLauncher';
import { DataMigrationLauncher } from './DataMigrationLauncher';
import { HeaderTripStatus } from './HeaderTripStatus';

export function HeaderUtilities() {
  const { user, openAccount } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  function openAccountSettings() {
    setMenuOpen(false);
    openAccount();
  }

  return (
    <>
      {menuOpen && <button className="header-utility-scrim" type="button" aria-label="Close account menu" onClick={() => setMenuOpen(false)} />}
      <div className="header-utilities">
        <HeaderTripStatus />
        <button
          className={menuOpen ? 'header-utility-trigger open' : 'header-utility-trigger'}
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="header-utility-avatar"><UserRound size={18} /></span>
          <span className="header-utility-user"><small>Account</small><strong>{user.displayName}</strong></span>
          <ChevronDown className="header-utility-chevron" size={17} />
        </button>

        <div className={menuOpen ? 'header-utility-menu open' : 'header-utility-menu'} role="menu" aria-hidden={!menuOpen}>
          <div className="header-utility-menu-heading">
            <span><ShieldCheck size={18} /></span>
            <div><small>Signed in as</small><strong>{user.displayName}</strong><em>@{user.username}</em></div>
          </div>

          <button className="header-utility-account-row" type="button" role="menuitem" onClick={openAccountSettings}>
            <span><UserRound size={18} /></span>
            <div><strong>Account & security</strong><small>Password, recovery code, and sign out</small></div>
          </button>

          {user.role === 'admin' && <div className="header-utility-admin-row" role="none">
            <AdminAccountsLauncher />
            <span className="header-utility-admin-copy"><strong>Household accounts</strong><small>Reset passwords or remove access</small></span>
          </div>}

          <DataMigrationLauncher />
        </div>
      </div>
    </>
  );
}
