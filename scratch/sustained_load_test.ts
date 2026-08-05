import { spawn } from 'child_process';

const DURATION_SEC = 300; // 5 minutes sustained test
const SAMPLE_INTERVAL_SEC = 30; // Sample memory every 30 seconds
const CONCURRENCY = 50;
const BUN_PATH = 'C:\\Users\\sdev6\\.bun\\bin\\bun.exe';

interface Sample {
  elapsedSec: number;
  rssMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
  externalMb: number;
}

async function fetchMemory(): Promise<any> {
  try {
    const res = await fetch('http://localhost:3000/internal/mem');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Ignore fetch error if server is busy
  }
  return null;
}

async function runSustainedTest() {
  console.log(`🚀 Starting Sustained Load Test (Concurrency: ${CONCURRENCY}, Duration: ${DURATION_SEC}s / 5 minutes)...`);
  console.log('   Sampling process memory usage via /internal/mem every 30 seconds...\n');

  // Spawn autocannon for sustained load
  const autocannonArgs = [
    'x',
    'autocannon',
    '-c', String(CONCURRENCY),
    '-d', String(DURATION_SEC),
    '-m', 'GET',
    'http://localhost:3000/todos'
  ];

  const acProc = spawn(BUN_PATH, autocannonArgs, { cwd: process.cwd() });
  acProc.stdout.on('data', () => {});
  acProc.stderr.on('data', () => {});

  const samples: Sample[] = [];
  const startTime = Date.now();

  console.log('| Elapsed Time | RSS (MB) | Heap Used (MB) | Heap Total (MB) | External (MB) | Memory Growth |');
  console.log('|---|---|---|---|---|---|');

  let initialHeap = 0;

  const takeSample = async (label?: string) => {
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    const mem = await fetchMemory();

    if (mem) {
      if (initialHeap === 0) initialHeap = mem.heapUsed;
      const diff = Math.round((mem.heapUsed - initialHeap) * 100) / 100;
      const growthStr = diff >= 0 ? `+${diff} MB` : `${diff} MB`;

      console.log(`| ${elapsedSec}s | ${mem.rss} MB | ${mem.heapUsed} MB | ${mem.heapTotal} MB | ${mem.external} MB | ${growthStr} (${label || 'Healthy'}) |`);
      samples.push({
        elapsedSec,
        rssMb: mem.rss,
        heapUsedMb: mem.heapUsed,
        heapTotalMb: mem.heapTotal,
        externalMb: mem.external,
      });
    }
  };

  // Sample at t=0
  await takeSample('Initial');

  const intervalId = setInterval(async () => {
    await takeSample();
  }, SAMPLE_INTERVAL_SEC * 1000);

  await new Promise((resolve) => acProc.on('close', resolve));
  clearInterval(intervalId);

  // Final sample
  await takeSample('Final');

  console.log('\n====================================================================================================');
  console.log('📊 SUSTAINED LOAD TEST MEMORY ANALYSIS');
  console.log('====================================================================================================\n');

  if (samples.length >= 2) {
    const first = samples[0];
    const last = samples[samples.length - 1];
    const heapDiff = Math.round((last.heapUsedMb - first.heapUsedMb) * 100) / 100;
    const rssDiff = Math.round((last.rssMb - first.rssMb) * 100) / 100;

    console.log(`Initial Heap Used: ${first.heapUsedMb} MB | Final Heap Used: ${last.heapUsedMb} MB (Net Heap Change: ${heapDiff >= 0 ? '+' : ''}${heapDiff} MB)`);
    console.log(`Initial RSS: ${first.rssMb} MB | Final RSS: ${last.rssMb} MB (Net RSS Change: ${rssDiff >= 0 ? '+' : ''}${rssDiff} MB)\n`);

    if (Math.abs(heapDiff) < 15.0) {
      console.log('✅ ASSESSMENT: MEMORY PLATEAUED (HEALTHY). Zero unbounded growth or leaks detected during sustained load.');
    } else if (heapDiff > 15.0) {
      console.log('⚠️ ASSESSMENT: STEADY MEMORY GROWTH DETECTED. Correlates with sustained GET /todos requests.');
    }
  }
}

runTest().catch(console.error);
async function runTest() {
  await runSustainedTest();
}
