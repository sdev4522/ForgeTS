import React from 'react';

export interface NoteShowProps {
  item: { id: number; title: string; content?: string; created_at?: string };
  csrf_token?: string;
}

export default function NoteShow({ item, csrf_token = '' }: NoteShowProps) {
  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', fontFamily: 'sans-serif', color: '#f8fafc', backgroundColor: '#090d16', padding: '2rem', borderRadius: '1rem' }}>
      <h2 style={{ color: '#818cf8', marginBottom: '0.5rem' }}>{item?.title}</h2>
      {item?.created_at && <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Created: {item.created_at}</p>}
      <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem', minHeight: '100px' }}>
        <p style={{ color: '#cbd5e1', lineHeight: '1.6' }}>{item?.content || 'No content provided.'}</p>
      </div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <a href={`/notes/${item?.id}/edit`} style={{ background: '#6366f1', color: '#fff', padding: '0.5rem 1rem', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600 }}>Edit Note</a>
        <a href="/notes" style={{ color: '#94a3b8', padding: '0.5rem 1rem', textDecoration: 'none' }}>Back to Notes</a>
      </div>
    </div>
  );
}
