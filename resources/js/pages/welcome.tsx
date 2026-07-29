// resources/js/pages/welcome.tsx
// ─────────────────────────────────────────────────────────────────────
// React SSR Welcome Page Component for ForgeTS.
// ─────────────────────────────────────────────────────────────────────

import React from 'react';

export interface WelcomeProps {
  version?: string;
  name?: string;
  uptime?: string;
  heapUsed?: string;
  runtime?: string;
  depCount?: number | string;
}

export default function WelcomePage({
  version = '0.1.0',
  name = 'ForgeTS',
  uptime = '0s',
  heapUsed = '0 MB',
  runtime = 'Bun 1.3.14',
  depCount = 0,
}: WelcomeProps) {
  return (
    <div className="container">
      {/* Nav */}
      <nav className="animate-in">
        <div className="logo">
          <div className="logo-icon">⚡</div>
          <div className="logo-text"><span>Forge</span>TS</div>
        </div>
        <div className="nav-badge">v{version}</div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-eyebrow animate-in delay-1">
          <span className="dot"></span>
          Server is running
        </div>
        <h1 className="animate-in delay-2">
          Build <span className="gradient">blazing fast</span><br />web apps
        </h1>
        <p className="animate-in delay-3">
          {name} is a batteries-included TypeScript framework running on Bun.
          Laravel's developer experience meets JavaScript's speed.
        </p>
      </section>

      {/* Stats */}
      <div className="stats animate-in delay-3">
        <div className="stat">
          <div className="stat-value">{uptime}</div>
          <div className="stat-label">Uptime</div>
        </div>
        <div className="stat">
          <div className="stat-value">{heapUsed}</div>
          <div className="stat-label">Heap Used</div>
        </div>
        <div className="stat">
          <div className="stat-value">{runtime}</div>
          <div className="stat-label">Runtime</div>
        </div>
        <div className="stat">
          <div className="stat-value">{depCount}</div>
          <div className="stat-label">Dependencies</div>
        </div>
      </div>

      {/* Code Example */}
      <div className="code-section animate-in delay-4">
        <h2>Your First Controller</h2>
        <div className="code-block">
          <div className="code-header">
            <div className="code-dots"><span></span><span></span><span></span></div>
            <div className="code-filename">app/controllers/UserController.ts</div>
          </div>
          <div className="code-body">
            <span className="kw">import</span> {'{ Controller, Get, Post }'} <span className="kw">from</span> <span className="str">'@forge/core'</span>;<br />
            <span className="kw">import type</span> {'{ Request, ForgeResponse }'} <span className="kw">from</span> <span className="str">'@forge/core'</span>;<br /><br />
            <span className="dec">@Controller</span>(<span className="str">'/users'</span>)<br />
            <span className="kw">export class</span> <span className="type">UserController</span> {'{'}<br />
            &nbsp;&nbsp;<span className="dec">@Get</span>(<span className="str">'/'</span>)<br />
            &nbsp;&nbsp;<span className="kw">async</span> <span className="fn">index</span>(req: <span className="type">Request</span>, res: <span className="type">ForgeResponse</span>) {'{'}<br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span className="kw">const</span> users = <span className="kw">await</span> User.<span className="fn">all</span>();<br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span className="kw">return</span> res.<span className="fn">json</span>(users);<br />
            &nbsp;&nbsp;{'}'}<br />
            {'}'}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="features animate-in delay-4">
        <div className="feature">
          <div className="feature-icon">⚡</div>
          <h3>Bun-Native Speed</h3>
          <p>Built on Bun.serve() — no Express, no Koa, no abstraction layers. Raw performance where it matters.</p>
        </div>
        <div className="feature">
          <div className="feature-icon">🎯</div>
          <h3>TC39 Decorators</h3>
          <p>Standard Stage 3 decorators. No experimentalDecorators, no reflect-metadata. Future-proof by default.</p>
        </div>
        <div className="feature">
          <div className="feature-icon">🧩</div>
          <h3>Dependency Injection</h3>
          <p>Lightweight container with singleton and transient lifetimes. Explicit bindings, zero magic.</p>
        </div>
        <div className="feature">
          <div className="feature-icon">🛤️</div>
          <h3>Radix-Trie Router</h3>
          <p>O(path-segments) route matching that doesn't degrade with route count. Static segments checked first.</p>
        </div>
        <div className="feature">
          <div className="feature-icon">🔒</div>
          <h3>Type-Safe Throughout</h3>
          <p>Strict TypeScript with zero any-casts in the public API. Typed request bodies, validated schemas.</p>
        </div>
        <div className="feature">
          <div className="feature-icon">🏗️</div>
          <h3>Laravel-Inspired DX</h3>
          <p>Convention over configuration. Controllers, services, middleware, routes — everything where you'd expect it.</p>
        </div>
      </div>

      {/* Routes Table */}
      <div className="routes-section animate-in delay-5">
        <h2>Registered Routes</h2>
        <table className="routes-table">
          <thead>
            <tr>
              <th>Method</th>
              <th>Path</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="method-badge method-get">GET</span></td>
              <td className="route-path">/</td>
              <td className="route-desc">Welcome page (React SSR)</td>
            </tr>
            <tr>
              <td><span className="method-badge method-get">GET</span></td>
              <td className="route-path">/todos/react</td>
              <td className="route-desc">Todo App (React SSR)</td>
            </tr>
            <tr>
              <td><span className="method-badge method-get">GET</span></td>
              <td className="route-path">/api/health</td>
              <td className="route-desc">Health check (JSON)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <footer className="animate-in delay-5">
        <p>ForgeTS v{version} &nbsp;·&nbsp; Running on {runtime} &nbsp;·&nbsp; React 19 SSR &nbsp;·&nbsp; Built with ⚡</p>
      </footer>
    </div>
  );
}
