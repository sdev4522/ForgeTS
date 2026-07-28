// app/controllers/WelcomeController.ts
// ─────────────────────────────────────────────────────────────────────
// Welcome page controller.
// HTTP request handler only — delegates rendering to resources/views/welcome.html
// ─────────────────────────────────────────────────────────────────────

import { Controller, Get } from '../../packages/forge/src/index.js';
import type { Request, ForgeResponse } from '../../packages/forge/src/index.js';

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
      version: '0.1.0',
      uptime,
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      runtime: `Bun ${typeof Bun !== 'undefined' ? Bun.version : 'Node'}`,
      depCount: '0',
    });
  }
}
