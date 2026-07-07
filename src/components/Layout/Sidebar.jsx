import { NavLink, useLocation } from 'react-router';
import {
  LayoutDashboard,
  Upload,
  Library,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/upload', icon: Upload, label: 'Upload & OCR' },
  { path: '/library', icon: Library, label: 'Library' },
  { path: '/test/config', icon: GraduationCap, label: 'New Test' },
];

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();

  return (
    <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo" style={{
        padding: collapsed ? 'var(--space-4)' : 'var(--space-6)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        borderBottom: '1px solid var(--color-surface-border)',
        minHeight: 'var(--header-height)',
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-accent-gradient)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: 'var(--shadow-glow)',
        }}>
          <Zap size={20} color="white" />
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)',
              whiteSpace: 'nowrap',
            }}>
              MockMaster
            </div>
            <div style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              whiteSpace: 'nowrap',
            }}>
              Offline Test Generator
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{
        flex: 1,
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
      }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));

          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: collapsed ? 'var(--space-3)' : 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                background: isActive ? 'var(--color-accent-muted)' : 'transparent',
                transition: 'all var(--transition-fast)',
                textDecoration: 'none',
                fontSize: 'var(--font-size-sm)',
                fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
                justifyContent: collapsed ? 'center' : 'flex-start',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--color-surface-hover)';
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 3,
                  height: 20,
                  borderRadius: '0 3px 3px 0',
                  background: 'var(--color-accent)',
                }} />
              )}
              <Icon size={20} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="btn btn-ghost"
        style={{
          margin: 'var(--space-4)',
          justifyContent: 'center',
          borderTop: '1px solid var(--color-surface-border)',
          borderRadius: 0,
          paddingTop: 'var(--space-4)',
        }}
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        {!collapsed && <span style={{ fontSize: 'var(--font-size-sm)' }}>Collapse</span>}
      </button>
    </aside>
  );
}
