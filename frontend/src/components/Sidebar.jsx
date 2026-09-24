import { UsersRound, Briefcase, PencilRuler, ClipboardCheck, Factory, Truck, Wrench, ShieldCheck, AlertCircle, Building2, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';

// Desktop: a fixed left navigation. Phones (≤780px): a slim top bar with the current page and a menu button
// that slides the same navigation in as a drawer.
export function Sidebar({ currentTab, onTabChange }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const navItems = [
    {
      id: 'pre-sales',
      label: 'Pre Sales Review',
      sublabel: 'PSM & Lead Funnel',
      icon: UsersRound
    },
    {
      id: 'sales',
      label: 'Sales Review',
      sublabel: 'Deals & Closer Pipeline',
      icon: Briefcase
    },
    {
      id: 'design',
      label: 'Design Dashboard',
      sublabel: 'Pre & Post Design Queue',
      icon: PencilRuler
    },
    {
      id: 'pdi',
      label: 'PDI & Site Review',
      sublabel: 'Measurements & Appliances',
      icon: ClipboardCheck
    },
    {
      id: 'factory',
      label: 'Factory & Standup',
      sublabel: 'Gaps, Planning & TAT',
      icon: Factory
    },
    {
      id: 'dispatch',
      label: 'Dispatch Review',
      sublabel: 'Site, Payment & Transport',
      icon: Truck
    },
    {
      id: 'installation',
      label: 'Installation Review',
      sublabel: 'Missing Items & Site Work',
      icon: Wrench
    },
    {
      id: 'ams',
      label: 'AMS Review',
      sublabel: 'Maintenance Services',
      icon: ShieldCheck
    },
    {
      id: 'decision-queue',
      label: 'Decision Queue',
      sublabel: 'Urgent Interventions',
      icon: AlertCircle
    }
  ];

  const current = navItems.find((item) => item.id === currentTab) ?? navItems[0];
  const choose = (id) => {
    setOpen(false);
    onTabChange(id);
  };

  return (
    <>
    <header className="mobile-bar">
      <button type="button" className="mobile-menu-btn" aria-label="Open menu" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen(true)}>
        <Menu size={22} aria-hidden="true" />
      </button>
      <div className="mobile-bar-title">
        <strong>{current.label}</strong>
        <span>MAGPPIE · Monitoring Review</span>
      </div>
    </header>
    {open && <div className="mobile-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
    <aside id="main-nav" className={`sidebar${open ? ' open' : ''}`} aria-label="Main Navigation">
      <button type="button" className="mobile-close-btn" aria-label="Close menu" onClick={() => setOpen(false)}>
        <X size={20} aria-hidden="true" />
      </button>
      <div className="sidebar-brand">
        <div className="brand-logo">
          <Building2 size={22} className="brand-icon" />
          <div>
            <div className="brand-title">MAGPPIE</div>
            <div className="brand-subtitle">Monitoring Review System</div>
          </div>
        </div>
      </div>

      <div className="sidebar-section-title">DAILY REVIEWS</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => choose(item.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="nav-icon">
                <IconComponent size={18} strokeWidth={isActive ? 2.5 : 2} />
              </span>
              <div className="nav-text">
                <span className="nav-label">{item.label}</span>
                <span className="nav-sublabel">{item.sublabel}</span>
              </div>
              {isActive && <div className="active-indicator" />}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="crm-status">
          <span className="status-dot" />
          <div>
            <strong>Zoho CRM Live</strong>
            <span>Org 60046349006</span>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}
