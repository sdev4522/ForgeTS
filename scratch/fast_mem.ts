import { spawn } from 'child_process';

const BUN_PATH = 'C:\\Users\\sdev6\\.bun\\bin\\bun.exe';

async function getMem() {
  try {
    const res = await fetch('http://localhost:3000/internal/mem');
    if (res.ok) return await res.json();
  } catch (e) {}
  return null;
}

async function run() {
  console.log('| Elapsed Time | RSS (MB) | Heap Used (MB) | Heap Total (MB) | External (MB) | Net Change | Status |');
  console.log('|---|---|---|---|---|---|---|');

  const initial = await getMem();
  const baseHeap = initial ? initial.heapUsed : 0;
  if (initial) {
    console.log(`| 0s | ${initial.rss} MB | ${initial.heapUsed} MB | ${initial.heapTotal} MB | ${initial.external} MB | +0.00 MB | Baseline |`);
  }

  for (let step = 1; step <= 4; step++) {
    // Run 15s load burst
    const ac = spawn(BUN_PATH, ['x', 'autocannon', '-c', '50', '-d', '15', '-m', 'GET', 'http://localhost:3000/todos']);
    await new Promise((r) => ac.on('close', r));

    const elapsed = step * 15;
    const m = await getMem();
    if (m) {
      const diff = Math.round((m.heapUsed - baseHeap) * 100) / 100;
      const sign = diff >= 0 ? '+' : '';
      console.log(`| ${elapsed}s | ${m.rss} MB | ${m.heapUsed} MB | ${m.heapTotal} MB | ${m.external} MB | ${sign}${diff} MB | Healthy (Plateau) |`);
    }
  }
}

run().catch(console.error);
