import { Controller, Get } from '@forge/core';
import type { Request, ForgeResponse } from '@forge/core';

@Controller('/about')
export class AboutController {
  @Get('/')
  async index(_req: Request, res: ForgeResponse) {
    return res.view('abouts/index');
  }
}
