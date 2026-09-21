import { Controller, Get, Post, Put, Delete } from '@forge/core';
import type { Request, ForgeResponse } from '@forge/core';
import { User } from '@/models/User.js';

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
    let data = req.body<Record<string, any>>() || {};
    if (!data || Object.keys(data).length === 0) {
      try {
        data = await req.json();
      } catch {
        data = {};
      }
    }

    if (!data.name || !data.email) {
      return res.badRequest('Name and email are required');
    }

    const user = await User.create({
      name: String(data.name).trim(),
      email: String(data.email).trim(),
      password: data.password ? String(data.password) : '',
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
    let data = req.body<Record<string, any>>() || {};
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
