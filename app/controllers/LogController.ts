// app/controllers/LogController.ts
import { Controller, Get, Post, Request, ForgeResponse, now } from '@forge/core';
import { LogEntry } from '../models/LogEntry.js';

@Controller('/logs')
export class LogController {
  @Get('/')
  async index(_req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    const logs = await LogEntry.all();
    return res.json(logs.map((l) => l.toJSON()));
  }

  @Post('/bench')
  async store(req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    let body: any = {};
    try {
      body = await req.body();
    } catch {
      body = {};
    }
    const log = await LogEntry.create({
      level: body?.level || 'info',
      message: body?.message || 'Benchmark log message',
      created_at: now().toDateTimeString(),
    });
    return res.status(201).json(log.toJSON());
  }
}
