import { Menu } from 'lucide-react';

export default function Header({ title, subtitle, onMenuClick, children }) {
  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flex: 1 }}>
        <button
          className="btn btn-ghost btn-icon mobile-menu-btn"
          onClick={onMenuClick}
          style={{ display: 'none' }}
        >
          <Menu size={20} />
        </button>
        <div>
          <h2 style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
          }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              marginTop: '2px',
            }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children && <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>{children}</div>}

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </header>
  );
}
