// app/controllers/WelcomeController.ts
// ─────────────────────────────────────────────────────────────────────
// Welcome page + user sign-up.
// Handlers return what they want sent: a view, a model, a redirect…
// ─────────────────────────────────────────────────────────────────────

import { Controller, Get, Post, Hash, view, created, type Request } from '@forge/core';
import packageJson from '../../package.json' with { type: 'json' };
import { User } from '@/models/User.js';

@Controller('/')
export class WelcomeController {
  @Get('/')
  welcome() {
    const seconds = Math.floor(process.uptime());
    const uptime = [
      seconds >= 3600 ? `${Math.floor(seconds / 3600)}h` : '',
      seconds >= 60 ? `${Math.floor((seconds % 3600) / 60)}m` : '',
      `${seconds % 60}s`,
    ].filter(Boolean).join(' ');

    return view('welcome', {
      version: packageJson.version || '0.1.0',
      uptime,
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      runtime: `Node.js ${process.version}`,
      environment: process.env.NODE_ENV || 'development',
    });
  }

  @Post('/user')
  async storeUser(req: Request) {
    const data = await req.validate({
      name: 'required|string|max:255',
      email: 'required|email|max:255',
      password: 'required|string|min:8',
    });

    // `password` is in User.hidden, so the hash never appears in the response
    return created(await User.create({ ...data, password: await Hash.make(data.password) }));
  }
}
