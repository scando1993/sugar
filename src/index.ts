import * as fs from 'fs';
import * as path from 'path';
import { PrdJson, UserStory, ValidationError } from './types';

function storyIsPassed(story: UserStory): boolean {
  return story.status === 'passed';
}

function storyIsBlocked(story: UserStory): boolean {
  return story.status === 'blocked';
}

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

  // Validate consensus config
  if (!prd.consensus) {
    errors.push({ field: 'consensus', message: 'Missing consensus config' });
  } else {
    const c = prd.consensus;
    if (!c.quorumSize || c.quorumSize <= 0) {
      errors.push({ field: 'consensus.quorumSize', message: 'quorumSize must be > 0' });
    }
    if (!c.requiredMajority || c.requiredMajority > c.quorumSize) {
      errors.push({ field: 'consensus.requiredMajority', message: 'requiredMajority must be <= quorumSize' });
    }
    if (!c.implementModel) {
      errors.push({ field: 'consensus.implementModel', message: 'implementModel must be non-empty' });
    }
    if (!c.verifyModel) {
      errors.push({ field: 'consensus.verifyModel', message: 'verifyModel must be non-empty' });
    }
    if (!c.escalationModel) {
      errors.push({ field: 'consensus.escalationModel', message: 'escalationModel must be non-empty' });
    }
    if (!c.maxTerms || c.maxTerms <= 0) {
      errors.push({ field: 'consensus.maxTerms', message: 'maxTerms must be > 0' });
    }
  }

  const validStatuses = new Set(['pending', 'implementing', 'verifying', 'passed', 'rejected', 'blocked']);
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

    if (!validStatuses.has(story.status)) {
      errors.push({ storyId: story.id, field: 'status', message: `Invalid status: ${story.status}` });
    }

    if (story.votes) {
      story.votes.forEach((v, i) => {
        if (typeof v.term !== 'number' || v.term < 0) {
          errors.push({ storyId: story.id, field: `votes[${i}].term`, message: 'term must be >= 0' });
        }
        if (typeof v.verifier !== 'number' || v.verifier <= 0) {
          errors.push({ storyId: story.id, field: `votes[${i}].verifier`, message: 'verifier must be > 0' });
        }
        if (v.result !== 'pass' && v.result !== 'fail') {
          errors.push({ storyId: story.id, field: `votes[${i}].result`, message: 'result must be "pass" or "fail"' });
        }
        if (v.result === 'fail' && !v.reason) {
          errors.push({ storyId: story.id, field: `votes[${i}].reason`, message: 'fail votes must have a reason' });
        }
      });
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

  console.log(`\n${prd.project} — ${prd.branchName}`);
  console.log(prd.description);
  console.log('='.repeat(50));

  const byStatus: Record<string, UserStory[]> = {
    passed: [], implementing: [], verifying: [], rejected: [], blocked: [], pending: []
  };
  for (const story of prd.userStories) {
    const s = story.status || 'pending';
    if (byStatus[s]) byStatus[s].push(story);
  }

  const passing = byStatus.passed.length;
  console.log(`Progress: ${passing}/${total} stories passed`);

  const categories: Array<{ key: string; label: string }> = [
    { key: 'blocked', label: 'Blocked' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'verifying', label: 'Verifying' },
    { key: 'implementing', label: 'Implementing' },
    { key: 'pending', label: 'Pending' },
    { key: 'passed', label: 'Passed' },
  ];

  for (const { key, label } of categories) {
    const stories = byStatus[key];
    if (stories.length === 0) continue;
    console.log(`\n${label} (${stories.length}):`);
    for (const story of stories) {
      const marker = key === 'passed' ? 'x' : key === 'blocked' ? '!' : ' ';
      console.log(`  [${marker}] ${story.id}: ${story.title}`);
      if (story.notes) console.log(`      ${story.notes}`);
      if ((key === 'rejected' || key === 'verifying') && story.votes && story.votes.length > 0) {
        const currentTerm = story.term ?? 0;
        const termVotes = story.votes.filter(v => v.term === currentTerm);
        const pass = termVotes.filter(v => v.result === 'pass').length;
        const fail = termVotes.filter(v => v.result === 'fail').length;
        console.log(`      Votes (term ${currentTerm}): ${pass} pass, ${fail} fail`);
      }
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
    const passing = prd.userStories.filter(s => storyIsPassed(s)).length;
    const total = prd.userStories.length;
    const blocked = prd.userStories.filter(s => storyIsBlocked(s)).length;

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

function generateDashboard(basePath: string): void {
  if (!fs.existsSync(basePath)) {
    console.error(`Directory not found: ${basePath}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(basePath, { withFileTypes: true });
  const phases: { name: string; prd: PrdJson }[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const prdPath = path.join(basePath, entry.name, 'prd.json');
    if (!fs.existsSync(prdPath)) continue;
    const raw = fs.readFileSync(prdPath, 'utf-8');
    phases.push({ name: entry.name, prd: JSON.parse(raw) });
  }

  const timestamp = new Date().toISOString();

  const phaseCards = phases.map(({ name, prd }) => {
    const passing = prd.userStories.filter(s => storyIsPassed(s)).length;
    const total = prd.userStories.length;
    const pct = total > 0 ? Math.round((passing / total) * 100) : 0;
    const color = pct === 100 ? '#22c55e' : pct > 50 ? '#f59e0b' : '#ef4444';

    const storyRows = prd.userStories.map(s => {
      const status = s.status || 'pending';
      const badge = status === 'passed' ? '\u2713' : status === 'blocked' ? '!' : status === 'rejected' ? '\u2717' : '\u25CB';
      return `<tr><td>${badge}</td><td>${s.id}</td><td>${s.title}</td><td>${status}</td><td>${s.notes || ''}</td></tr>`;
    }).join('');

    return `
    <div class="phase-card">
      <div class="phase-header">
        <h2>${prd.project} — ${name}</h2>
        <span class="branch">${prd.branchName}</span>
      </div>
      <p class="description">${prd.description}</p>
      <div class="progress-bar-wrap">
        <div class="progress-bar" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="progress-label">${passing}/${total} stories (${pct}%)</div>
      <details>
        <summary>Stories</summary>
        <table>
          <thead><tr><th></th><th>ID</th><th>Title</th><th>Status</th><th>Notes</th></tr></thead>
          <tbody>${storyRows}</tbody>
        </table>
      </details>
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Orchestrate Dashboard</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 24px; }
  h1 { color: #f8fafc; margin-bottom: 4px; }
  .timestamp { color: #64748b; font-size: 0.85em; margin-bottom: 24px; }
  .phase-card { background: #1e293b; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
  .phase-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .phase-header h2 { margin: 0; font-size: 1.1em; color: #f1f5f9; }
  .branch { font-size: 0.75em; background: #334155; padding: 2px 8px; border-radius: 4px; color: #94a3b8; }
  .description { color: #94a3b8; font-size: 0.9em; margin: 4px 0 12px; }
  .progress-bar-wrap { background: #334155; border-radius: 4px; height: 8px; overflow: hidden; margin-bottom: 6px; }
  .progress-bar { height: 100%; border-radius: 4px; transition: width 0.3s; }
  .progress-label { font-size: 0.85em; color: #94a3b8; margin-bottom: 12px; }
  details summary { cursor: pointer; color: #60a5fa; font-size: 0.9em; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.85em; }
  th { text-align: left; color: #64748b; padding: 4px 8px; border-bottom: 1px solid #334155; }
  td { padding: 4px 8px; border-bottom: 1px solid #1e293b; }
</style>
</head>
<body>
<h1>Orchestrate Dashboard</h1>
<div class="timestamp">Generated: ${timestamp} | Base: ${basePath}</div>
${phaseCards}
</body>
</html>`;

  const outPath = `/tmp/orchestrate-dashboard-${Date.now()}.html`;
  fs.writeFileSync(outPath, html);
  console.log(`Dashboard written to: ${outPath}`);

  try {
    require('child_process').execSync(`open "${outPath}"`);
  } catch {
    console.log('Open the file manually in your browser.');
  }
}

function printUsage(): void {
  console.log('orchestrate — CLI companion for the Phase skill');
  console.log('');
  console.log('Usage:');
  console.log('  orchestrate validate <prd.json>      Validate a prd.json file');
  console.log('  orchestrate status <prd.json>         Show story completion status');
  console.log('  orchestrate status-all <base-path>    Scan all phase workspaces');
  console.log('  orchestrate dashboard <base-path>     Generate HTML dashboard and open in browser');
  console.log('');
  console.log('Examples:');
  console.log('  orchestrate validate /tmp/myapp-phases/phase-a-types/prd.json');
  console.log('  orchestrate status /tmp/myapp-phases/phase-b-api/prd.json');
  console.log('  orchestrate status-all /tmp/myapp-phases');
  console.log('  orchestrate dashboard /tmp/myapp-phases');
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
    case 'dashboard': {
      generateDashboard(target || '.');
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main();
