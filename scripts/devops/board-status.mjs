import fs from 'node:fs';
import path from 'node:path';

const boardPath = path.resolve(process.cwd(), 'DEVOPS_LEARNING_BOARD.json');
const raw = fs.readFileSync(boardPath, 'utf8');
const board = JSON.parse(raw);

const milestones = Array.isArray(board.milestones) ? board.milestones : [];
const activeMilestone =
  milestones.find((m) => m.status === 'in_progress') ||
  milestones.find((m) => m.status === 'todo');

const pendingTasks = milestones
  .flatMap((m) => (Array.isArray(m.tasks) ? m.tasks.map((t) => ({ ...t, milestoneId: m.id, milestoneTitle: m.title })) : []))
  .filter((t) => t.status !== 'done')
  .slice(0, 3);

const lines = [];
lines.push('DevOps Learning Board Status');
lines.push('===========================');
lines.push(`Track: ${board.track ?? 'N/A'}`);
lines.push(`Last Updated: ${board.lastUpdated ?? 'N/A'}`);
lines.push('');

if (activeMilestone) {
  lines.push('Current Milestone');
  lines.push('-----------------');
  lines.push(`${activeMilestone.id}: ${activeMilestone.title}`);
  lines.push(`Status: ${activeMilestone.status}`);
  lines.push(`Outcome: ${activeMilestone.outcome ?? 'N/A'}`);
  lines.push('');
}

lines.push('Next 3 Tasks');
lines.push('------------');
if (pendingTasks.length === 0) {
  lines.push('No pending tasks. Great work.');
} else {
  for (const task of pendingTasks) {
    lines.push(`- [${task.status}] ${task.id} (${task.milestoneId} ${task.milestoneTitle}) :: ${task.title}`);
  }
}

lines.push('');
if (board.nextSession) {
  lines.push('Next Session');
  lines.push('------------');
  lines.push(`Focus: ${board.nextSession.focus ?? 'N/A'}`);
  lines.push(`Time: ${board.nextSession.estimatedTime ?? 'N/A'}`);
  lines.push(`Done When: ${board.nextSession.definitionOfDone ?? 'N/A'}`);
}

console.log(lines.join('\n'));
