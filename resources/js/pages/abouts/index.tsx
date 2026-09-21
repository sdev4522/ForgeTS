import React from 'react';
import type { PageProps } from '../../types';

export default function AboutPage(_props: PageProps) {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#f8fafc', maxWidth: '800px', margin: '0 auto' }}>
      <h1>About ForgeTS</h1>
      <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>
        ForgeTS is a batteries-included, TypeScript-first web framework designed for Bun.
        Featuring unified Active Record ORM, TC39 Stage 3 decorators, radix-trie routing,
        and high-speed React 19 server-side rendering.
      </p>
      <div style={{ marginTop: '1.5rem' }}>
        <a href="/" style={{ color: '#38bdf8', textDecoration: 'none' }}>&larr; Back to Welcome</a>
      </div>
    </div>
  );
}