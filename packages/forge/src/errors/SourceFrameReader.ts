// packages/forge/src/errors/SourceFrameReader.ts
// ─────────────────────────────────────────────────────────────────────
// Stack frame parsing and reliable source code snippet extraction.
// Handles Bun, V8, Node, and JSC stack formats.
// Safely reads surrounding lines with active line and column indicators.
// Guarded against path traversal, sensitive file inspection, and binary files.
// ─────────────────────────────────────────────────────────────────────

import { readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Largest source file the snippet reader will load. */
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
/** Number of parsed source files kept in memory between errors. */
const MAX_CACHED_FILES = 32;

interface CachedSource {
  mtimeMs: number;
  size: number;
  lines: string[];
}

/** Strip `file://` and bundler query strings from a stack-frame path. */
function cleanFilePath(filePath: string): string {
  let clean = filePath;
  if (clean.startsWith('file://')) {
    try {
      clean = fileURLToPath(clean);
    } catch {
      clean = clean.slice(7);
    }
  }
  const qIdx = clean.indexOf('?');
  if (qIdx !== -1) {
    clean = clean.slice(0, qIdx);
  }
  return clean;
}

export interface CodeSnippetLine {
  lineNum: number;
  code: string;
  isErrorLine: boolean;
}

export interface CodeSnippet {
  file: string;
  displayPath: string;
  line: number;
  column: number;
  lines: CodeSnippetLine[];
}

export interface StackFrame {
  raw: string;
  functionName: string;
  file: string;
  displayPath: string;
  line: number;
  column: number;
  isApp: boolean;
  isFramework: boolean;
  isVendor: boolean;
  snippet?: CodeSnippet | null;
}

export class SourceFrameReader {
  /**
   * Derive a clean relative display path if the file is inside the workspace.
   */
  static getDisplayPath(filePath: string): string {
    if (!filePath) return '';
    const cwd = process.cwd();
    const clean = cleanFilePath(filePath);
    return clean.startsWith(cwd + sep) ? clean.slice(cwd.length + 1) : clean;
  }

  private static sourceCache: Map<string, CachedSource> = new Map();

  /**
   * Parse a raw stack trace string into structured, categorized frames.
   */
  static parseStack(rawStack: string): StackFrame[] {
    if (!rawStack || typeof rawStack !== 'string') return [];

    const lines = rawStack.split('\n');
    const frames: StackFrame[] = [];
    const cwd = process.cwd();

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || (!line.startsWith('at ') && !line.includes('@'))) continue;

      // Match common Bun / V8 / Node / JSC formats:
      // at fn (/path/file.ts:10:5)
      // at /path/file.ts:10:5
      // at async fn (/path/file.ts:10:5)
      // fn@/path/file.ts:10:5
      const v8Match =
        line.match(/^at\s+(?:async\s+)?(?:(.+?)\s+\((.+?):(\d+):(\d+)\)|(.+?):(\d+):(\d+))$/) ||
        line.match(/^at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)$/);

      const jscMatch = !v8Match ? line.match(/^(?:(.*?)@)?(.+?):(\d+):(\d+)$/) : null;

      let fnName = '<anonymous>';
      let filePath = '';
      let lineNum = 0;
      let colNum = 0;

      if (v8Match) {
        if (v8Match[2]) {
          fnName = v8Match[1] || '<anonymous>';
          filePath = v8Match[2];
          lineNum = parseInt(v8Match[3], 10) || 0;
          colNum = parseInt(v8Match[4], 10) || 0;
        } else if (v8Match[5]) {
          fnName = '<anonymous>';
          filePath = v8Match[5];
          lineNum = parseInt(v8Match[6], 10) || 0;
          colNum = parseInt(v8Match[7], 10) || 0;
        }
      } else if (jscMatch) {
        fnName = jscMatch[1] || '<anonymous>';
        filePath = jscMatch[2];
        lineNum = parseInt(jscMatch[3], 10) || 0;
        colNum = parseInt(jscMatch[4], 10) || 0;
      } else {
        // Fallback for native or unparsed lines
        frames.push({
          raw: line,
          functionName: line.replace(/^at\s+/, ''),
          file: '',
          displayPath: '',
          line: 0,
          column: 0,
          isApp: false,
          isFramework: false,
          isVendor: true,
        });
        continue;
      }

      // Clean file path (strip file:// and query params)
      filePath = cleanFilePath(filePath);

      const isVendor =
        filePath.includes('node_modules') ||
        filePath.startsWith('bun:') ||
        filePath.startsWith('node:') ||
        filePath.startsWith('internal/') ||
        filePath.includes('(native)') ||
        filePath.includes('[native code]') ||
        filePath === 'native';

      const isFramework =
        !isVendor &&
        (filePath.includes('/packages/forge/') ||
          filePath.includes('packages/forge') ||
          filePath.includes('@forge/'));

      const isApp = !isVendor && !isFramework && filePath.length > 0;

      const displayPath = filePath.startsWith(cwd + sep)
        ? filePath.slice(cwd.length + 1)
        : filePath;

      frames.push({
        raw: line,
        functionName: fnName.trim(),
        file: filePath,
        displayPath,
        line: lineNum,
        column: colNum,
        isApp,
        isFramework,
        isVendor,
      });
    }

    return frames;
  }

  /**
   * Safely load source code surrounding an error line.
   * Guarantees:
   * - Never crashes on unreadable, missing, oversized, or binary files.
   * - Only reads files inside the project directory (process.cwd()); paths that
   *   resolve elsewhere — e.g. taken from a crafted error message — are refused.
   * - Never reads dotfiles, .env files, or key material.
   * - Truncates excessively long lines to prevent memory or layout blowouts.
   * - Parsed files are cached, so many frames in one file cost a single read.
   */
  static getCodeSnippet(
    filePath: string,
    errorLine: number,
    errorCol = 0,
    contextLines = 5,
  ): CodeSnippet | null {
    if (!filePath || typeof filePath !== 'string') return null;
    if (!Number.isInteger(errorLine) || errorLine <= 0) return null;

    try {
      const resolved = resolve(cleanFilePath(filePath));
      const cwd = process.cwd();

      // Security check: stay inside the project root
      if (!resolved.startsWith(cwd + sep)) {
        return null;
      }

      // Security check: block dotfiles, .env files and secret/key material
      const relativeParts = resolved.slice(cwd.length + 1).split(/[\/\\]/);
      const baseName = relativeParts[relativeParts.length - 1] ?? '';
      if (
        baseName.startsWith('.') ||
        /\.(pem|key|p12|pfx|crt|cer|sqlite|db)$/i.test(baseName) ||
        relativeParts.includes('.git') ||
        relativeParts.includes('storage')
      ) {
        return null;
      }

      const lines = this.loadSourceLines(resolved);
      if (!lines) return null;

      const safeContext = Math.min(Math.max(0, Math.trunc(contextLines) || 0), 50);
      const start = Math.max(0, errorLine - 1 - safeContext);
      const end = Math.min(lines.length, errorLine + safeContext);

      const snippetLines: CodeSnippetLine[] = [];

      for (let i = start; i < end; i++) {
        const lineNum = i + 1;
        let lineCode = lines[i] ?? '';
        if (lineCode.length > 300) {
          lineCode = lineCode.slice(0, 300) + '... [truncated]';
        }

        snippetLines.push({
          lineNum,
          code: lineCode,
          isErrorLine: lineNum === errorLine,
        });
      }

      return {
        file: resolved,
        displayPath: resolved.slice(cwd.length + 1),
        line: errorLine,
        column: Number.isFinite(errorCol) ? errorCol : 0,
        lines: snippetLines,
      };
    } catch {
      return null;
    }
  }

  /**
   * Read a source file as lines, with an mtime-validated in-memory cache.
   * Returns null for missing, non-regular, oversized, or binary files.
   */
  private static loadSourceLines(resolved: string): string[] | null {
    let info;
    try {
      info = statSync(resolved);
    } catch {
      return null;
    }
    if (!info.isFile() || info.size > MAX_SOURCE_BYTES) return null;

    const cached = this.sourceCache.get(resolved);
    if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) {
      return cached.lines;
    }

    const content = readFileSync(resolved, 'utf-8');
    if (content.includes('\u0000')) return null; // binary

    const lines = content.split(/\r?\n/);
    this.sourceCache.delete(resolved);
    this.sourceCache.set(resolved, { mtimeMs: info.mtimeMs, size: info.size, lines });
    if (this.sourceCache.size > MAX_CACHED_FILES) {
      const oldest = this.sourceCache.keys().next().value;
      if (oldest !== undefined) this.sourceCache.delete(oldest);
    }
    return lines;
  }
}
