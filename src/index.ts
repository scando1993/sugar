import * as fs from 'fs';
import * as path from 'path';
import { PrdJson, ValidationError } from './types';

function validatePrd(prd: PrdJson): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!prd.project) errors.push({ field: 'project', message: 'Missing project name' });
  if (!prd.branchName) errors.push({ field: 'branchName', message: 'Missing branch name' });
  if (!prd.description) errors.push({ field: 'description', message: 'Missing description' });

  if (!Array.isArray(prd.userStories)) {
    errors.push({ field: 'userStories', message: 'Missing or invalid userStories array' });
    return errors;
  }

  if (prd.userStories.length === 0) {
    errors.push({ field: 'userStories', message: 'No user stories defined' });
    return errors;
  }

  const ids = new Set<string>();

  for (const story of prd.userStories) {
    if (!story.id) {
      errors.push({ field: 'id', message: 'Missing story ID' });
      continue;
    }

    if (ids.has(story.id)) {
      errors.push({ storyId: story.id, field: 'id', message: 'Duplicate story ID' });
    }
    ids.add(story.id);

    if (!story.title) {
      errors.push({ storyId: story.id, field: 'title', message: 'Missing title' });
    }

    if (!story.description) {
      errors.push({ storyId: story.id, field: 'description', message: 'Missing description' });
    }

    if (!Array.isArray(story.acceptanceCriteria) || story.acceptanceCriteria.length === 0) {
      errors.push({ storyId: story.id, field: 'acceptanceCriteria', message: 'No acceptance criteria defined' });
    } else {
      const hasTypecheck = story.acceptanceCriteria.some(c => /typecheck/i.test(c));
      if (!hasTypecheck) {
        errors.push({ storyId: story.id, field: 'acceptanceCriteria', message: 'Missing "Typecheck passes" criterion' });
      }
    }

    if (typeof story.priority !== 'number' || story.priority < 1) {
      errors.push({ storyId: story.id, field: 'priority', message: 'Priority must be a positive number' });
    }

    if (typeof story.passes !== 'boolean') {
      errors.push({ storyId: story.id, field: 'passes', message: 'passes must be a boolean' });
    }
  }

  // Check priority ordering — earlier stories should not depend on later ones
  const priorities = prd.userStories.map(s => s.priority);
  const sorted = [...priorities].sort((a, b) => a - b);
  if (JSON.stringify(priorities) !== JSON.stringify(sorted)) {
    errors.push({ field: 'userStories', message: 'Stories are not sorted by priority (ascending)' });
  }

  return errors;
}

function reportStatus(prd: PrdJson): void {
  const total = prd.userStories.length;
  const passing = prd.userStories.filter(s => s.passes).length;
  const remaining = prd.userStories.filter(s => !s.passes);
  const blocked = prd.userStories.filter(s => !s.passes && s.notes);

  console.log(`\n${prd.project} — ${prd.branchName}`);
  console.log(prd.description);
  console.log('='.repeat(50));
  console.log(`Progress: ${passing}/${total} stories passing`);

  if (blocked.length > 0) {
    console.log(`\nBlocked (${blocked.length}):`);
    for (const story of blocked) {
      console.log(`  [!] ${story.id}: ${story.title}`);
      console.log(`      ${story.notes}`);
    }
  }

  const pendingUnblocked = remaining.filter(s => !s.notes);
  if (pendingUnblocked.length > 0) {
    console.log(`\nRemaining (${pendingUnblocked.length}):`);
    for (const story of pendingUnblocked) {
      console.log(`  [ ] ${story.id}: ${story.title} (priority ${story.priority})`);
    }
  }

  const completed = prd.userStories.filter(s => s.passes);
  if (completed.length > 0) {
    console.log(`\nCompleted (${completed.length}):`);
    for (const story of completed) {
      console.log(`  [x] ${story.id}: ${story.title}`);
    }
  }

  if (passing === total) {
    console.log('\nAll stories complete — ready to push.');
  }

  console.log('');
}

function scanWorkspaces(basePath: string): void {
  if (!fs.existsSync(basePath)) {
    console.error(`Directory not found: ${basePath}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(basePath, { withFileTypes: true });
  let totalStories = 0;
  let totalPassing = 0;
  let totalBlocked = 0;
  const phases: { name: string; passing: number; total: number; blocked: number }[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const prdPath = path.join(basePath, entry.name, 'prd.json');
    if (!fs.existsSync(prdPath)) continue;

    const raw = fs.readFileSync(prdPath, 'utf-8');
    const prd: PrdJson = JSON.parse(raw);
    const passing = prd.userStories.filter(s => s.passes).length;
    const total = prd.userStories.length;
    const blocked = prd.userStories.filter(s => !s.passes && s.notes).length;

    totalStories += total;
    totalPassing += passing;
    totalBlocked += blocked;
    phases.push({ name: entry.name, passing, total, blocked });
  }

  if (phases.length === 0) {
    console.log(`\nNo phase workspaces with prd.json found in ${basePath}`);
    return;
  }

  console.log(`\nPhase Workspace Status: ${basePath}`);
  console.log('='.repeat(60));

  for (const phase of phases) {
    const pct = phase.total > 0 ? phase.passing / phase.total : 0;
    const filled = Math.floor(pct * 20);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(20 - filled);
    const status = phase.passing === phase.total ? 'DONE' : `${phase.passing}/${phase.total}`;
    const blockedTag = phase.blocked > 0 ? ` (${phase.blocked} blocked)` : '';
    console.log(`  ${phase.name.padEnd(28)} ${bar} ${status}${blockedTag}`);
  }

  console.log('\u2500'.repeat(60));
  console.log(`  Total: ${totalPassing}/${totalStories} stories passing`);

  if (totalBlocked > 0) {
    console.log(`  Blocked: ${totalBlocked} stories need attention`);
  }

  if (totalPassing === totalStories && totalStories > 0) {
    console.log('  All phases complete — ready for Phase 4 merge');
  }

  console.log('');
}

function printUsage(): void {
  console.log('orchestrate — CLI companion for the Phase skill');
  console.log('');
  console.log('Usage:');
  console.log('  orchestrate validate <prd.json>      Validate a prd.json file');
  console.log('  orchestrate status <prd.json>         Show story completion status');
  console.log('  orchestrate status-all <base-path>    Scan all phase workspaces');
  console.log('');
  console.log('Examples:');
  console.log('  orchestrate validate /tmp/myapp-phases/phase-a-types/prd.json');
  console.log('  orchestrate status /tmp/myapp-phases/phase-b-api/prd.json');
  console.log('  orchestrate status-all /tmp/myapp-phases');
}

function readPrd(filePath: string): PrdJson {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    console.error(`Invalid JSON: ${filePath}`);
    process.exit(1);
  }
}

function main(): void {
  const [, , command, target] = process.argv;

  if (!command) {
    printUsage();
    process.exit(1);
  }

  switch (command) {
    case 'validate': {
      if (!target) { printUsage(); process.exit(1); }
      const prd = readPrd(target);
      const errors = validatePrd(prd);
      if (errors.length === 0) {
        console.log('prd.json is valid.');
      } else {
        console.error(`Validation failed (${errors.length} errors):`);
        for (const e of errors) {
          const prefix = e.storyId ? `[${e.storyId}] ` : '';
          console.error(`  - ${prefix}${e.field}: ${e.message}`);
        }
        process.exit(1);
      }
      break;
    }
    case 'status': {
      if (!target) { printUsage(); process.exit(1); }
      const prd = readPrd(target);
      reportStatus(prd);
      break;
    }
    case 'status-all': {
      scanWorkspaces(target || '.');
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main();
