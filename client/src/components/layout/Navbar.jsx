import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Menu, X, LayoutDashboard, Users, UserCircle, Swords, ClipboardList, ArrowLeftRight, BarChart3,
  Zap, Crosshair, Filter, Trophy
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/teams', label: 'Teams', icon: Users },
  { path: '/players', label: 'Players', icon: UserCircle },
  { path: '/stats', label: 'Stats', icon: BarChart3 },
  { path: '/head-to-head', label: 'Head to Head', icon: Swords },
  { path: '/scorecard', label: 'Scorecard', icon: ClipboardList },
  { path: '/compare', label: 'Compare', icon: ArrowLeftRight },
  { path: '/analytics', label: 'Analytics', icon: Zap },
  { path: '/matchup', label: 'Matchup', icon: Crosshair },
  { path: '/filter', label: 'Filter', icon: Filter },
  { path: '/points-table', label: 'Points Table', icon: Trophy },
];

export default function Navbar({ season, onSeasonChange, seasons }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Top navbar */}
      <nav className="topnav">
        <div className="topnav-inner">
          {/* Hamburger for mobile */}
          <button
            className="hamburger-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          {/* Logo */}
          <NavLink to="/" className="topnav-logo">
            IPL<span>Stats</span>
          </NavLink>

          {/* Desktop nav links */}
          <div className="topnav-links">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={`topnav-link ${location.pathname === item.path ? 'topnav-link-active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Right section */}
          <div className="topnav-right">
            <select
              value={season}
              onChange={(e) => onSeasonChange(e.target.value)}
              className="topnav-select"
            >
              <option value="">All Seasons</option>
              {seasons.map((s) => (
                <option key={s} value={s}>
                  {s.includes('/') ? s.split('/')[0] : s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </nav>

      {/* Mobile overlay */}
      <div
        className={`mobile-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile menu drawer */}
      <div className={`mobile-menu ${mobileOpen ? 'open' : ''}`}>
        <div className="mobile-menu-header">
          <h2>Menu</h2>
          <button
            className="mobile-menu-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={`mobile-nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
        {/* Season selector in mobile menu */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #eee' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>
            Season
          </label>
          <select
            value={season}
            onChange={(e) => { onSeasonChange(e.target.value); setMobileOpen(false); }}
            className="form-select"
            style={{ width: '100%' }}
          >
            <option value="">All Seasons</option>
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s.includes('/') ? s.split('/')[0] : s}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
