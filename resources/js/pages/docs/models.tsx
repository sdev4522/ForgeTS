import React from 'react';
import { DocsLayout } from '../../components/DocsLayout.js';

export default function DocsModels() {
  return (
    <DocsLayout currentPath="/docs/models" title="Active Record Models & ORM">
      <p style={{ color: '#cbd5e1', fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '2rem' }}>
        ForgeTS provides a Laravel-style Active Record ORM powered by Kysely under the hood. Supports MySQL relational and MongoDB document stores seamlessly.
      </p>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#818cf8', marginBottom: '1rem' }}>Defining a Model</h2>
        <pre style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.08)', padding: '1.25rem', borderRadius: '0.5rem', fontFamily: 'monospace', color: '#e2e8f0', overflowX: 'auto' }}>
{`// app/models/Note.ts
import { Model } from '@forge/database';

export class Note extends Model {
  static override table = 'notes';
  static override timestamps = false;
  static override fillable = ['title', 'content', 'created_at'];
}`}
        </pre>
      </section>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#818cf8', marginBottom: '1rem' }}>Active Record CRUD Operations</h2>
        <pre style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.08)', padding: '1.25rem', borderRadius: '0.5rem', fontFamily: 'monospace', color: '#e2e8f0', overflowX: 'auto' }}>
{`// 1. Fetch All
const notes = await Note.all();

// 2. Find by Primary Key
const note = await Note.find(1);

// 3. Query Builder Filter
const note = await Note.where('title', '=', 'My Note').first();

// 4. Create New Record
const newNote = await Note.create({
  title: 'Scaffolded Note',
  content: 'Hello World',
  created_at: now().toDateTimeString(),
});

// 5. Update Record
note.fill({ title: 'Updated Title' });
await note.save();

// 6. Delete Record
await note.delete();`}
        </pre>
      </section>
    </DocsLayout>
  );
}
