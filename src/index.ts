#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { PrdJson, UserStory, ValidationError, DEFAULT_CONFIG, StoryStatus, PhaseDefinition } from './types';
import { Orchestrator } from './lib/orchestrator';
import { ConsensusEngine } from './lib/consensus';
import { RalphLoop } from './lib/ralph-loop';
import { ModelTier } from './lib/model-tier';
import { WorkspaceManager } from './lib/workspace';
import { PatternManager } from './lib/patterns';
import { loadConfig, findRepoRoot, resolveWorkspaceBasePath } from './lib/config';
import { createAgentRunner } from './lib/agent-runner';
import { Verifier } from './lib/verifier';
import { LoopRunner } from './lib/loop-runner';
import { getFlag, getPositional } from './lib/argv';
import { buildDashboardHtml } from './lib/dashboard';
import { buildBrainstormHtml } from './lib/brainstorm-html';

// ============================================================
// Existing functionality (validate, status, dashboard, brainstorm)
// ============================================================

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

  const html = buildDashboardHtml(phases, basePath, new Date().toISOString());

  const outPath = `/tmp/sugar-dashboard-${Date.now()}.html`;
  fs.writeFileSync(outPath, html);
  console.log(`Dashboard written to: ${outPath}`);

  try {
    require('child_process').execSync(`open "${outPath}"`);
  } catch {
    console.log('Open the file manually in your browser.');
  }
}

function generateBrainstorm(description: string): void {
  const html = buildBrainstormHtml(description, new Date().toISOString());

  const outPath = `/tmp/sugar-brainstorm-${Date.now()}.html`;
  fs.writeFileSync(outPath, html);
  console.log(`Brainstorm written to: ${outPath}`);

  try {
    require('child_process').execSync(`open "${outPath}"`);
  } catch {
    console.log('Open the file manually in your browser.');
  }
}

// ============================================================
// New CLI commands
// ============================================================

function configInit(): void {
  const configPath = path.join(findRepoRoot(), 'sugar.config.json');
  if (fs.existsSync(configPath)) {
    console.log('sugar.config.json already exists.');
    return;
  }
  fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
  console.log('Created sugar.config.json with defaults.');
}

function pickStory(args: string[]): void {
  const workspace = getFlag(args, '--workspace') || process.cwd();
  const prdPath = path.join(workspace, 'prd.json');

  if (!fs.existsSync(prdPath)) {
    console.error(`No prd.json found in ${workspace}`);
    process.exit(1);
  }

  const strict = args.includes('--strict');
  const config = loadConfig(findRepoRoot(workspace));
  const modelTier = new ModelTier(config.models.default, config.models.escalation, config.escalation.threshold);
  const consensus = new ConsensusEngine(config.consensus.quorumSize, config.consensus.requiredMajority);
  const loop = new RalphLoop(workspace, modelTier, consensus);

  const story = loop.pickNextStory();
  if (story) {
    console.log(story.id);
    return;
  }

  if (!strict) {
    // Legacy behavior, kept for existing callers: unconditionally report
    // complete. Use --strict to distinguish a truly finished phase from one
    // stuck with blocked/in-flight stories (see PHASE_STUCK below).
    console.log('PHASE_COMPLETE');
    return;
  }

  if (loop.isPhaseComplete()) {
    console.log('PHASE_COMPLETE');
  } else {
    console.log('PHASE_STUCK');
    process.exit(2);
  }
}

function storyUpdate(args: string[]): void {
  const workspace = getFlag(args, '--workspace') || process.cwd();
  const storyId = getFlag(args, '--story');
  const status = getFlag(args, '--status') as StoryStatus | undefined;

  if (!storyId || !status) {
    console.error('Usage: sugar story-update --story <id> --status <status> [--workspace <path>]');
    process.exit(1);
  }

  const config = loadConfig(findRepoRoot(workspace));
  const modelTier = new ModelTier(config.models.default, config.models.escalation);
  const consensus = new ConsensusEngine(config.consensus.quorumSize, config.consensus.requiredMajority);
  const loop = new RalphLoop(workspace, modelTier, consensus);
  loop.setStoryStatus(storyId, status);
  console.log(`${storyId} → ${status}`);
}

