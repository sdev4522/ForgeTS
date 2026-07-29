// resources/js/layouts/AppLayout.tsx
// ─────────────────────────────────────────────────────────────────────
// Shared Master App Layout component for React SSR pages.
// ─────────────────────────────────────────────────────────────────────

import React from 'react';

export interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  badgeText?: string;
}

export function AppLayout({ children, badgeText = 'React 19 SSR' }: AppLayoutProps) {
  return (
    <div className="container">
      {/* Shared Header */}
      <div className="header">
        <div className="logo">
          ⚡ <span>Forge</span>TS (React SSR)
        </div>
        <div className="badge">
          <span className="dot"></span> {badgeText}
        </div>
      </div>

      {/* Main Page Content */}
      <main className="main-content">{children}</main>

      {/* Shared Footer */}
      <footer style={{ marginTop: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
        Powered by ForgeTS &bull; Bun Runtime &bull; Active Record ORM
      </footer>
    </div>
  );
}
