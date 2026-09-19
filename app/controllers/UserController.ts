import { Controller, Get, Post, Put, Delete } from '@forge/core';
import type { Request, ForgeResponse } from '@forge/core';
import { User } from '../models/User.ts';

@Controller('/user')
export class UserController {

  @Get('/')
  async index(req: Request, res: ForgeResponse) {
    const users = await User.all();
    if (req.wantsJson() && !req.header('accept')?.includes('text/html')) {
      return res.json(users);
    }
    return res.view('user', { userData: users });
  }

  @Get('/:id')
  async show(req: Request, res: ForgeResponse) {
    const user = await User.find(req.params.id);
    if (!user) {
      return res.notFound('User not found');
    }
    return res.json(user);
  }

  @Post('/')
  async store(req: Request, res: ForgeResponse) {
    const rawBody = typeof (req as any).body === 'function' ? req.body() : (req as any).body;
    let data = rawBody;
    if (!data || Object.keys(data).length === 0) {
      try {
        data = await req.json();
      } catch {
        data = {};
      }
    }

    const user = await User.create({
      name: data.name || 'Anonymous',
      email: data.email || 'anon@example.com',
      password: data.password || 'password123',
    });

    if (req.wantsJson() || req.isJson()) {
      return res.created(user);
    }

    return res.redirect('/user');
  }

  @Put('/:id')
  async update(req: Request, res: ForgeResponse) {
    const user = await User.find(req.params.id);
    if (!user) {
      return res.notFound('User not found');
    }
    const rawBody = typeof (req as any).body === 'function' ? req.body() : (req as any).body;
    let data = rawBody || {};
    if (!data || Object.keys(data).length === 0) {
      try {
        data = await req.json();
      } catch {
        data = {};
      }
    }
    user.fill(data);
    await user.save();
    if (req.wantsJson() || req.isJson()) {
      return res.json(user);
    }
    return res.redirect('/user');
  }

  @Post('/:id/update')
  async updatePost(req: Request, res: ForgeResponse) {
    return this.update(req, res);
  }

  @Delete('/:id')
  async destroy(req: Request, res: ForgeResponse) {
    const user = await User.find(req.params.id);
    if (!user) {
      return res.notFound('User not found');
    }
    await user.delete();
    if (req.wantsJson() || req.isJson()) {
      return res.noContent();
    }
    return res.redirect('/user');
  }

  @Post('/:id/delete')
  async destroyPost(req: Request, res: ForgeResponse) {
    return this.destroy(req, res);
  }
}
