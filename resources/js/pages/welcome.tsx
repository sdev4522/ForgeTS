// resources/js/pages/welcome.tsx
// ─────────────────────────────────────────────────────────────────────
// Professional React SSR Welcome Page Component for ForgeTS.
// Displays framework architecture, core capabilities, real code examples,
// and live runtime diagnostics with zero emojis and accessible design.
// ─────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';

export interface WelcomeProps {
  version?: string;
  uptime?: string;
  heapUsed?: string;
  runtime?: string;
  environment?: string;
}

export default function WelcomePage({
  version = '0.1.0',
  uptime = '0s',
  heapUsed = '0 MB',
  runtime = 'Node.js 24+',
  environment = 'development',
}: WelcomeProps) {
  const [copied, setCopied] = useState(false);

  const copyQuickstart = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText('npm install && npm run dev');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="forge-welcome">
      <style>{`
        .forge-welcome {
          --fw-bg: #0b0f19;
          --fw-surface: #111827;
          --fw-surface-elevated: #1a2234;
          --fw-border: #1f293d;
          --fw-border-highlight: #374151;
          --fw-text-primary: #f9fafb;
          --fw-text-secondary: #9ca3af;
          --fw-text-muted: #6b7280;
          --fw-primary: #6366f1;
          --fw-primary-hover: #4f46e5;
          --fw-accent: #0ea5e9;
          --fw-success: #10b981;
          --fw-font-sans: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          --fw-font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          
          min-height: 100vh;
          background: var(--fw-bg);
          color: var(--fw-text-primary);
          font-family: var(--fw-font-sans);
          line-height: 1.5;
          padding: 0;
          margin: 0;
          box-sizing: border-box;
          width: 100%;
        }

        .forge-welcome * {
          box-sizing: border-box;
        }

        .fw-container {
          max-width: 1160px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* ── Header ── */
        .fw-header {
          border-bottom: 1px solid var(--fw-border);
          background: rgba(11, 15, 25, 0.85);
          backdrop-filter: blur(12px);
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .fw-header-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 68px;
        }

        .fw-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: var(--fw-text-primary);
        }

        .fw-logo-badge {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: linear-gradient(135deg, #6366f1, #0ea5e9);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 16px;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
        }

        .fw-brand-text {
          font-size: 19px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        .fw-brand-text span {
          color: #818cf8;
        }

        .fw-version-tag {
          font-size: 11px;
          font-family: var(--fw-font-mono);
          padding: 2px 8px;
          border-radius: 9999px;
          background: rgba(99, 102, 241, 0.12);
          color: #a5b4fc;
          border: 1px solid rgba(99, 102, 241, 0.3);
        }

        .fw-nav {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .fw-nav-link {
          color: var(--fw-text-secondary);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.15s ease;
        }

        .fw-nav-link:hover {
          color: var(--fw-text-primary);
        }

        .fw-nav-cta {
          display: inline-flex;
          align-items: center;
          padding: 8px 16px;
          background: var(--fw-primary);
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          border-radius: 6px;
          text-decoration: none;
          transition: background 0.15s ease;
        }

        .fw-nav-cta:hover {
          background: var(--fw-primary-hover);
        }

        /* ── Hero ── */
        .fw-hero {
          padding: 72px 0 56px;
          text-align: center;
        }

        .fw-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 4px 14px;
          border-radius: 9999px;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.25);
          color: #34d399;
          font-size: 12px;
          font-weight: 500;
          margin-bottom: 24px;
        }

        .fw-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
        }

        .fw-hero-title {
          font-size: clamp(34px, 5vw, 56px);
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -1.5px;
          max-width: 900px;
          margin: 0 auto 20px;
        }

        .fw-hero-highlight {
          background: linear-gradient(135deg, #a5b4fc 0%, #38bdf8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .fw-hero-subtitle {
          font-size: 18px;
          color: var(--fw-text-secondary);
          max-width: 680px;
          margin: 0 auto 36px;
          line-height: 1.6;
        }

        .fw-hero-actions {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 48px;
        }

        .fw-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 26px;
          background: var(--fw-primary);
          color: #ffffff;
          font-weight: 600;
          font-size: 15px;
          border-radius: 8px;
          text-decoration: none;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
          transition: transform 0.15s ease, background 0.15s ease;
        }

        .fw-btn-primary:hover {
          background: var(--fw-primary-hover);
          transform: translateY(-1px);
        }

        .fw-btn-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 24px;
          background: var(--fw-surface);
          color: var(--fw-text-primary);
          border: 1px solid var(--fw-border-highlight);
          font-weight: 600;
          font-size: 15px;
          border-radius: 8px;
          text-decoration: none;
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .fw-btn-secondary:hover {
          background: var(--fw-surface-elevated);
          border-color: #4b5563;
        }

        /* ── Terminal Quickstart ── */
        .fw-quickstart-box {
          max-width: 580px;
          margin: 0 auto;
          background: #090d16;
          border: 1px solid var(--fw-border);
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        }

        .fw-terminal-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid var(--fw-border);
        }

        .fw-terminal-dots {
          display: flex;
          gap: 6px;
        }

        .fw-terminal-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #283347;
        }

        .fw-terminal-title {
          font-family: var(--fw-font-mono);
          font-size: 11px;
          color: var(--fw-text-muted);
        }

        .fw-terminal-body {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          font-family: var(--fw-font-mono);
          font-size: 13.5px;
          color: #e5e7eb;
        }

        .fw-prompt-sign {
          color: #6366f1;
          margin-right: 10px;
          user-select: none;
        }

        .fw-copy-btn {
          background: transparent;
          border: 1px solid var(--fw-border);
          color: var(--fw-text-muted);
          padding: 4px 10px;
          font-size: 11px;
          font-family: var(--fw-font-sans);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .fw-copy-btn:hover {
          color: var(--fw-text-primary);
          border-color: var(--fw-border-highlight);
        }

        /* ── Telemetry Diagnostics ── */
        .fw-telemetry-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin: 48px 0 72px;
        }

        .fw-telemetry-card {
          background: var(--fw-surface);
          border: 1px solid var(--fw-border);
          border-radius: 12px;
          padding: 20px;
          text-align: left;
        }

        .fw-telemetry-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--fw-text-muted);
          margin-bottom: 6px;
          font-weight: 500;
        }

        .fw-telemetry-value {
          font-size: 22px;
          font-family: var(--fw-font-mono);
          font-weight: 700;
          color: var(--fw-text-primary);
        }

        /* ── Architecture Flow Section ── */
        .fw-section {
          padding: 60px 0;
          border-top: 1px solid var(--fw-border);
        }

        .fw-section-header {
          text-align: center;
          margin-bottom: 48px;
        }

        .fw-section-eyebrow {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #818cf8;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .fw-section-title {
          font-size: 30px;
          font-weight: 700;
          letter-spacing: -0.5px;
          color: var(--fw-text-primary);
        }

        .fw-flow-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          position: relative;
        }

        .fw-flow-card {
          background: var(--fw-surface);
          border: 1px solid var(--fw-border);
          border-radius: 12px;
          padding: 24px;
          position: relative;
        }

        .fw-flow-step {
          font-family: var(--fw-font-mono);
          font-size: 12px;
          color: #818cf8;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .fw-flow-name {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .fw-flow-desc {
          font-size: 13.5px;
          color: var(--fw-text-secondary);
          line-height: 1.5;
        }

        /* ── Code Demo Section ── */
        .fw-code-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
          align-items: start;
        }

        .fw-code-info {
          padding-top: 12px;
        }

        .fw-code-info h3 {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 12px;
          letter-spacing: -0.3px;
        }

        .fw-code-info p {
          color: var(--fw-text-secondary);
          font-size: 15px;
          line-height: 1.6;
          margin-bottom: 20px;
        }

        .fw-feature-checklist {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .fw-feature-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          color: var(--fw-text-secondary);
        }

        .fw-tag {
          font-size: 11px;
          font-family: var(--fw-font-mono);
          padding: 2px 6px;
          background: var(--fw-surface-elevated);
          border: 1px solid var(--fw-border-highlight);
          border-radius: 4px;
          color: #38bdf8;
        }

        .fw-code-window {
          background: #090d16;
          border: 1px solid var(--fw-border);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4);
        }

        .fw-code-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 18px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid var(--fw-border);
        }

        .fw-code-filename {
          font-family: var(--fw-font-mono);
          font-size: 12px;
          color: var(--fw-text-secondary);
        }

        .fw-code-pre {
          margin: 0;
          padding: 20px;
          font-family: var(--fw-font-mono);
          font-size: 13px;
          line-height: 1.7;
          overflow-x: auto;
          color: #e2e8f0;
        }

        .syn-kw { color: #c084fc; font-weight: 600; }
        .syn-dec { color: #f59e0b; }
        .syn-str { color: #34d399; }
        .syn-type { color: #38bdf8; }
        .syn-fn { color: #60a5fa; }
        .syn-cm { color: #6b7280; font-style: italic; }

        /* ── Pillars Grid ── */
        .fw-pillars-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        .fw-pillar-card {
          background: var(--fw-surface);
          border: 1px solid var(--fw-border);
          border-radius: 12px;
          padding: 24px;
          transition: border-color 0.15s ease, transform 0.15s ease;
        }

        .fw-pillar-card:hover {
          border-color: var(--fw-border-highlight);
          transform: translateY(-2px);
        }

        .fw-pillar-badge {
          display: inline-block;
          font-size: 11px;
          font-family: var(--fw-font-mono);
          color: #818cf8;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.2);
          padding: 2px 8px;
          border-radius: 4px;
          margin-bottom: 14px;
          font-weight: 500;
        }

        .fw-pillar-title {
          font-size: 17px;
          font-weight: 600;
          margin-bottom: 8px;
          color: var(--fw-text-primary);
        }

        .fw-pillar-text {
          font-size: 13.5px;
          color: var(--fw-text-secondary);
          line-height: 1.55;
        }

        /* ── Footer ── */
        .fw-footer {
          border-top: 1px solid var(--fw-border);
          padding: 48px 0;
          margin-top: 40px;
        }

        .fw-footer-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 20px;
        }

        .fw-footer-meta {
          font-size: 13.5px;
          color: var(--fw-text-muted);
        }

        .fw-footer-links {
          display: flex;
          gap: 20px;
        }

        .fw-footer-link {
          color: var(--fw-text-secondary);
          text-decoration: none;
          font-size: 13.5px;
          transition: color 0.15s ease;
        }

        .fw-footer-link:hover {
          color: var(--fw-text-primary);
        }

        /* ── Responsive ── */
        @media (max-width: 960px) {
          .fw-flow-grid { grid-template-columns: repeat(2, 1fr); }
          .fw-telemetry-grid { grid-template-columns: repeat(2, 1fr); }
          .fw-pillars-grid { grid-template-columns: repeat(2, 1fr); }
          .fw-code-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 640px) {
          .fw-hero { padding: 48px 0 36px; }
          .fw-flow-grid { grid-template-columns: 1fr; }
          .fw-telemetry-grid { grid-template-columns: 1fr; }
          .fw-pillars-grid { grid-template-columns: 1fr; }
          .fw-footer-inner { flex-direction: column; text-align: center; }
          .fw-nav { display: none; }
        }
      `}</style>

      {/* Navigation */}
      <header className="fw-header">
        <div className="fw-container fw-header-inner">
          <a href="/" className="fw-brand">
            <div className="fw-logo-badge">F</div>
            <div className="fw-brand-text">Forge<span>TS</span></div>
            <span className="fw-version-tag">v{version}</span>
          </a>
          <nav className="fw-nav">
            <a href="/about" className="fw-nav-link">About</a>
            <a href="/user" className="fw-nav-link">Users</a>
            <a href="/docs" className="fw-nav-cta">Get Started</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="fw-hero">
        <div className="fw-container">
          <div className="fw-pill">
            <span className="fw-status-dot"></span>
            Server Ready &middot; {runtime}
          </div>
          <h1 className="fw-hero-title">
            The structure of Laravel.<br />
            The speed of <span className="fw-hero-highlight">Node.js &amp; TypeScript — Vite HMR Preserved</span>.
          </h1>
          <p className="fw-hero-subtitle">
            ForgeTS is a batteries-included, TypeScript-first web framework designed for developer velocity.
            Unified Active Record ORM, TC39 Stage 3 decorators, radix-trie routing, and server-side rendering.
          </p>

          <div className="fw-hero-actions">
            <a href="/user" className="fw-btn-primary">Manage Users (CRUD)</a>
            <a href="/about" className="fw-btn-secondary">About Framework</a>
          </div>

          <div className="fw-quickstart-box">
            <div className="fw-terminal-bar">
              <div className="fw-terminal-dots">
                <span className="fw-terminal-dot"></span>
                <span className="fw-terminal-dot"></span>
                <span className="fw-terminal-dot"></span>
              </div>
              <span className="fw-terminal-title">Terminal Quickstart</span>
              <button onClick={copyQuickstart} className="fw-copy-btn">
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="fw-terminal-body">
              <span><span className="fw-prompt-sign">$</span>forge serve</span>
              <span style={{ color: '#6b7280', fontSize: '12px' }}>Port 3000</span>
            </div>
          </div>
        </div>
      </section>

      {/* Diagnostics / Telemetry */}
      <section className="fw-container">
        <div className="fw-telemetry-grid">
          <div className="fw-telemetry-card">
            <div className="fw-telemetry-label">Runtime Engine</div>
            <div className="fw-telemetry-value">{runtime}</div>
          </div>
          <div className="fw-telemetry-card">
            <div className="fw-telemetry-label">Framework Release</div>
            <div className="fw-telemetry-value">v{version}</div>
          </div>
          <div className="fw-telemetry-card">
            <div className="fw-telemetry-label">Process Uptime</div>
            <div className="fw-telemetry-value">{uptime}</div>
          </div>
          <div className="fw-telemetry-card">
            <div className="fw-telemetry-label">Active Heap</div>
            <div className="fw-telemetry-value">{heapUsed}</div>
          </div>
        </div>
      </section>

      {/* Architectural Flow */}
      <section className="fw-section">
        <div className="fw-container">
          <div className="fw-section-header">
            <div className="fw-section-eyebrow">Architecture Flow</div>
            <h2 className="fw-section-title">Enforced Separation of Concerns</h2>
          </div>
          <div className="fw-flow-grid">
            <div className="fw-flow-card">
              <div className="fw-flow-step">STEP 01</div>
              <div className="fw-flow-name">Controller</div>
              <div className="fw-flow-desc">
                Thin HTTP request entrypoint handling routing parameters, input validation, and HTTP response framing.
              </div>
            </div>
            <div className="fw-flow-card">
              <div className="fw-flow-step">STEP 02</div>
              <div className="fw-flow-name">Service</div>
              <div className="fw-flow-desc">
                Domain business logic registered in the DI container with explicit singleton or transient lifecycles.
              </div>
            </div>
            <div className="fw-flow-card">
              <div className="fw-flow-step">STEP 03</div>
              <div className="fw-flow-name">Model</div>
              <div className="fw-flow-desc">
                Active Record entity defining typed attributes, relationships, mass-assignment rules, and queries.
              </div>
            </div>
            <div className="fw-flow-card">
              <div className="fw-flow-step">STEP 04</div>
              <div className="fw-flow-name">Database</div>
              <div className="fw-flow-desc">
                Connection pool managing query execution across MySQL relational storage and MongoDB document engines.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Real Code Demonstration */}
      <section className="fw-section">
        <div className="fw-container">
          <div className="fw-code-grid">
            <div className="fw-code-info">
              <div className="fw-section-eyebrow">Developer Experience</div>
              <h3>Modern TypeScript Conventions</h3>
              <p>
                ForgeTS uses TC39 Stage 3 standard decorators and clean class composition.
                Controllers declare routing annotations, inject services, and return typed responses with zero boilerplate.
              </p>
              <ul className="fw-feature-checklist">
                <li className="fw-feature-item">
                  <span className="fw-tag">TC39 Stage 3</span> Standard context.metadata metadata registration
                </li>
                <li className="fw-feature-item">
                  <span className="fw-tag">IoC Container</span> Constructor injection with recursive resolution
                </li>
                <li className="fw-feature-item">
                  <span className="fw-tag">Active Record</span> Eloquent-style query builder on Kysely
                </li>
                <li className="fw-feature-item">
                  <span className="fw-tag">Security</span> Automatic CSRF verification and rate limiting
                </li>
              </ul>
            </div>

            <div className="fw-code-window">
              <div className="fw-code-bar">
                <div className="fw-terminal-dots">
                  <span className="fw-terminal-dot"></span>
                  <span className="fw-terminal-dot"></span>
                  <span className="fw-terminal-dot"></span>
                </div>
                <span className="fw-code-filename">app/controllers/UserController.ts</span>
                <span style={{ color: '#6b7280', fontSize: '11px' }}>TypeScript</span>
              </div>
              <pre className="fw-code-pre">
                <code>
                  <span className="syn-kw">import</span> {'{ Controller, Get, Post }'} <span className="syn-kw">from</span> <span className="syn-str">'@forge/core'</span>;<br />
                  <span className="syn-kw">import type</span> {'{ Request, ForgeResponse }'} <span className="syn-kw">from</span> <span className="syn-str">'@forge/core'</span>;<br />
                  <span className="syn-kw">import</span> {'{ User }'} <span className="syn-kw">from</span> <span className="syn-str">'@/models/User.js'</span>;<br /><br />
                  <span className="syn-dec">@Controller</span>(<span className="syn-str">'/user'</span>)<br />
                  <span className="syn-kw">export class</span> <span className="syn-type">UserController</span> {'{'}<br />
                  &nbsp;&nbsp;<span className="syn-dec">@Get</span>(<span className="syn-str">'/'</span>)<br />
                  &nbsp;&nbsp;<span className="syn-kw">async</span> <span className="syn-fn">index</span>(_req: <span className="syn-type">Request</span>, res: <span className="syn-type">ForgeResponse</span>) {'{'}<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="syn-kw">const</span> users = <span className="syn-kw">await</span> User.<span className="syn-fn">all</span>();<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="syn-kw">return</span> res.<span className="syn-fn">view</span>(<span className="syn-str">'user'</span>, {'{ userData: users }'});<br />
                  &nbsp;&nbsp;{'}'}<br /><br />
                  &nbsp;&nbsp;<span className="syn-dec">@Post</span>(<span className="syn-str">'/'</span>)<br />
                  &nbsp;&nbsp;<span className="syn-kw">async</span> <span className="syn-fn">store</span>(req: <span className="syn-type">Request</span>, res: <span className="syn-type">ForgeResponse</span>) {'{'}<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="syn-kw">const</span> data = req.<span className="syn-fn">body</span>();<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="syn-kw">await</span> User.<span className="syn-fn">create</span>(data);<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="syn-kw">return</span> res.<span className="syn-fn">redirect</span>(<span className="syn-str">'/user'</span>);<br />
                  &nbsp;&nbsp;{'}'}<br />
                  {'}'}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Framework Pillars Grid */}
      <section className="fw-section">
        <div className="fw-container">
          <div className="fw-section-header">
            <div className="fw-section-eyebrow">Core Engine</div>
            <h2 className="fw-section-title">Built for Production Workloads</h2>
          </div>
          <div className="fw-pillars-grid">
            <div className="fw-pillar-card">
              <span className="fw-pillar-badge">Performance</span>
              <h3 className="fw-pillar-title">Lean Node.js Engine</h3>
              <p className="fw-pillar-text">
                Built directly on node:http without intermediate Express or Koa overhead. Radix-trie routing and minimal memory consumption.
              </p>
            </div>
            <div className="fw-pillar-card">
              <span className="fw-pillar-badge">Standards</span>
              <h3 className="fw-pillar-title">TC39 Stage 3 Decorators</h3>
              <p className="fw-pillar-text">
                Native metadata context compliant with the latest ECMAScript specification. Completely free of legacy reflect-metadata dependencies.
              </p>
            </div>
            <div className="fw-pillar-card">
              <span className="fw-pillar-badge">Routing</span>
              <h3 className="fw-pillar-title">Radix-Trie Matcher</h3>
              <p className="fw-pillar-text">
                High-performance deterministic URL segment tree matching with support for dynamic parameter extraction and route groupings.
              </p>
            </div>
            <div className="fw-pillar-card">
              <span className="fw-pillar-badge">Storage</span>
              <h3 className="fw-pillar-title">Active Record ORM</h3>
              <p className="fw-pillar-text">
                Unified Active Record pattern providing consistent .find(), .where(), .create(), and .save() operations across MySQL and MongoDB.
              </p>
            </div>
            <div className="fw-pillar-card">
              <span className="fw-pillar-badge">Frontend</span>
              <h3 className="fw-pillar-title">React 19 SSR &amp; HTML Views</h3>
              <p className="fw-pillar-text">
                Integrated Vite dev server in development and pre-compiled client and SSR bundles with page chunk preloading in production.
              </p>
            </div>
            <div className="fw-pillar-card">
              <span className="fw-pillar-badge">Security</span>
              <h3 className="fw-pillar-title">Protection by Default</h3>
              <p className="fw-pillar-text">
                Synchronized CSRF token verification, sliding-window rate limiting, input validation pipelines, and automated secret redaction.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="fw-footer">
        <div className="fw-container fw-footer-inner">
          <div className="fw-footer-meta">
            ForgeTS Framework &middot; TypeScript on Node.js &middot; Environment: {environment}
          </div>
          <div className="fw-footer-links">
            <a href="/" className="fw-footer-link">Home</a>
            <a href="/about" className="fw-footer-link">About</a>
            <a href="/user" className="fw-footer-link">User Management</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
