import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const TARGET_DIRS = ['apps/client/src/app', 'apps/admin/src/app'];
const STRICT = process.argv.includes('--strict');
const REPORT_DIR = join(ROOT, 'artifacts');
const REPORT_PATH = join(REPORT_DIR, 'centralization-report.md');

const BANNED_PATTERNS = [
  {
    id: 'segmented-group-raw',
    pattern: 'grid grid-cols-2 gap-2 rounded-xl border p-1',
    advice: 'Use SegmentedControl from @wrap-roll/shared-ui or app contract tokens.',
  },
  {
    id: 'segmented-button-bold-raw',
    pattern: 'rounded-lg px-3 py-2 text-xs font-bold',
    advice: 'Use SegmentedControl.Item / shared segmented button contracts.',
  },
  {
    id: 'segmented-button-black-raw',
    pattern: 'rounded-lg px-3 py-2 text-xs font-black',
    advice: 'Use SegmentedControl.Item / shared segmented button contracts.',
  },
  {
    id: 'admin-title-raw',
    pattern: 'font-display text-4xl font-black tracking-tight text-neutral-900',
    advice: 'Use adminPageTitleClass from apps/admin/src/lib/admin-ui-contract.ts.',
  },
];

const INLINE_TYPE_RE = /\btype\s+\w+\s*=\s*\{/g;
const PAGE_FILE_RE = /page\.tsx$/;
const offenders = [];
const advisories = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      walk(full);
      continue;
    }
    if (!PAGE_FILE_RE.test(name)) continue;
    const src = readFileSync(full, 'utf8');
    const rel = relative(ROOT, full);

    for (const banned of BANNED_PATTERNS) {
      if (src.includes(banned.pattern)) {
        offenders.push({
          file: rel,
          rule: banned.id,
          detail: `Found raw pattern: \`${banned.pattern}\``,
          advice: banned.advice,
        });
      }
    }

    const inlineTypeMatches = src.match(INLINE_TYPE_RE);
    if (inlineTypeMatches && inlineTypeMatches.length > 0) {
      advisories.push({
        file: rel,
        rule: 'inline-contract-type-in-page',
        detail: `Found ${inlineTypeMatches.length} inline object type declaration(s) in page file.`,
        advice: 'Extract page contracts into app lib modules (e.g. apps/*/src/lib/*-contract.ts).',
      });
    }
  }
}

for (const target of TARGET_DIRS) {
  walk(join(ROOT, target));
}

mkdirSync(REPORT_DIR, { recursive: true });

let report = '# Centralization Lint Report\n\n';
report += `Mode: ${STRICT ? 'strict' : 'warning'}\n\n`;
if (offenders.length === 0) {
  report += 'No violations found.\n';
} else {
  report += `Violations: ${offenders.length}\n\n`;
  for (const o of offenders) {
    report += `- [${o.rule}] \`${o.file}\`\n`;
    report += `  - ${o.detail}\n`;
    report += `  - Fix: ${o.advice}\n`;
  }
}
if (advisories.length > 0) {
  report += '\n## Advisory findings (non-blocking)\n\n';
  for (const a of advisories) {
    report += `- [${a.rule}] \`${a.file}\`\n`;
    report += `  - ${a.detail}\n`;
    report += `  - Suggested next: ${a.advice}\n`;
  }
}

writeFileSync(REPORT_PATH, report, 'utf8');

if (offenders.length === 0) {
  console.log(`centralization: clean (${STRICT ? 'strict' : 'warning'} mode)`);
  if (advisories.length > 0) {
    console.log(`centralization: ${advisories.length} advisory finding(s)`);
  }
  console.log(`centralization: report -> ${relative(ROOT, REPORT_PATH)}`);
  process.exit(0);
}

console.log(`centralization: found ${offenders.length} violation(s)`);
console.log(`centralization: report -> ${relative(ROOT, REPORT_PATH)}`);
if (STRICT) {
  console.error('centralization: strict mode enabled, failing build.');
  process.exit(1);
}
console.warn('centralization: warning mode (non-blocking).');
process.exit(0);
