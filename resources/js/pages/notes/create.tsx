import React from 'react';

export interface NoteCreateProps {
  csrf_token?: string;
}

export default function NoteCreate({ csrf_token = '' }: NoteCreateProps) {
  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', fontFamily: 'sans-serif', color: '#f8fafc', backgroundColor: '#090d16', padding: '2rem', borderRadius: '1rem' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Create Note</h2>
      <form action="/notes" method="POST" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {csrf_token && <input type="hidden" name="_token" value={csrf_token} />}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Title</label>
          <input type="text" name="title" required placeholder="Enter note title..." style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', background: '#0f172a', color: '#fff' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Content</label>
          <textarea name="content" rows={4} placeholder="Enter note content..." style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', background: '#0f172a', color: '#fff' }} />
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button type="submit" style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>Save Note</button>
          <a href="/notes" style={{ color: '#94a3b8', textDecoration: 'none', padding: '0.75rem 1rem' }}>Cancel</a>
        </div>
      </form>
    </div>
  );
}
