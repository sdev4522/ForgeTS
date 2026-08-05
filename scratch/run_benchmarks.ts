import autocannon from 'autocannon';

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
const duration = 10; // seconds per test

async function runAutocannon(url: string, method: 'GET' | 'POST', connections: number): Promise<autocannon.Result> {
  return new Promise((resolve, reject) => {
    const opts: autocannon.Options = {
      url,
      method,
      connections,
      duration,
      headers: method === 'POST' ? { 'content-type': 'application/json' } : {},
      body: method === 'POST' ? JSON.stringify({ title: 'Benchmark Task', completed: false }) : undefined,
    };

    autocannon(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

async function runSuite() {
  const results: BenchmarkResult[] = [];

  const targets = [
    { name: 'ForgeTS Framework', port: 3000 },
    { name: 'Raw Bun+Kysely Baseline', port: 3001 },
  ];

  console.log('🚀 Starting Automated Autocannon Benchmark Suite...\n');

  for (const target of targets) {
    for (const method of ['GET', 'POST'] as const) {
      for (const concurrency of concurrencyLevels) {
        const url = `http://localhost:${target.port}/todos`;
        console.log(`⏳ Testing ${target.name} | ${method} ${url} | Concurrency: ${concurrency}...`);

        try {
          const res = await runAutocannon(url, method, concurrency);
          results.push({
            server: target.name,
            endpoint: `${method} /todos`,
            concurrency,
            reqPerSec: Math.round(res.requests.average),
            p50: res.latency.p50,
            p95: res.latency.p95,
            p99: res.latency.p99,
            non2xx: res['non2xx'] || 0,
            timeouts: res.timeouts,
            errors: res.errors,
          });
        } catch (e: any) {
          console.error(`❌ Error benchmarking ${target.name}:`, e.message);
        }
      }
    }
  }

  console.log('\n📊 BENCHMARK RESULTS TABLE\n');
  console.log('| Server | Endpoint | Concurrency | Req/sec | Latency p50 (ms) | Latency p95 (ms) | Latency p99 (ms) | Non-2xx / Errors |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    console.log(`| ${r.server} | ${r.endpoint} | ${r.concurrency} | ${r.reqPerSec.toLocaleString()} | ${r.p50} | ${r.p95} | ${r.p99} | ${r.non2xx + r.errors} |`);
  }
}

runSuite().catch(console.error);
