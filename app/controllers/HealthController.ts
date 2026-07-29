// app/controllers/HealthController.ts
// ─────────────────────────────────────────────────────────────────────
// Health Check Controller.
// Returns server health & status JSON.
// ─────────────────────────────────────────────────────────────────────

import { Controller, Get, Request, ForgeResponse } from '@forge/core';

@Controller('/health')
export class HealthController {
  @Get('/')
  async check(_req: Request, res: ForgeResponse) {
    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  }

  @Get('/ping')
  async ping(_req: Request, res: ForgeResponse) {
    return res.text('pong');
  }
}
