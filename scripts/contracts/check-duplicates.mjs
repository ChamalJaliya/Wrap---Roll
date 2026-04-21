import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const TARGET_DIRS = ['apps', 'services'];
const CONTRACT_TYPE_NAMES = [
  'QueueOrder',
  'SupportOrderDetails',
  'PaymentEventRow',
  'StaffRole',
  'PaymentMethodsConfig',
  'NormalizedPaymentConfig',
];

const offenders = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    const rel = full.replace(`${ROOT}/`, '');
    const src = readFileSync(full, 'utf8');
    for (const typeName of CONTRACT_TYPE_NAMES) {
      const typeDecl = new RegExp(`\\btype\\s+${typeName}\\s*=`);
      const ifaceDecl = new RegExp(`\\binterface\\s+${typeName}\\b`);
      if (typeDecl.test(src) || ifaceDecl.test(src)) {
        offenders.push({ file: rel, typeName });
      }
    }
  }
}

for (const d of TARGET_DIRS) {
  walk(join(ROOT, d));
}

if (offenders.length === 0) {
  console.log('contracts: no duplicate shared contract declarations found.');
  process.exit(0);
}

console.log('contracts: duplicate shared contract declarations detected (warning mode):');
for (const o of offenders) {
  console.log(` - ${o.typeName} in ${o.file}`);
}
console.log('Import shared types from @wrap-roll/contracts instead of redeclaring locally.');
process.exit(0);
