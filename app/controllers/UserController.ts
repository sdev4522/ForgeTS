import { Controller, Get, Post, Put, Delete } from '@forge/core';
import type { Request, ForgeResponse } from '@forge/core';
import { User } from '../models/User.ts';
@Controller('/user')
export class UserController {
  @Get('/')
  async index(_req: Request, res: ForgeResponse) {
    return res.view('user');
  }

  @Get('/:id')
  async show(req: Request, res: ForgeResponse) {
    return res.json({ id: req.params.id });
  }

  @Post('/')
  async store(req: Request, res: ForgeResponse) {
    const userData = req.body

    return res.redirect('/about', {
      user: userData
    });
  }

  @Put('/:id')
  async update(req: Request, res: ForgeResponse) {
    return res.json({ id: req.params.id });
  }

  @Delete('/:id')
  async destroy(_req: Request, res: ForgeResponse) {
    return res.noContent();
  }
}
