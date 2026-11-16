// app/controllers/WelcomeController.ts
// ─────────────────────────────────────────────────────────────────────
// Welcome page controller.
// HTTP request handler only — delegates rendering to resources/js/pages.
// ─────────────────────────────────────────────────────────────────────

import { Controller, Get, Post, Request, ForgeResponse, Hash } from '@forge/core';
import packageJson from '../../package.json' with { type: 'json' };
import { User } from '@/models/User.js';

/**
 * Controller responsible for the initial framework landing experience.
 *
 * Renders the welcome page via React SSR (resources/js/pages/welcome.tsx)
 * with the built-in HTML View Engine as a fallback.
 */
@Controller('/')
export class WelcomeController {
  @Get('/')
  async welcome(_req: Request, res: ForgeResponse) {
    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);
    const uptime = hours > 0
      ? `${hours}h ${minutes}m ${seconds}s`
      : minutes > 0
        ? `${minutes}m ${seconds}s`
        : `${seconds}s`;

    return res.view('welcome', {
      version: packageJson.version || '0.1.0',
      uptime,
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      runtime: `Node.js ${process.version}`,
      environment: process.env.NODE_ENV || 'development',
    });
  }

  @Get('/about')
  async about(_req: Request, res: ForgeResponse) {
    return res.view('abouts/index');
  }

  @Get('/user')
  async user(_req: Request, res: ForgeResponse) {
    return res.view('user/index');
  }

  @Post('/user')
  async storeUser(req: Request, res: ForgeResponse) {
    const data = await req.validate<{ name: string; email: string; password: string }>({
      name: 'required|string|max:255',
      email: 'required|email|max:255',
      password: 'required|string|min:8',
    });

    const user = await User.create({
      name: data.name,
      email: data.email,
      password: await Hash.make(data.password),
    });

    // `password` is listed in User.hidden, so the hash is not serialized
    return res.created(user);
  }
}
