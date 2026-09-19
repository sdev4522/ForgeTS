import React from 'react';

export interface DocsLayoutProps {
  currentPath: string;
  title: string;
  children: React.ReactNode;
}

export function DocsLayout({ currentPath, title, children }: DocsLayoutProps) {
  const navItems = [
    { path: '/docs', label: 'Getting Started' },
    { path: '/docs/routing', label: 'Routing' },
    { path: '/docs/models', label: 'Models & ORM' },
    { path: '/docs/views', label: 'Views (HTML & React)' },
    { path: '/docs/cli', label: 'CLI Commands' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#090d16', color: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Top Header */}
      <header style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(12px)', padding: '1rem 2rem', position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem', fontWeight: 800 }}>
          <a href="/" style={{ color: '#f8fafc', textDecoration: 'none' }}><span style={{ color: '#818cf8' }}>Forge</span>TS Documentation</a>
          <span style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#a5b4fc', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontWeight: 700 }}>v0.1.0</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <a href="/todos/react" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>Todo Demo</a>
          <a href="/notes" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>Notes CRUD</a>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', minHeight: 'calc(100vh - 65px)' }}>
        {/* Sidebar Nav */}
        <aside style={{ width: '260px', borderRight: '1px solid rgba(255, 255, 255, 0.08)', padding: '2rem 1.5rem 2rem 0', flexShrink: 0 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '1rem' }}>Core Framework</div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {navItems.map((item) => {
              const isActive = currentPath === item.path;
              return (
                <a
                  key={item.path}
                  href={item.path}
                  style={{
                    padding: '0.6rem 1rem',
                    borderRadius: '0.5rem',
                    color: isActive ? '#ffffff' : '#94a3b8',
                    backgroundColor: isActive ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                    border: isActive ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                    fontWeight: isActive ? 600 : 500,
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
        </aside>

        {/* Page Content */}
        <main style={{ flex: 1, padding: '2.5rem 0 4rem 3rem', maxWidth: '840px' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '1.5rem', background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {title}
          </h1>
          {children}
        </main>
      </div>
    </div>
  );
}
