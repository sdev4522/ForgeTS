import { describe, test, expect, beforeAll } from 'bun:test';
import app from '../../bootstrap/app.js';
import { getDatabaseConnection } from '@forge/database';
import { Note } from '../../app/models/Note.js';

describe('Scaffolded CRUD Flow End-to-End (notes)', () => {
  beforeAll(async () => {
    process.env.DB_CONNECTION = 'mysql';
    try {
      const db = getDatabaseConnection();
      await (db as any).executeQuery({
        sql: `CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, title VARCHAR(255) NOT NULL, content TEXT, created_at VARCHAR(255));`,
        parameters: [],
      });
    } catch {
      // connection initialized dynamically if needed
    }
  });

  test('1. GET /notes renders React SSR index page with notes list', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://example.test/notes', {
        headers: { accept: 'text/html' },
      })
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Notes');
    expect(html).toContain('notes/index');
  });

  test('2. GET /notes/create renders React SSR create form page', async () => {
    const res = await (app as any).handleRequest(
      new globalThis.Request('http://example.test/notes/create', {
        headers: { accept: 'text/html' },
      })
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Create Note');
    expect(html).toContain('notes/create');
  });

  test('3. Model CRUD operations (create, find, update, delete) work seamlessly', async () => {
    // Create
    const note = await Note.create({
      title: 'Scaffolded Note Test',
      content: 'Testing generated Active Record model',
      created_at: '2026-08-05 12:00:00',
    });
    expect(note).not.toBeNull();
    expect(note.id).toBeDefined();
    expect(note._attributes.title).toBe('Scaffolded Note Test');

    // Show GET page
    const showRes = await (app as any).handleRequest(
      new globalThis.Request(`http://example.test/notes/${note.id}`, {
        headers: { accept: 'text/html' },
      })
    );
    expect(showRes.status).toBe(200);
    const showHtml = await showRes.text();
    expect(showHtml).toContain('Scaffolded Note Test');
    expect(showHtml).toContain('notes/show');

    // Edit GET page
    const editRes = await (app as any).handleRequest(
      new globalThis.Request(`http://example.test/notes/${note.id}/edit`, {
        headers: { accept: 'text/html' },
      })
    );
    expect(editRes.status).toBe(200);
    const editHtml = await editRes.text();
    expect(editHtml).toContain(`Edit Note #${note.id}`);
    expect(editHtml).toContain('notes/edit');

    // Update
    note.fill({ title: 'Updated Note Title' });
    await note.save();
    const updated = await Note.find(note.id);
    expect(updated?._attributes.title).toBe('Updated Note Title');

    // Delete
    await note.delete();
    const deleted = await Note.find(note.id);
    expect(deleted).toBeNull();
  });
});
