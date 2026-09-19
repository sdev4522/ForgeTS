import { Controller, Get, Post, Put, Delete } from '@forge/core';
import type { Request, ForgeResponse } from '@forge/core';
import { User } from '../models/User.ts';


@Controller('/user')

export class UserController {

  @Get('/')
  async index(req: Request, res: ForgeResponse) {
    const users = await User.all();
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

    return res.redirect('/about');
  }

  @Put('/:id')
  async update(req: Request, res: ForgeResponse) {
    const user = await User.find(req.params.id);
    if (!user) {
      return res.notFound('User not found');
    }
    const rawBody = typeof (req as any).body === 'function' ? req.body() : (req as any).body;
    const data = rawBody || {};
    user.fill(data);
    await user.save();
    return res.json(user);
  }

  @Delete('/:id')
  async destroy(req: Request, res: ForgeResponse) {
    const user = await User.find(req.params.id);
    if (!user) {
      return res.notFound('User not found');
    }
    await user.delete();
    return res.noContent();
  }
}
