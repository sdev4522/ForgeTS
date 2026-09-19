import React from 'react';
import { DocsLayout } from '../../components/DocsLayout.js';

export default function DocsCli() {
  const commands = [
    { cmd: 'forge serve', desc: 'Start development server with hot reload' },
    { cmd: 'forge make:controller <Name>', desc: 'Scaffold an HTTP controller' },
    { cmd: 'forge make:model <Name> [--migration]', desc: 'Scaffold Active Record model' },
    { cmd: 'forge make:page <Name> [--crud]', desc: 'Scaffold React pages + full CRUD flow (Model, Migration, Controller, 4 React Pages)' },
    { cmd: 'forge make:service <Name>', desc: 'Scaffold an @Injectable() service' },
    { cmd: 'forge make:middleware <Name>', desc: 'Scaffold an HTTP middleware' },
    { cmd: 'forge make:migration <name>', desc: 'Scaffold a database migration file' },
    { cmd: 'forge routes:list', desc: 'Display all registered routes' },
    { cmd: 'forge cache:clear', desc: 'Clear application cache' },
  ];

  return (
    <DocsLayout currentPath="/docs/cli" title="CLI Scaffolding Commands">
      <p style={{ color: '#cbd5e1', fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '2rem' }}>
        ForgeTS includes a built-in CLI (`forge` / `bun run forge`) for rapid scaffolding and development workflows.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {commands.map((c) => (
          <div key={c.cmd} style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', padding: '1rem 1.25rem' }}>
            <code style={{ color: '#38bdf8', fontSize: '1rem', fontWeight: 600 }}>{c.cmd}</code>
            <p style={{ color: '#94a3b8', margin: '0.35rem 0 0 0', fontSize: '0.9rem' }}>{c.desc}</p>
          </div>
        ))}
      </div>
    </DocsLayout>
  );
}