function snapshot(args: string[]): void {
  const workspace = getFlag(args, '--workspace') || process.cwd();
  const storyId = getFlag(args, '--story') || 'unknown';
  const attemptArg = getFlag(args, '--attempt');
  const attempt = attemptArg ? parseInt(attemptArg, 10) : 1;

  const config = loadConfig(findRepoRoot(workspace));
  const modelTier = new ModelTier(config.models.default, config.models.escalation);
  const consensus = new ConsensusEngine(config.consensus.quorumSize, config.consensus.requiredMajority);
  const loop = new RalphLoop(workspace, modelTier, consensus);
  const tag = loop.createSnapshot(storyId, attempt);
  console.log(tag);
}

function verifyStory(args: string[]): void {
  const workspace = getFlag(args, '--workspace') || process.cwd();
  const storyId = getFlag(args, '--story');
  const modelOverride = getFlag(args, '--model');

  if (!storyId) {
    console.error('Usage: sugar verify --story <id> [--workspace <path>] [--model <model>]');
    process.exit(1);
  }

  const config = loadConfig(findRepoRoot(workspace));
  const runner = createAgentRunner({
    runnerBin: config.runnerBin,
    permissionMode: config.permissionMode,
    cwd: workspace,
  });
  const verifier = new Verifier(workspace, runner);

  let result;
  try {
    result = verifier.runQuorum(storyId, modelOverride);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  console.log(`${result.storyId}: ${result.passVotes} pass / ${result.failVotes} fail -> ${result.status}`);
  for (const reason of result.reasons) console.log(`  - ${reason}`);
  process.exit(result.passed ? 0 : 1);
}

// Exit codes: 0 = complete, 1 = max iterations reached without completing, 3 = stuck
// (blocked or otherwise unfinished stories remain with no pending/rejected work to pick up).
function runCmd(args: string[]): void {
  const workspace = getPositional(args, ['--max-iterations', '--model']) || process.cwd();
  const maxIterationsArg = getFlag(args, '--max-iterations');
  const parsedMaxIterations = maxIterationsArg ? parseInt(maxIterationsArg, 10) : NaN;
  const modelOverride = getFlag(args, '--model');

  const prdPath = path.join(workspace, 'prd.json');
  if (!fs.existsSync(prdPath)) {
    console.error(`No prd.json found in ${workspace}`);
    process.exit(1);
  }

  const config = loadConfig(findRepoRoot(workspace));
  const maxIterations = Number.isFinite(parsedMaxIterations) ? parsedMaxIterations : config.maxIterations;
  const runner = createAgentRunner({
    runnerBin: config.runnerBin,
    permissionMode: config.permissionMode,
    cwd: workspace,
  });
  const loopRunner = new LoopRunner(workspace, config, runner, modelOverride);
  const result = loopRunner.run(maxIterations);

  console.log(`\n${result.status.toUpperCase()} — ${result.passed}/${result.total} stories passed (${result.iterations} iteration(s))`);
  if (result.blocked.length > 0) {
    console.log(`Blocked: ${result.blocked.join(', ')}`);
  }

  if (result.status === 'complete') process.exit(0);
  if (result.status === 'stuck') process.exit(3);
  process.exit(1);
}

function workspaceCmd(args: string[]): void {
  const sub = args[0];
  const repoRoot = findRepoRoot();
  const config = loadConfig(repoRoot);
  const repoName = path.basename(repoRoot);
  const mgr = new WorkspaceManager({
    repoRoot,
    basePath: resolveWorkspaceBasePath(config, repoRoot),
    repoName,
  });

  switch (sub) {
    case 'list': {
      const workspaces = mgr.listWorkspaces();
      if (workspaces.length === 0) {
        console.log('No workspaces found.');
        return;
      }
      for (const ws of workspaces) {
        console.log(`  ${ws.phase.padEnd(28)} branch: ${ws.branch}  path: ${ws.path}`);
      }
      break;
    }
    case 'create': {
      const phase = args[1];
      if (!phase) { console.error('Usage: sugar workspace create <phase> [--branch <name>]'); process.exit(1); }
      const branch = getFlag(args, '--branch');
      const ws = mgr.createWorkspace(phase, branch);
      mgr.initProgress(ws);
      console.log(`Created workspace: ${ws.path} (branch: ${ws.branch})`);
      break;
    }
    case 'destroy': {
      const phase = args[1];
      if (!phase) { console.error('Usage: sugar workspace destroy <phase> [--force]'); process.exit(1); }
      const force = args.includes('--force');
      const result = mgr.destroyWorkspace(
        { phase, branch: phase, path: path.join(resolveWorkspaceBasePath(config, repoRoot), phase), model: '' },
        { force },
      );
      if (result.removed) {
        console.log(`Destroyed workspace: ${phase}`);
      } else {
        console.log(`Worktree removed, branch kept: ${phase}`);
        console.log(`  ${result.reason}`);
      }
      break;
    }
    case 'cleanup': {
      const force = args.includes('--force');
      const { removed, kept } = mgr.cleanupAll({ force });
      if (removed.length > 0) console.log(`Cleaned up: ${removed.join(', ')}`);
      if (kept.length > 0) {
        console.log('Kept (unmerged branches — pass --force to delete anyway):');
        for (const k of kept) console.log(`  ${k.phase}: ${k.reason}`);
      }
      if (removed.length === 0 && kept.length === 0) console.log('No workspaces found.');
      break;
    }
    default:
      console.error('Usage: sugar workspace <list|create|destroy|cleanup> [--force]');
      process.exit(1);
  }
}

function generateCmd(args: string[]): void {
  const phasesFile = getFlag(args, '--phases');
  const taskDescription = getFlag(args, '--task') || '';

  if (!phasesFile) {
    console.error('Usage: sugar generate --phases <phases.json> [--task "<description>"]');
    process.exit(1);
  }
  if (!fs.existsSync(phasesFile)) {
    console.error(`File not found: ${phasesFile}`);
    process.exit(1);
  }

  let phases: PhaseDefinition[];
  try {
    phases = JSON.parse(fs.readFileSync(phasesFile, 'utf-8'));
  } catch {
    console.error(`Invalid JSON: ${phasesFile}`);
    process.exit(1);
  }
  if (!Array.isArray(phases) || phases.length === 0) {
    console.error(`${phasesFile} must contain a non-empty array of phase definitions`);
    process.exit(1);
  }

  const repoRoot = findRepoRoot();
  const config = loadConfig(repoRoot);
  const orchestrator = new Orchestrator(repoRoot, config);

  let workspaces;
  try {
    workspaces = orchestrator.resolveWorkspaces(phases);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const graph = orchestrator.analyze(phases);
  orchestrator.generateWorkspaceFiles(workspaces, phases, taskDescription, graph);

  console.log(`Generated workspace files for ${workspaces.length} phase(s):`);
  for (const ws of workspaces) {
    console.log(`  ${ws.phase.padEnd(28)} -> ${ws.path}`);
  }
  console.log(`execution.md written to ${path.join(repoRoot, 'execution.md')}`);
}

function propagatePatterns(args: string[]): void {
  const basePath = getFlag(args, '--base') || process.cwd();
  const repoRoot = findRepoRoot();
  const mgr = new PatternManager(repoRoot);
  const inject = args.includes('--inject');
  const onlyArg = getFlag(args, '--only');
  const only = onlyArg ? onlyArg.split(',').map(s => s.trim()).filter(Boolean) : null;

  if (!fs.existsSync(basePath)) {
    console.error(`Directory not found: ${basePath}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(basePath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const progressPath = path.join(basePath, entry.name, 'progress.txt');
    if (fs.existsSync(progressPath)) {
      const discovered = mgr.propagateFromPhase(progressPath, entry.name, []);
      if (discovered.length > 0) {
        console.log(`  ${entry.name}: ${discovered.length} patterns extracted`);
      }
    }
  }

  const patterns = mgr.readPatterns();
  console.log(`Total patterns: ${patterns.patterns.length}`);

  if (!inject) return;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (only && !only.includes(entry.name)) continue;
    const claudePath = path.join(basePath, entry.name, 'CLAUDE.md');
    if (!fs.existsSync(claudePath)) continue;
    const content = fs.readFileSync(claudePath, 'utf-8');
    const updated = mgr.injectPatterns(content, patterns.patterns);
    if (updated !== content) {
      fs.writeFileSync(claudePath, updated);
      console.log(`  ${entry.name}: patterns injected into CLAUDE.md`);
    }
  }
}

// ============================================================
// Usage + main
// ============================================================

function printUsage(): void {
  console.log('sugar — CLI for phased software engineering execution');
  console.log('');
  console.log('Usage:');
  console.log('  sugar validate <prd.json>                       Validate a prd.json file');
  console.log('  sugar status <prd.json>                          Show story completion status');
  console.log('  sugar status-all <base-path>                     Scan all phase workspaces');
  console.log('  sugar dashboard <base-path>                      Generate HTML dashboard');
  console.log('  sugar brainstorm <description>                   Generate brainstorm HTML');
  console.log('');
  console.log('  sugar config init                                Create sugar.config.json');
  console.log('  sugar workspace <list|create|destroy|cleanup> [--force]');
  console.log('                                                    Manage workspaces (destroy/cleanup keep unmerged branches unless --force)');
  console.log('  sugar generate --phases <file> [--task <desc>]   Generate prd.json/CLAUDE.md/VERIFY.md/ralph-loop.sh + execution.md');
  console.log('  sugar run <workspace> [--max-iterations n] [--model m]');
  console.log('                                                    Run the Ralph loop for a workspace until complete/stuck/max iterations');
  console.log('  sugar pick-story [--workspace <path>] [--strict] Get next story ID (or PHASE_COMPLETE/PHASE_STUCK with --strict)');
  console.log('  sugar story-update --story <id> --status <s>     Update story status');
  console.log('  sugar snapshot --story <id> --attempt <n>        Create git snapshot tag');
  console.log('  sugar verify --story <id> [--workspace <path>]   Run verifier quorum, tally consensus');
  console.log('  sugar propagate-patterns [--base <path>] [--inject] [--only <phases>]');
  console.log('                                                    Extract and merge patterns, optionally injecting into CLAUDE.md');
  console.log('');
  console.log('Examples:');
  console.log('  sugar validate /tmp/myapp-phases/phase-a/prd.json');
  console.log('  sugar status-all /tmp/myapp-phases');
  console.log('  sugar workspace create phase-a-types');
  console.log('  sugar generate --phases phases.json --task "Refactor the payments module"');
  console.log('  sugar run /tmp/myapp-phases/phase-a --max-iterations 20');
  console.log('  sugar pick-story --workspace /tmp/myapp-phases/phase-a');
  console.log('  sugar story-update --story US-001 --status passed --workspace /tmp/myapp-phases/phase-a');
  console.log('  sugar verify --story US-001 --workspace /tmp/myapp-phases/phase-a');
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
  const args = process.argv.slice(2);
  const command = args[0];
  const target = args[1];

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
    case 'brainstorm': {
      if (!target) { printUsage(); process.exit(1); }
      generateBrainstorm(target);
      break;
    }
    case 'config': {
      if (target === 'init') configInit();
      else { console.error('Usage: sugar config init'); process.exit(1); }
      break;
    }
    case 'workspace': {
      workspaceCmd(args.slice(1));
      break;
    }
    case 'generate': {
      generateCmd(args.slice(1));
      break;
    }
    case 'pick-story': {
      pickStory(args.slice(1));
      break;
    }
    case 'story-update': {
      storyUpdate(args.slice(1));
      break;
    }
    case 'snapshot': {
      snapshot(args.slice(1));
      break;
    }
    case 'verify': {
      verifyStory(args.slice(1));
      break;
    }
    case 'run': {
      runCmd(args.slice(1));
      break;
    }
    case 'propagate-patterns': {
      propagatePatterns(args.slice(1));
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main();
