// app/controllers/HealthController.ts
// ─────────────────────────────────────────────────────────────────────
// Health check controller.
// Returns server status, uptime, and memory usage.
// Used for load balancer health checks and monitoring.
// ─────────────────────────────────────────────────────────────────────

import { Controller, Get } from '../../packages/forge/src/index.js';
import type { Request, ForgeResponse } from '../../packages/forge/src/index.js';

@Controller('/health')
export class HealthController {
  @Get('/')
  async check(_req: Request, res: ForgeResponse) {
    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      },
    });
  }

  @Get('/ping')
  async ping(_req: Request, res: ForgeResponse) {
    return res.text('pong');
  }
}
