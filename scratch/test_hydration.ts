import React from 'react';

const page = 'todos/index';
let hydrationMismatchDetected = false;

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

const originalError = console.error;
const originalWarn = console.warn;

console.log('--- BEFORE (REACT ORIGINAL WARNING ONLY) ---');
console.error('Warning: Text content did not match. Server: "SERVER_VALUE_123" Client: "CLIENT_VALUE_999"');
console.error('An error occurred during hydration. The server HTML was replaced with client content.');

console.log('\n--- AFTER (REACT ORIGINAL WARNING + FORGETS CLEARER GUIDANCE) ---');
console.error = (...args: any[]) => {
  originalError.apply(console, args);
  if (!hydrationMismatchDetected && isHydrationMessage(args[0])) {
    hydrationMismatchDetected = true;
    originalWarn(
      `⚡ [ForgeTS Hydration Warning] Hydration mismatch on page: '${page}'\n` +
        `   This usually means server-rendered props/HTML differ from client props.\n` +
        `   Common causes: non-deterministic values like Date.now() or Math.random(),\n` +
        `   browser-only APIs (window/localStorage) rendered during SSR, or mismatched props.`
    );
  }
};

console.error('Warning: Text content did not match. Server: "SERVER_VALUE_123" Client: "CLIENT_VALUE_999"');
console.error('An error occurred during hydration. The server HTML was replaced with client content.');
