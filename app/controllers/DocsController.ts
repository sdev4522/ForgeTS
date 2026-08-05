import { Controller, Get, Request, ForgeResponse } from '@forge/core';

@Controller('/docs')
export class DocsController {

  @Get('/')
  async gettingStarted(_req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    return res.view('docs/index').meta({
      title: 'Getting Started — ForgeTS Documentation',
      description: 'Getting started guide for ForgeTS framework.',
    });
  }

  @Get('/routing')
  async routing(_req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    return res.view('docs/routing').meta({
      title: 'Routing & Decorators — ForgeTS Documentation',
      description: 'Routing and decorator guide for ForgeTS framework.',
    });
  }

  @Get('/models')
  async models(_req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    return res.view('docs/models').meta({
      title: 'Active Record Models — ForgeTS Documentation',
      description: 'Active record model and ORM guide for ForgeTS framework.',
    });
  }

  @Get('/views')
  async views(_req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    return res.view('docs/views').meta({
      title: 'Views (HTML & React) — ForgeTS Documentation',
      description: 'HTML View Engine and React SSR guide for ForgeTS framework.',
    });
  }

  @Get('/cli')
  async cli(_req: Request, res: ForgeResponse): Promise<ForgeResponse> {
    return res.view('docs/cli').meta({
      title: 'CLI Scaffolding Commands — ForgeTS Documentation',
      description: 'CLI scaffolding commands guide for ForgeTS framework.',
    });
  }
}
