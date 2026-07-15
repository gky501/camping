import { useEffect, useState } from 'react';
import { BarChart3, BookOpen, Bookmark, ClipboardCheck, Map, Wrench } from 'lucide-react';

type MobileSection = 'passport' | 'places' | 'checklist' | 'wishlist' | 'stats' | 'tools';

const items = [
  { id: 'passport' as const, label: 'Passport', icon: BookOpen },
  { id: 'places' as const, label: 'Places', icon: Map },
  { id: 'checklist' as const, label: 'Checklist', icon: ClipboardCheck },
  { id: 'wishlist' as const, label: 'Wish list', icon: Bookmark },
  { id: 'stats' as const, label: 'Recap', icon: BarChart3 },
  { id: 'tools' as const, label: 'Tools', icon: Wrench },
];

function originalMobileButton(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('.mobile-nav-v2 button')]
    .find((button) => button.textContent?.trim().toLowerCase() === label.toLowerCase());
}

function toolMenuButton(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('.more-menu-card > button:not(.icon-button)')]
    .find((button) => button.querySelector('strong')?.textContent?.trim().toLowerCase() === label.toLowerCase());
}

function openToolSection(label: string) {
  originalMobileButton('More')?.click();
  window.setTimeout(() => toolMenuButton(label)?.click(), 40);
}

function currentSection(): MobileSection {
  const heading = document.querySelector<HTMLElement>('.app-main h2')?.textContent?.trim().toLowerCase() ?? '';
  if (heading.includes('wish list')) return 'wishlist';
  if (heading.includes('recap') || document.querySelector('.camping-achievements')) return 'stats';

  const activeOriginal = document.querySelector<HTMLButtonElement>('.mobile-nav-v2 button.active');
  const label = activeOriginal?.textContent?.trim().toLowerCase();
  if (label === 'passport' || label === 'places' || label === 'checklist') return label;
  return 'tools';
}

export function MobilePrimaryNav() {
  const [active, setActive] = useState<MobileSection>('passport');

  useEffect(() => {
    const sync = () => setActive(currentSection());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  function navigate(section: MobileSection) {
    setActive(section);
    if (section === 'wishlist') {
      openToolSection('Wish list');
      return;
    }
    if (section === 'stats') {
      openToolSection('Detailed recap');
      return;
    }
    if (section === 'tools') {
      originalMobileButton('More')?.click();
      return;
    }
    originalMobileButton(items.find((item) => item.id === section)?.label ?? '')?.click();
  }

  return (
    <nav className="mobile-primary-nav" aria-label="Mobile primary navigation">
      {items.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" className={active === id ? 'active' : ''} onClick={() => navigate(id)}>
          <Icon size={20} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
