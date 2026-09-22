import { UsersRound, Briefcase, PencilRuler, ClipboardCheck, Factory, Truck, Wrench, ShieldCheck, AlertCircle, Building2 } from 'lucide-react';

export function Sidebar({ currentTab, onTabChange }) {
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

  return (
    <aside className="sidebar" aria-label="Main Navigation">
      <div className="sidebar-brand">
        <div className="brand-logo">
          <Building2 size={22} className="brand-icon" />
          <div>
            <div className="brand-title">MAGPPIE</div>
            <div className="brand-subtitle">Morning Review System</div>
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
              onClick={() => onTabChange(item.id)}
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
  );
}
