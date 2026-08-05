import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function getFolderSize(dir: string): number {
  let size = 0;
  try {
    const files = readdirSync(dir);
    for (const f of files) {
      const p = join(dir, f);
      const stat = statSync(p);
      if (stat.isDirectory()) {
        size += getFolderSize(p);
      } else {
        size += stat.size;
      }
    }
  } catch (e) {}
  return size;
}

const pkgJson = JSON.parse(readFileSync('package.json', 'utf-8'));
const deps = Object.keys(pkgJson.dependencies || {});
const devDeps = Object.keys(pkgJson.devDependencies || {});

console.log('📦 RUNNING DEPENDENCY AUDIT...\n');

console.log('--- PRODUCTION DEPENDENCIES ---');
for (const d of deps) {
  const path = join('node_modules', d);
  const bytes = getFolderSize(path);
  const mb = (bytes / 1024 / 1024).toFixed(2);
  console.log(`- ${d}: ${mb} MB`);
}

console.log('\n--- DEV DEPENDENCIES ---');
for (const d of devDeps) {
  const path = join('node_modules', d);
  const bytes = getFolderSize(path);
  const mb = (bytes / 1024 / 1024).toFixed(2);
  console.log(`- ${d}: ${mb} MB`);
}

const totalNodeModules = (getFolderSize('node_modules') / 1024 / 1024).toFixed(2);
console.log(`\n💾 Total node_modules Disk Size: ${totalNodeModules} MB`);

const distClientSize = (getFolderSize('dist/client') / 1024 / 1024).toFixed(2);
const distServerSize = (getFolderSize('dist/server') / 1024 / 1024).toFixed(2);
console.log(`⚡ Production Bundle Size (dist/client): ${distClientSize} MB`);
console.log(`⚡ Production SSR Bundle Size (dist/server): ${distServerSize} MB`);
