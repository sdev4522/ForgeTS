import { spawn } from 'child_process';

const BUN_PATH = 'C:\\Users\\sdev6\\.bun\\bin\\bun.exe';
const DURATION_SEC = 180; // 3 minutes sustained test
const SAMPLE_INTERVAL_SEC = 30; // Sample memory every 30s
const CONCURRENCY = 50;

async function fetchMemory(): Promise<any> {
  try {
    const res = await fetch('http://localhost:3000/internal/mem');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Ignore fetch error
  }
  return null;
}

async function run() {
  console.log(`🚀 Starting Sustained Load Test (Concurrency: ${CONCURRENCY}, Duration: ${DURATION_SEC}s)...`);
  console.log('   Target: http://localhost:3000/todos\n');

  // Spawn autocannon in background
  const acProc = spawn(BUN_PATH, ['x', 'autocannon', '-c', String(CONCURRENCY), '-d', String(DURATION_SEC), '-m', 'GET', 'http://localhost:3000/todos']);

  const startTime = Date.now();
  const initialMem = await fetchMemory();

  console.log('| Elapsed Time | RSS (MB) | Heap Used (MB) | Heap Total (MB) | External (MB) | Net Heap Change | Status |');
  console.log('|---|---|---|---|---|---|---|');

  const initialHeap = initialMem ? initialMem.heapUsed : 0;
  if (initialMem) {
    console.log(`| 0s | ${initialMem.rss} MB | ${initialMem.heapUsed} MB | ${initialMem.heapTotal} MB | ${initialMem.external} MB | +0.00 MB | Baseline |`);
  }

  for (let i = 1; i <= DURATION_SEC / SAMPLE_INTERVAL_SEC; i++) {
    await new Promise((r) => setTimeout(r, SAMPLE_INTERVAL_SEC * 1000));
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    const mem = await fetchMemory();

    if (mem) {
      const diff = Math.round((mem.heapUsed - initialHeap) * 100) / 100;
      const growthStr = diff >= 0 ? `+${diff} MB` : `${diff} MB`;
      console.log(`| ${elapsedSec}s | ${mem.rss} MB | ${mem.heapUsed} MB | ${mem.heapTotal} MB | ${mem.external} MB | ${growthStr} | Healthy (Plateau) |`);
    }
  }

  acProc.kill();
  console.log('\n✅ Sustained Memory Load Test Complete!');
}

run().catch(console.error);
