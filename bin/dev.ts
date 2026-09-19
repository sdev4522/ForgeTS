#!/usr/bin/env bun
// bin/dev.ts
// ─────────────────────────────────────────────────────────────────────
// ForgeTS Development Supervisor.
// Monitors backend source files and automatically restarts the server
// process cleanly while preserving Vite HMR for frontend assets.
// Zero external dependencies — built entirely on native Bun capabilities.
// ─────────────────────────────────────────────────────────────────────

import { spawn, type Subprocess } from 'bun';
import { watch, type FSWatcher, existsSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { bootstrapEnv } from '@forge/core';

bootstrapEnv();

export interface DevSupervisorOptions {
  rootDir?: string;
  entryFile?: string;
  debounceMs?: number;
  watchDirs?: string[];
  env?: Record<string, string | undefined>;
}

export class DevSupervisor {
  private rootDir: string;
  private entryFile: string;
  private debounceMs: number;
  private watchDirs: string[];
  private env: Record<string, string | undefined>;

  private child: Subprocess | null = null;
  private watchers: FSWatcher[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isTerminating = false;
  private isRestarting = false;

  constructor(options: DevSupervisorOptions = {}) {
    this.rootDir = options.rootDir ?? process.cwd();
    this.entryFile = options.entryFile ?? join(this.rootDir, 'bin', 'serve.ts');
    this.debounceMs = options.debounceMs ?? 150;
    this.watchDirs = options.watchDirs ?? [
      'app',
      'routes',
      'config',
      'bootstrap',
      'packages/forge/src',
    ];
    this.env = options.env ?? { ...process.env, FORGETS_WORKER: '1' };
  }

  /**
   * Determine if a given changed file path should trigger a backend restart.
   */
  public shouldWatchFile(filepath: string): boolean {
    const normalized = filepath.replace(/\\/g, '/');

    // Skip temporary, swap, and gitkeep files
    if (
      normalized.endsWith('.swp') ||
      normalized.endsWith('.tmp') ||
      normalized.endsWith('~') ||
      normalized.endsWith('.gitkeep') ||
      normalized.includes('/.git/')
    ) {
      return false;
    }

    // Skip frontend assets, views, public directory, storage, and build artifacts
    if (
      normalized.startsWith('resources/') ||
      normalized.startsWith('public/') ||
      normalized.startsWith('storage/') ||
      normalized.startsWith('dist/') ||
      normalized.startsWith('node_modules/') ||
      normalized.includes('/node_modules/')
    ) {
      return false;
    }

    // Check allowed extensions
    const isSourceFile =
      normalized.endsWith('.ts') ||
      normalized.endsWith('.js') ||
      normalized.endsWith('.json') ||
      normalized.endsWith('.env') ||
      normalized === '.env';

    return isSourceFile;
  }

  /**
   * Start the child server process.
   */
  public startChild(): void {
    if (this.isTerminating) return;

    this.child = spawn([process.execPath, 'run', this.entryFile], {
      stdout: 'inherit',
      stderr: 'inherit',
      stdin: 'inherit',
      cwd: this.rootDir,
      env: this.env,
    });

    const activeChild = this.child;
    activeChild.exited.then((code) => {
      if (!this.isRestarting && !this.isTerminating) {
        if (code !== 0) {
          console.error(`\n[ForgeTS] Server process exited with code ${code}. Watching for file fixes...`);
        }
      }
    });
  }

  /**
   * Stop the active child server process gracefully.
   */
  public async stopChild(): Promise<void> {
    if (!this.child) return;

    const current = this.child;
    this.child = null;

    try {
      current.kill('SIGTERM');
      const exited = await Promise.race([
        current.exited,
        new Promise((r) => setTimeout(() => r('timeout'), 1000)),
      ]);

      if (exited === 'timeout') {
        current.kill('SIGKILL');
        await Promise.race([
          current.exited,
          new Promise((r) => setTimeout(r, 500)),
        ]);
      }
    } catch {
      // Process may already have exited
    }
  }

  /**
   * Trigger a debounced restart of the backend server.
   */
  public restart(changedFile: string): void {
    if (this.isTerminating) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      this.isRestarting = true;
      console.log(`\n[ForgeTS] Source change detected: ${changedFile} -> Restarting backend...`);
      await this.stopChild();
      this.isRestarting = false;
      this.startChild();
    }, this.debounceMs);
  }

  /**
   * Start the supervisor: initialize watchers and launch the child process.
   */
  public start(): void {
    console.log('[ForgeTS] Starting development server with auto-restart...');

    // Watch configured backend directories
    for (const dir of this.watchDirs) {
      const fullPath = resolve(this.rootDir, dir);
      if (!existsSync(fullPath)) continue;

      try {
        const watcher = watch(fullPath, { recursive: true }, (_event, filename) => {
          if (!filename) return;
          const relPath = join(dir, filename).replace(/\\/g, '/');
          if (this.shouldWatchFile(relPath)) {
            this.restart(relPath);
          }
        });
        this.watchers.push(watcher);
      } catch (err: any) {
        console.warn(`[ForgeTS] Warning: Could not watch ${dir}:`, err?.message);
      }
    }

    // Watch root .env
    const envPath = resolve(this.rootDir, '.env');
    if (existsSync(envPath)) {
      try {
        const envWatcher = watch(envPath, () => {
          this.restart('.env');
        });
        this.watchers.push(envWatcher);
      } catch {}
    }

    this.startChild();
  }

  /**
   * Stop the supervisor and clean up all resources.
   */
  public async stop(): Promise<void> {
    this.isTerminating = true;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    for (const w of this.watchers) {
      try {
        w.close();
      } catch {}
    }
    this.watchers = [];

    await this.stopChild();
  }
}

// If invoked directly from CLI
if (import.meta.main) {
  const supervisor = new DevSupervisor();

  const handleTermination = async () => {
    await supervisor.stop();
    process.exit(0);
  };

  process.on('SIGINT', handleTermination);
  process.on('SIGTERM', handleTermination);

  supervisor.start();
}
