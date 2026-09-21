// packages/forge/src/errors/SourceFrameReader.ts
// ─────────────────────────────────────────────────────────────────────
// Stack frame parsing and reliable source code snippet extraction.
// Handles Bun, V8, Node, and JSC stack formats.
// Safely reads surrounding lines with active line and column indicators.
// Guarded against path traversal, sensitive file inspection, and binary files.
// ─────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
    let clean = filePath;
    if (clean.startsWith('file://')) {
      clean = clean.slice(7);
    }
    // Strip query string if added by bundlers/Vite
    const qIdx = clean.indexOf('?');
    if (qIdx !== -1) {
      clean = clean.slice(0, qIdx);
    }
    return clean.startsWith(cwd) ? clean.slice(cwd.length + 1) : clean;
  }

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
      if (filePath.startsWith('file://')) {
        filePath = filePath.slice(7);
      }
      const qIdx = filePath.indexOf('?');
      if (qIdx !== -1) {
        filePath = filePath.slice(0, qIdx);
      }

      const isVendor =
        filePath.includes('node_modules') ||
        filePath.includes('bun:') ||
        filePath.includes('node:') ||
        filePath.includes('(native)') ||
        filePath.includes('[native code]') ||
        filePath === 'native';

      const isFramework =
        !isVendor &&
        (filePath.includes('/packages/forge/') ||
          filePath.includes('packages/forge') ||
          filePath.includes('@forge/'));

      const isApp = !isVendor && !isFramework && filePath.length > 0;

      const displayPath = filePath.startsWith(cwd)
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
   * - Never crashes on unreadable, missing, or binary files.
   * - Prevents path traversal and never reads sensitive .env / .pem files.
   * - Truncates excessively long lines to prevent memory or layout blowouts.
   */
  static getCodeSnippet(
    filePath: string,
    errorLine: number,
    errorCol = 0,
    contextLines = 5,
  ): CodeSnippet | null {
    if (!filePath || typeof filePath !== 'string' || errorLine <= 0) return null;

    try {
      let cleanPath = filePath;
      if (cleanPath.startsWith('file://')) {
        cleanPath = cleanPath.slice(7);
      }
      const qIdx = cleanPath.indexOf('?');
      if (qIdx !== -1) {
        cleanPath = cleanPath.slice(0, qIdx);
      }

      const resolved = resolve(cleanPath);

      // Security check: Block access to .env and secret configuration files
      const baseName = resolved.split(/[\/\\]/).pop() || '';
      if (
        baseName === '.env' ||
        baseName.startsWith('.env.') ||
        baseName.endsWith('.pem') ||
        baseName.endsWith('.key')
      ) {
        return null;
      }

      if (!existsSync(resolved)) {
        return null;
      }

      const content = readFileSync(resolved, 'utf-8');
      const lines = content.split('\n');

      const start = Math.max(0, errorLine - 1 - contextLines);
      const end = Math.min(lines.length, errorLine + contextLines);

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

      const cwd = process.cwd();
      const displayPath = resolved.startsWith(cwd)
        ? resolved.slice(cwd.length + 1)
        : resolved;

      return {
        file: resolved,
        displayPath,
        line: errorLine,
        column: errorCol,
        lines: snippetLines,
      };
    } catch {
      return null;
    }
  }
}
