import React from 'react';
import { DocsLayout } from '../../components/DocsLayout.js';

export default function DocsViews() {
  return (
    <DocsLayout currentPath="/docs/views" title="Views (HTML & React SSR)">
      <p style={{ color: '#cbd5e1', fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '2rem' }}>
        ForgeTS supports two first-class view engines out of the box: built-in HTML View Engine and React SSR.
      </p>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#818cf8', marginBottom: '1rem' }}>1. HTML View Engine</h2>
        <p style={{ color: '#94a3b8', marginBottom: '0.75rem' }}>
          HTML templates live in <code>resources/views/*.html</code> with <code>{`{{ variable }}`}</code>, <code>{`{{{ raw }}}`}</code>, and <code>{`{{@ partial }}`}</code>.
        </p>
        <pre style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.08)', padding: '1.25rem', borderRadius: '0.5rem', fontFamily: 'monospace', color: '#e2e8f0', overflowX: 'auto' }}>
{`// Controller response
return res.view('welcome', { title: 'ForgeTS App' });`}
        </pre>
      </section>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#818cf8', marginBottom: '1rem' }}>2. React SSR View Engine</h2>
        <p style={{ color: '#94a3b8', marginBottom: '0.75rem' }}>
          React pages live in <code>resources/js/pages/*.tsx</code>. Rendered server-side with client hydration and automatic per-page code splitting.
        </p>
        <pre style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.08)', padding: '1.25rem', borderRadius: '0.5rem', fontFamily: 'monospace', color: '#e2e8f0', overflowX: 'auto' }}>
{`// Controller response with chainable SEO meta tags
return res.view('notes/index', { items }).meta({
  title: 'All Notes',
  description: 'Manage your notes seamlessly.',
});`}
        </pre>
      </section>
    </DocsLayout>
  );
}
