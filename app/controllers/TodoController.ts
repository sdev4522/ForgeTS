// app/controllers/TodoController.ts
import { Controller, Get, Post, Put, Delete, Request, ForgeResponse } from '@forge/core';
import { Todo } from '../models/Todo.js';

@Controller('/todos')
export class TodoController {

  /** GET /todos/ui — Render HTML UI for Todo app */
  @Get('/ui')
  async ui(_req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const todos = await Todo.all();

    let todoListHtml = '';
    if (todos.length === 0) {
      todoListHtml = `<div class="empty-state">No tasks yet! Add your first task above.</div>`;
    } else {
      todoListHtml = todos
        .map((t: any) => {
          const isDone = Boolean(t.completed);
          const completedClass = isDone ? 'completed' : '';
          const toggleText = isDone ? '✓ Completed' : 'Mark Done';
          const toggleClass = isDone ? 'done' : '';

          return `
            <div class="todo-item">
              <span class="todo-title ${completedClass}">${this.escapeHtml(t.title)}</span>
              <div class="actions">
                <form action="/todos/${t.id}/toggle" method="POST" style="display:inline">
                  <button type="submit" class="btn-toggle ${toggleClass}">${toggleText}</button>
                </form>
                <form action="/todos/${t.id}/delete" method="POST" style="display:inline">
                  <button type="submit" class="btn-delete">Delete</button>
                </form>
              </div>
            </div>
          `;
        })
        .join('');
    }

    return res.view('todos/index', { todoListHtml });
  }

  /** POST /todos/create — Handle HTML form submission */
  @Post('/create')
  async createForm(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const body = await req.body<{ title?: string }>();
    if (body && body.title && body.title.trim()) {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await Todo.create({
        title: body.title.trim(),
        completed: 0,
        created_at: now,
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
  async store(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const body = await req.body<{ title?: string; completed?: boolean }>();
    if (!body || !('title' in body) || !body.title) {
      return res.status(400).json({ error: 'title is required' });
    }
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const todo = await Todo.create({
      title: body.title,
      completed: body.completed ? 1 : 0,
      created_at: now,
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
