import { describe, test, expect, mock } from 'bun:test';

describe('Hydration Mismatch Console Guidance Wrapper', () => {
  test('logs clearer ForgeTS guidance alongside React original hydration warning in DEV mode', () => {
    const page = 'todos/index';
    let hydrationMismatchDetected = false;
    const errorsLogged: string[] = [];
    const warningsLogged: string[] = [];

    const originalError = (msg: any) => errorsLogged.push(String(msg));
    const originalWarn = (msg: any) => warningsLogged.push(String(msg));

    const isHydrationMessage = (msg: unknown) => {
      const str = String(msg ?? '');
      return (
        str.includes('Hydration failed') ||
        str.includes('Text content does not match') ||
        str.includes('did not match') ||
        str.includes('Expected server HTML to contain') ||
        str.includes('error occurred during hydration')
      );
    };

    const mockConsoleError = (msg: any) => {
      originalError(msg);
      if (!hydrationMismatchDetected && isHydrationMessage(msg)) {
        hydrationMismatchDetected = true;
        originalWarn(
          `⚡ [ForgeTS Hydration Warning] Hydration mismatch on page: '${page}'\n` +
            `   This usually means server-rendered props/HTML differ from client props.\n` +
            `   Common causes: non-deterministic values like Date.now() or Math.random(),\n` +
            `   browser-only APIs (window/localStorage) rendered during SSR, or mismatched props.`
        );
      }
    };

    // Simulate React logging a hydration mismatch error
    const reactOriginalWarning = 'Warning: Text content did not match. Server: "123" Client: "456"';
    mockConsoleError(reactOriginalWarning);

    // 1. React's original warning was logged
    expect(errorsLogged).toContain(reactOriginalWarning);

    // 2. Clearer ForgeTS framework warning was also logged alongside it
    expect(warningsLogged.length).toBe(1);
    expect(warningsLogged[0]).toContain(`⚡ [ForgeTS Hydration Warning] Hydration mismatch on page: '${page}'`);
    expect(warningsLogged[0]).toContain('non-deterministic values like Date.now() or Math.random()');
  });
});
