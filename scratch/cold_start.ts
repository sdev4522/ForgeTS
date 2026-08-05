import { spawn } from 'child_process';

const BUN_PATH = 'C:\\Users\\sdev6\\.bun\\bin\\bun.exe';

function measureOne(): Promise<number> {
  const start = performance.now();
  return new Promise((resolve) => {
    const proc = spawn(BUN_PATH, ['run', 'bin/serve.ts'], {
      env: { ...process.env, APP_DEBUG: 'false', DB_CONNECTION: 'sqlite', NODE_ENV: 'production' }
    });

    proc.stdout.on('data', (data) => {
      if (data.toString().includes('Ready in')) {
        const elapsed = performance.now() - start;
        proc.kill();
        resolve(elapsed);
      }
    });
  });
}

async function main() {
  console.log('⚡ Measuring Cold Start Time (Process start -> Ready log)...');
  const times: number[] = [];
  for (let i = 1; i <= 3; i++) {
    const t = await measureOne();
    times.push(t);
    console.log(`   Run ${i}: ${t.toFixed(2)} ms`);
    await new Promise(r => setTimeout(r, 200));
  }
  const avg = times.reduce((a,b)=>a+b, 0) / times.length;
  console.log(`\n✅ Average Cold Start Time: ${avg.toFixed(2)} ms`);
}

main().catch(console.error);
