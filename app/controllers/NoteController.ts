import { Controller, Get, Post, Request, ForgeResponse, now } from '@forge/core';
import { Note } from '../models/Note.js';

@Controller('/notes')
export class NoteController {

  /** GET /notes — Render index page (React SSR) */
  @Get('/')
  async index(_req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const rawItems = await Note.all();
    const items = rawItems.map((item) => item.toJSON());
    return res.view('notes/index', { items, title: 'All Notes' });
  }

  /** GET /notes/create — Render create form page (React SSR) */
  @Get('/create')
  async create(_req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    return res.view('notes/create', { title: 'Create Note' });
  }

  /** GET /notes/:id — Render show page (React SSR) */
  @Get('/:id')
  async show(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const item = await Note.find(req.param('id'));
    if (!item) return res.status(404).html('<h1>Note Not Found</h1>');
    return res.view('notes/show', { item: item.toJSON(), title: `Note #${req.param('id')}` });
  }

  /** GET /notes/:id/edit — Render edit form page (React SSR) */
  @Get('/:id/edit')
  async edit(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const item = await Note.find(req.param('id'));
    if (!item) return res.status(404).html('<h1>Note Not Found</h1>');
    return res.view('notes/edit', { item: item.toJSON(), title: `Edit Note #${req.param('id')}` });
  }

  /** POST /notes — Store new item */
  @Post('/')
  async store(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const body = await req.body<{ title?: string; content?: string }>();
    if (body && body.title && body.title.trim()) {
      await Note.create({
        title: body.title.trim(),
        content: (body.content || '').trim(),
        created_at: now().toDateTimeString(),
      });
    }
    return res.redirect('/notes');
  }

  /** POST /notes/:id/update — Update item */
  @Post('/:id/update')
  async updateForm(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const id = req.param('id');
    const item = await Note.find(id);
    if (item) {
      const body = await req.body<{ title?: string; content?: string }>();
      item.fill({
        title: (body.title || '').trim(),
        content: (body.content || '').trim(),
      });
      await item.save();
    }
    return res.redirect(`/notes/${id}`);
  }

  /** POST /notes/:id/delete — Delete item */
  @Post('/:id/delete')
  async destroyForm(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const id = req.param('id');
    const item = await Note.find(id);
    if (item) {
      await item.delete();
    }
    return res.redirect('/notes');
  }
}
