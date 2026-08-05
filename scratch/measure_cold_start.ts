import { spawn } from 'child_process';

const BUN_PATH = 'C:\\Users\\sdev6\\.bun\\bin\\bun.exe';

async function testColdStart(): Promise<number> {
  const start = performance.now();
  return new Promise((resolve, reject) => {
    const proc = spawn(BUN_PATH, ['run', 'bin/serve.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, APP_DEBUG: 'false', DB_CONNECTION: 'sqlite', NODE_ENV: 'production' }
    });

    const interval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:3000/todos');
        if (res.ok) {
          const elapsed = performance.now() - start;
          clearInterval(interval);
          proc.kill();
          resolve(elapsed);
        }
      } catch (e) {}
    }, 5);

    setTimeout(() => {
      clearInterval(interval);
      proc.kill();
      reject(new Error('Cold start timed out'));
    }, 5000);
  });
}

async function run() {
  console.log('⚡ Measuring Production Cold-Start Time (3 runs)...');
  const times: number[] = [];
  for (let i = 1; i <= 3; i++) {
    const ms = await testColdStart();
    times.push(ms);
    console.log(`   Run ${i}: ${ms.toFixed(2)} ms`);
    await new Promise((r) => setTimeout(r, 500));
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`\n✅ Average Production Cold-Start Time: ${avg.toFixed(2)} ms`);
}

run().catch(console.error);
