import { spawn } from 'child_process';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { gzipSync } from 'zlib';

const BUN_PATH = 'C:\\Users\\sdev6\\.bun\\bin\\bun.exe';

interface BundleFile {
  filename: string;
  sizeBytes: number;
  sizeKb: string;
  gzipBytes: number;
  gzipKb: string;
}

async function measureColdStart(): Promise<number> {
  const startTime = performance.now();
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      APP_DEBUG: 'false',
      DB_CONNECTION: 'sqlite',
      NODE_ENV: 'production',
      PORT: '3005', // Use test port to avoid conflicts
    };

    const proc = spawn(BUN_PATH, ['run', 'bin/serve.ts'], { env });
    let isReady = false;

    const checkHealth = async () => {
      try {
        const res = await fetch('http://localhost:3005/todos');
        if (res.ok && !isReady) {
          isReady = true;
          const elapsed = performance.now() - startTime;
          proc.kill();
          resolve(elapsed);
        }
      } catch (e) {
        if (!isReady) setTimeout(checkHealth, 5);
      }
    };

    proc.stdout.on('data', (d) => {
      const str = d.toString();
      if (str.includes('Ready in') || str.includes('Server:')) {
        checkHealth();
      }
    });

    proc.stderr.on('data', () => {});

    setTimeout(checkHealth, 10);

    setTimeout(() => {
      if (!isReady) {
        proc.kill();
        reject(new Error('Cold-start measurement timed out (5s)'));
      }
    }, 5000);
  });
}

function measureBundleSize() {
  const distDir = join(process.cwd(), 'dist', 'client');
  const files: BundleFile[] = [];

  function scan(dir: string) {
    try {
      const list = readdirSync(dir);
      for (const item of list) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          scan(fullPath);
        } else if (item.endsWith('.js') || item.endsWith('.css') || item.endsWith('.json')) {
          const content = readFileSync(fullPath);
          const gzipped = gzipSync(content);
          const relPath = fullPath.replace(distDir, '').replace(/^[/\\]/, '');

          files.push({
            filename: relPath,
            sizeBytes: content.length,
            sizeKb: (content.length / 1024).toFixed(2) + ' KB',
            gzipBytes: gzipped.length,
            gzipKb: (gzipped.length / 1024).toFixed(2) + ' KB',
          });
        }
      }
    } catch (e) {
      console.error('Error scanning dist/client:', e);
    }
  }

  scan(distDir);
  return files;
}

async function run() {
  console.log('🚀 Running Baseline & Regression Measurement Suite...\n');

  // 1. Cold-Start Measurement (5 runs average)
  console.log('⏳ Measuring Production Cold-Start Time (5 runs)...');
  const coldStartTimes: number[] = [];
  for (let i = 1; i <= 5; i++) {
    try {
      const ms = await measureColdStart();
      coldStartTimes.push(ms);
      console.log(`   Run ${i}: ${ms.toFixed(2)} ms`);
      await new Promise((r) => setTimeout(r, 200));
    } catch (e: any) {
      console.error(`   Run ${i} failed:`, e.message);
    }
  }

  const avgColdStart = coldStartTimes.length > 0
    ? (coldStartTimes.reduce((a, b) => a + b, 0) / coldStartTimes.length).toFixed(2)
    : 'N/A';

  console.log(`\n⚡ Average Production Cold-Start Time: ${avgColdStart} ms\n`);

  // 2. Bundle Size Measurement
  console.log('📦 Measuring Production Client Bundle Size (dist/client)...');
  const bundleFiles = measureBundleSize();

  console.log('\n| File Path | Raw Size | Gzip Size |');
  console.log('|---|---|---|');
  let totalRaw = 0;
  let totalGzip = 0;

  for (const f of bundleFiles) {
    totalRaw += f.sizeBytes;
    totalGzip += f.gzipBytes;
    console.log(`| \`${f.filename}\` | ${f.sizeKb} | ${f.gzipKb} |`);
  }

  console.log(`| **TOTAL CLIENT ASSETS** | **${(totalRaw / 1024).toFixed(2)} KB** | **${(totalGzip / 1024).toFixed(2)} KB** |\n`);

  console.log('====================================================================================================');
  console.log('📊 BASELINE REPORT SUMMARY');
  console.log('====================================================================================================');
  console.log(`- Cold-Start Time (Ready to serve): ${avgColdStart} ms`);
  console.log(`- Total Client Bundle (Raw): ${(totalRaw / 1024).toFixed(2)} KB`);
  console.log(`- Total Client Bundle (Gzip): ${(totalGzip / 1024).toFixed(2)} KB`);
}

run().catch(console.error);
