import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Swords,
  UserCircle,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  X,
  Zap,
  Crosshair,
  Filter
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/teams', label: 'Teams', icon: Users },
  { path: '/players', label: 'Players', icon: UserCircle },
  { path: '/head-to-head', label: 'Head to Head', icon: Swords },
  { path: '/scorecard', label: 'Scorecard', icon: ClipboardList },
  { path: '/analytics', label: 'Analytics', icon: Zap },
  { path: '/matchup', label: 'Matchup', icon: Crosshair },
  { path: '/filter', label: 'Match Filter', icon: Filter },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const location = useLocation();

  const sidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center ${collapsed && !isMobile ? 'justify-center px-3' : 'justify-between px-5'} py-4 border-b border-gray-200`}>
        {isMobile && (
          <button onClick={onMobileClose} className="absolute top-4 right-4 p-1.5 text-gray-500 hover:text-gray-900 transition-colors">
            <X size={22} />
          </button>
        )}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
            <span className="text-base font-black text-white tracking-tight">IPL</span>
          </div>
          {(!collapsed || isMobile) && (
            <div>
              <h1 className="text-[15px] font-bold text-gray-900 leading-tight">Cricket Stats</h1>
              <p className="text-[10px] text-gray-400 font-semibold tracking-widest uppercase">Analytics</p>
            </div>
          )}
        </div>
        {!isMobile && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="px-2 pt-3 flex-1">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={() => isMobile && onMobileClose()}
                  className={`cb-nav-item ${collapsed && !isMobile ? 'justify-center px-2' : 'px-3'} ${isActive ? 'cb-nav-active' : ''}`}
                  title={collapsed && !isMobile ? item.label : undefined}
                >
                  <item.icon size={20} className="flex-shrink-0" />
                  {(!collapsed || isMobile) && <span>{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      {(!collapsed || isMobile) && (
        <div className="px-3 pb-4">
          <div className="cb-sidebar-footer">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-gray-500">IPL Database</span>
            </div>
            <p className="text-[10px] text-gray-400">1,169 matches · 18 seasons</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside
        className={`fixed top-0 left-0 h-full cb-sidebar z-40 hidden lg:block transition-all duration-300
          ${collapsed ? 'w-[68px]' : 'w-[240px]'}`}
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden" onClick={onMobileClose} />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-[260px] cb-sidebar z-50 transform transition-transform duration-300 lg:hidden
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {sidebarContent(true)}
      </aside>
    </>
  );
}
