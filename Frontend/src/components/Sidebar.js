import React from 'react';
import '../pages/Dashboard.css';
import logoDefault from '../assets/AlumpreneurLogo.png';

function Sidebar({ logoSrc = logoDefault, onLogout, mainItems = [], bottomItems = [], activeKey, isOpen = false, onToggle }) {
  const items = Array.isArray(mainItems) ? mainItems : [];
  return (
    <>
      {onToggle && (
        <div
          className={`sidebar-backdrop${isOpen ? ' sidebar-open' : ''}`}
          onClick={onToggle}
        />
      )}
      <aside className={`machine-sidebar${isOpen ? ' sidebar-open' : ''}`}>
      <div className="machine-sidebar-logo">
        <img src={logoSrc} alt="Alumpreneur Logo" className="machine-logo-image" />
      </div>
      <div className="machine-sidebar-divider"></div>
      <nav className="machine-nav-menu">
        {items.map((item) => (
          <button
            key={item.key || item.label}
            className={`machine-menu-button ${activeKey === item.key ? 'active' : ''}`}
            onClick={item.onClick}
          >
            <span className="machine-menu-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="machine-bottom-menu">
        {bottomItems.map((item) => (
          <button
            key={item.key || item.label}
            className="machine-bottom-button"
            onClick={item.onClick}
            style={{ width: '100%' }}
          >
            {item.key === 'help' ? (
              <svg className="icon" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 2-3 4"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            ) : (
              <svg className="icon" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="2"></circle>
              </svg>
            )}
            <span className="machine-bottom-label">{item.label}</span>
          </button>
        ))}
        <button
          onClick={onLogout}
          className="machine-bottom-button sidebar-logout-button"
          style={{ width: '100%' }}
        >
          <svg className="icon" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span className="machine-bottom-label">Log Out</span>
        </button>
      </div>
    </aside>
    </>
  );
}

export default Sidebar;
