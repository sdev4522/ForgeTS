import React from 'react';

export interface NoteItem {
  id: number;
  title: string;
  content?: string;
  created_at?: string;
}

export interface NoteIndexProps {
  items?: NoteItem[];
  csrf_token?: string;
}

export default function NoteIndex({ items = [], csrf_token = '' }: NoteIndexProps) {
  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', fontFamily: 'sans-serif', color: '#f8fafc', backgroundColor: '#090d16', padding: '2rem', borderRadius: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Notes</h2>
        <a href="/notes/create" style={{ background: '#6366f1', color: '#fff', padding: '0.5rem 1rem', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600 }}>+ New Note</a>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {items.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>No notes found. Create your first note above!</p>
        ) : (
          items.map((item) => (
            <div key={item.id} style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <a href={`/notes/${item.id}`} style={{ color: '#818cf8', fontWeight: 600, fontSize: '1.1rem', textDecoration: 'none' }}>{item.title}</a>
                {item.content && <p style={{ color: '#94a3b8', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>{item.content}</p>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a href={`/notes/${item.id}/edit`} style={{ color: '#cbd5e1', fontSize: '0.85rem', textDecoration: 'none' }}>Edit</a>
                <form action={`/notes/${item.id}/delete`} method="POST" style={{ display: 'inline' }}>
                  {csrf_token && <input type="hidden" name="_token" value={csrf_token} />}
                  <button type="submit" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}>Delete</button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
