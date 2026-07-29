// app/controllers/TodoController.ts
import { Controller, Get, Post, Put, Delete, Request, ForgeResponse, now, RateLimit } from '@forge/core';
import { Todo } from '../models/Todo.js';

@Controller('/todos')
export class TodoController {

  /** GET /todos/ui — Render Todo UI app via React SSR */
  @Get('/ui')
  async ui(_req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const rawTodos = await Todo.all();
    const todos = rawTodos.map((t) => t.toJSON());
    return res.view('todos/index', { todos, title: 'ForgeTS — Todo App (React SSR)' });
  }

  /** GET /todos/react — Render React SSR UI for Todo app with chainable SEO meta tags */
  @Get('/react')
  async reactUI(_req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const rawTodos = await Todo.all();
    const todos = rawTodos.map((t) => t.toJSON());
    return res.view('todos/index', { todos }).meta({
      title: 'All Todos',
      description: 'Browse all todos',
    });
  }

  /** POST /todos/create — Handle HTML form submission */
  @Post('/create')
  async createForm(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const body = await req.body<{ title?: string }>();
    if (body && body.title && body.title.trim()) {
      await Todo.create({
        title: body.title.trim(),
        completed: 0,
        created_at: now().toDateTimeString(),
      });
    }
    return res.redirect('/todos/ui');
  }

  /** POST /todos/:id/toggle — Toggle completion status */
  @Post('/:id/toggle')
  async toggleForm(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const id = req.param('id');
    const todo = await Todo.find(id);
    if (todo) {
      const isDone = Boolean(todo._attributes.completed);
      todo.fill({ completed: isDone ? 0 : 1 });
      await todo.save();
    }
    return res.redirect('/todos/ui');
  }

  /** POST /todos/:id/delete — Delete todo */
  @Post('/:id/delete')
  async deleteForm(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const id = req.param('id');
    const todo = await Todo.find(id);
    if (todo) {
      await todo.delete();
    }
    return res.redirect('/todos/ui');
  }

  // ─── JSON API Endpoints ──────────────────────────────────────────────

  @Get('/')
  async index(_req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const todos = await Todo.all();
    return res.json(todos.map((t) => t.toJSON()));
  }

  @Get('/:id')
  async show(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const todo = await Todo.find(req.param('id'));
    if (!todo) return res.status(404).json({ error: 'Todo not found' });
    return res.json(todo.toJSON());
  }

  @Post('/')
  @RateLimit(3, 60)
  async store(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const data = await req.validate<{ title: string; completed?: boolean }>({
      title: 'required|string|min:3',
      completed: 'boolean',
    });

    const todo = await Todo.create({
      title: data.title,
      completed: data.completed ? 1 : 0,
      created_at: now().toDateTimeString(),
    });
    return res.status(201).json(todo.toJSON());
  }

  @Put('/:id')
  async update(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const todo = await Todo.find(req.param('id'));
    if (!todo) return res.status(404).json({ error: 'Todo not found' });

    const body = await req.body<Record<string, any>>();
    const { id: _id, created_at: _c, ...rest } = body as any;
    todo.fill(rest);
    await todo.save();
    return res.json(todo.toJSON());
  }

  @Delete('/:id')
  async destroy(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const todo = await Todo.find(req.param('id'));
    if (!todo) return res.status(404).json({ error: 'Todo not found' });
    await todo.delete();
    return res.status(204).json({});
  }

  private escapeHtml(str: string): string {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
