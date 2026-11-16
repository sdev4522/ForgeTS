// tests/unit/CompilerErrorDiagnostics.test.ts
// ─────────────────────────────────────────────────────────────────────
// Comprehensive test suite for compiler, build, and syntax error diagnostics.
// Tests Bun AggregateError, BuildMessage, and multi-error inspection.
// ─────────────────────────────────────────────────────────────────────

import { describe, test, expect } from '../harness.js';
import path from 'node:path';
import { ErrorDisplayEngine } from '../../packages/forge/src/http/ErrorDisplayEngine.js';

describe('CompilerErrorDiagnostics — Build & Syntax Error Normalizer', () => {
  const fixtureFile = path.join(process.cwd(), 'tests/fixtures/ErrorSourceFixture.ts');

  test('1. Extracts location and generates code snippet from Bun BuildMessage position', () => {
    const buildMessage = {
      name: 'BuildMessage',
      message: 'Expected ";" but found "invalid"',
      position: {
        file: fixtureFile,
        line: 12,
        column: 7,
        lineText: '    const intentionalSyntaxError = true;',
        length: 7,
        offset: 25,
      },
      line: 0,
      column: 25,
      stack: undefined,
    };

    const diagnostics = ErrorDisplayEngine.extractDiagnostics(buildMessage);

    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].name).toBe('BuildMessage');
    expect(diagnostics[0].message).toBe('Expected ";" but found "invalid"');
    expect(diagnostics[0].location).toBeDefined();
    expect(diagnostics[0].location?.file).toBe(fixtureFile);
    expect(diagnostics[0].location?.line).toBe(12);
    expect(diagnostics[0].location?.column).toBe(7);

    // Verify snippet is automatically generated
    expect(diagnostics[0].snippet).not.toBeNull();
    expect(diagnostics[0].snippet?.line).toBe(12);
    expect(diagnostics[0].snippet?.lines.some((l) => l.isErrorLine)).toBe(true);
  });

  test('2. Deconstructs Bun AggregateError into individually inspectable diagnostics', () => {
    const error1 = {
      name: 'BuildMessage',
      message: 'Expected ";" but found "invalid"',
      position: {
        file: fixtureFile,
        line: 10,
        column: 5,
        lineText: '  public show() {',
      },
      stack: undefined,
    };

    const error2 = {
      name: 'BuildMessage',
      message: 'Expected identifier but found "="',
      position: {
        file: fixtureFile,
        line: 12,
        column: 11,
        lineText: '    const intentionalSyntaxError = true;',
      },
      stack: undefined,
    };

    const aggregateError = new AggregateError(
      [error1, error2],
      `2 errors building "${fixtureFile}"`,
    );

    const diagnostics = ErrorDisplayEngine.extractDiagnostics(aggregateError);

    expect(diagnostics.length).toBe(2);

    // First error
    expect(diagnostics[0].message).toBe('Expected ";" but found "invalid"');
    expect(diagnostics[0].location?.line).toBe(10);
    expect(diagnostics[0].location?.column).toBe(5);
    expect(diagnostics[0].snippet).not.toBeNull();

    // Second error
    expect(diagnostics[1].message).toBe('Expected identifier but found "="');
    expect(diagnostics[1].location?.line).toBe(12);
    expect(diagnostics[1].location?.column).toBe(11);
    expect(diagnostics[1].snippet).not.toBeNull();
  });

  test('3. Renders multi-error tabs and preserves all error details in HTML debug page', () => {
    const error1 = {
      name: 'BuildMessage',
      message: 'Expected ";" but found "invalid"',
      position: {
        file: fixtureFile,
        line: 10,
        column: 5,
      },
    };

    const error2 = {
      name: 'BuildMessage',
      message: 'Expected identifier but found "="',
      position: {
        file: fixtureFile,
        line: 12,
        column: 11,
      },
    };

    const aggregateError = new AggregateError(
      [error1, error2],
      `2 errors building "${fixtureFile}"`,
    );

    const originalDebug = process.env.APP_DEBUG;
    process.env.APP_DEBUG = 'true';

    try {
      const html = ErrorDisplayEngine.renderHtml(aggregateError);

      // Must render multi-error panel
      expect(html).toContain('2 Build Errors');
      expect(html).toContain('Expected &quot;;&quot; but found &quot;invalid&quot;');
      expect(html).toContain('Expected identifier but found &quot;=&quot;');
      expect(html).toContain('ErrorSourceFixture.ts:10');
      expect(html).toContain('ErrorSourceFixture.ts:12');

      // Must render code snippets for compiler errors
      expect(html).toContain('snippet-box');
      expect(html).toContain('line-num');
    } finally {
      process.env.APP_DEBUG = originalDebug;
    }
  });

  test('4. Extracts location from Vite/Rollup loc format', () => {
    const viteError = {
      name: 'RollupError',
      message: 'Unexpected token in module',
      id: fixtureFile,
      loc: {
        file: fixtureFile,
        line: 12,
        column: 11,
      },
    };

    const diagnostics = ErrorDisplayEngine.extractDiagnostics(viteError);
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].location?.file).toBe(fixtureFile);
    expect(diagnostics[0].location?.line).toBe(12);
    expect(diagnostics[0].location?.column).toBe(11);
    expect(diagnostics[0].snippet).not.toBeNull();
  });
});
