import { spawn } from 'child_process';

interface BenchmarkResult {
  server: string;
  endpoint: string;
  concurrency: number;
  reqPerSec: number;
  p50: number;
  p95: number;
  p99: number;
  non2xx: number;
  timeouts: number;
  errors: number;
}

const concurrencyLevels = [10, 100, 500, 1000];
const duration = 10; // 10s fixed duration per test

function runAutocannonCli(url: string, method: 'GET' | 'POST', connections: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const bunPath = 'C:\\Users\\sdev6\\.bun\\bin\\bun.exe';
    const args = [
      'x',
      'autocannon',
      '-c', String(connections),
      '-d', String(duration),
      '-m', method,
      '-j', // JSON output
    ];

    if (method === 'POST') {
      args.push('-H', 'content-type=application/json');
      args.push('-b', JSON.stringify({ title: 'Benchmark Task', completed: false }));
    }

    args.push(url);

    const proc = spawn(bunPath, args, { cwd: process.cwd() });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch (e) {
        console.error('Failed to parse autocannon JSON stdout:', stdout, stderr);
        reject(e);
      }
    });
  });
}

async function runSuite() {
  const results: BenchmarkResult[] = [];

  const targets = [
    { name: 'ForgeTS Framework', port: 3000 },
    { name: 'Raw Bun+Kysely Baseline', port: 3001 },
  ];

  console.log('🚀 Starting Autocannon Benchmark Suite (Concurrencies: 10, 100, 500, 1000)...');

  for (const target of targets) {
    for (const method of ['GET', 'POST'] as const) {
      for (const concurrency of concurrencyLevels) {
        const url = `http://localhost:${target.port}/todos`;
        console.log(`\n⏳ Running: ${target.name} | ${method} ${url} | Concurrency: ${concurrency} (Duration: ${duration}s)...`);

        try {
          const res = await runAutocannonCli(url, method, concurrency);
          const reqPerSec = Math.round(res.requests.average || 0);
          const p50 = res.latency.p50 || 0;
          const p95 = res.latency.p95 || 0;
          const p99 = res.latency.p99 || 0;
          const non2xx = res['non2xx'] || 0;
          const timeouts = res.timeouts || 0;
          const errors = res.errors || 0;

          console.log(`   --> Req/sec: ${reqPerSec.toLocaleString()} | p50: ${p50}ms | p95: ${p95}ms | p99: ${p99}ms | Non-2xx/Errors: ${non2xx + errors}`);

          results.push({
            server: target.name,
            endpoint: `${method} /todos`,
            concurrency,
            reqPerSec,
            p50,
            p95,
            p99,
            non2xx,
            timeouts,
            errors,
          });
        } catch (e: any) {
          console.error(`❌ Benchmark error:`, e.message);
        }
      }
    }
  }

  console.log('\n\n====================================================================================================');
  console.log('📊 FINAL BENCHMARK RESULTS SUMMARY TABLE');
  console.log('====================================================================================================\n');
  console.log('| Server | Endpoint | Concurrency | Req/sec (avg) | p50 (ms) | p95 (ms) | p99 (ms) | Non-2xx / Errors |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    console.log(`| ${r.server} | ${r.endpoint} | ${r.concurrency} | ${r.reqPerSec.toLocaleString()} | ${r.p50} | ${r.p95} | ${r.p99} | ${r.non2xx + r.errors} |`);
  }
}

runSuite().catch(console.error);
