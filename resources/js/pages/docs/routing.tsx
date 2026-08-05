import React from 'react';
import { DocsLayout } from '../../components/DocsLayout.js';

export default function DocsRouting() {
  return (
    <DocsLayout currentPath="/docs/routing" title="🛣️ Routing & Decorators">
      <p style={{ color: '#cbd5e1', fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '2rem' }}>
        ForgeTS routing is driven by TC39 Stage 3 decorators and explicit controller registration.
      </p>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#818cf8', marginBottom: '1rem' }}>HTTP Method Decorators</h2>
        <pre style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.08)', padding: '1.25rem', borderRadius: '0.5rem', fontFamily: 'monospace', color: '#e2e8f0', overflowX: 'auto' }}>
{`@Controller('/todos')
export class TodoController {
  @Get('/')              // GET /todos
  async index(req, res) {}

  @Get('/:id')           // GET /todos/:id
  async show(req, res) {}

  @Post('/')             // POST /todos
  async store(req, res) {}

  @Put('/:id')            // PUT /todos/:id
  async update(req, res) {}

  @Delete('/:id')         // DELETE /todos/:id
  async destroy(req, res) {}
}`}
        </pre>
      </section>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#818cf8', marginBottom: '1rem' }}>Rate Limiting Decorator</h2>
        <p style={{ color: '#94a3b8', marginBottom: '0.75rem' }}>
          Protect routes with sliding-window rate limiting using <code>@RateLimit(maxAttempts, windowSeconds)</code>.
        </p>
        <pre style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.08)', padding: '1.25rem', borderRadius: '0.5rem', fontFamily: 'monospace', color: '#e2e8f0', overflowX: 'auto' }}>
{`@Post('/')
@RateLimit(5, 60) // Limit to 5 attempts per 60 seconds
async store(req: Request, res: ForgeResponse) {
  return res.created({ status: 'ok' });
}`}
        </pre>
      </section>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#818cf8', marginBottom: '1rem' }}>Request Validation</h2>
        <pre style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.08)', padding: '1.25rem', borderRadius: '0.5rem', fontFamily: 'monospace', color: '#e2e8f0', overflowX: 'auto' }}>
{`const data = await req.validate<{ title: string }>({
  title: 'required|string|min:3',
});`}
        </pre>
      </section>
    </DocsLayout>
  );
}
