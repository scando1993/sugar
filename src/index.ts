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

function generateBrainstorm(description: string): void {
  const timestamp = new Date().toISOString();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Brainstorm — ${description}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 24px; }
  h1 { color: #f8fafc; margin-bottom: 4px; }
  .timestamp { color: #64748b; font-size: 0.85em; margin-bottom: 24px; }
  .feature-desc { background: #1e293b; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; color: #94a3b8; font-size: 0.95em; border-left: 4px solid #60a5fa; }
  .phase { background: #1e293b; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
  .phase h2 { margin: 0 0 4px; font-size: 1.15em; color: #f1f5f9; }
  .phase-num { font-size: 0.75em; background: #334155; padding: 2px 8px; border-radius: 4px; color: #94a3b8; margin-right: 8px; vertical-align: middle; }
  .phase-subtitle { color: #64748b; font-size: 0.85em; margin-bottom: 16px; }
  button { background: #334155; color: #e2e8f0; border: none; border-radius: 6px; padding: 6px 14px; cursor: pointer; font-size: 0.85em; }
  button:hover { background: #475569; }
  button.danger { background: #7f1d1d; }
  button.danger:hover { background: #991b1b; }
  input[type="text"], textarea { background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 6px; padding: 8px 12px; width: 100%; font-size: 0.9em; font-family: inherit; }
  input[type="text"]:focus, textarea:focus { outline: none; border-color: #60a5fa; }
  textarea { resize: vertical; min-height: 60px; }

  /* Phase 1 — Diverge */
  .idea-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
  .idea-row input { flex: 1; }
  .idea-row .num { color: #64748b; font-size: 0.85em; min-width: 28px; text-align: right; }

  /* Phase 2 — Cluster */
  .cluster-zone { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 12px; }
  .cluster { background: #0f172a; border: 2px dashed #334155; border-radius: 8px; padding: 12px; min-width: 200px; flex: 1; min-height: 120px; }
  .cluster.drag-over { border-color: #60a5fa; background: #1a2744; }
  .cluster h3 { margin: 0 0 8px; font-size: 0.95em; color: #94a3b8; display: flex; align-items: center; gap: 8px; }
  .cluster h3 input { font-size: 0.95em; }
  .chip { background: #334155; color: #e2e8f0; padding: 4px 10px; border-radius: 4px; font-size: 0.85em; margin-bottom: 4px; cursor: grab; display: inline-block; }
  .chip:active { cursor: grabbing; }

  /* Phase 3 — Evaluate */
  .eval-table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.85em; }
  .eval-table th { text-align: left; color: #64748b; padding: 6px 8px; border-bottom: 1px solid #334155; }
  .eval-table td { padding: 6px 8px; border-bottom: 1px solid #1e293b; vertical-align: middle; }
  .eval-table input[type="range"] { width: 80px; accent-color: #60a5fa; }
  .score-val { display: inline-block; min-width: 18px; text-align: center; color: #94a3b8; font-size: 0.85em; }
  .ratio { color: #60a5fa; font-weight: 600; }

  /* Phase 4 — Converge */
  .top-pick { background: #0f172a; border-radius: 8px; padding: 16px; margin-bottom: 12px; border-left: 4px solid #22c55e; }
  .top-pick h3 { margin: 0 0 10px; font-size: 1em; color: #f1f5f9; }
  .top-pick label { display: block; color: #64748b; font-size: 0.8em; margin-bottom: 4px; margin-top: 10px; }
</style>
</head>
<body>

<h1>Brainstorm</h1>
<div class="timestamp">Generated: ${timestamp}</div>
<div class="feature-desc"><strong>Feature:</strong> ${description}</div>

<!-- ============ Phase 1: Diverge ============ -->
<div class="phase" id="phase-diverge">
  <h2><span class="phase-num">Phase 1</span> Diverge</h2>
  <p class="phase-subtitle">Generate as many ideas as possible. Quantity over quality.</p>
  <div id="idea-list"></div>
  <button onclick="addIdea()">+ Add idea</button>
</div>

<!-- ============ Phase 2: Cluster ============ -->
<div class="phase" id="phase-cluster">
  <h2><span class="phase-num">Phase 2</span> Cluster</h2>
  <p class="phase-subtitle">Drag ideas into thematic groups. Rename clusters as needed.</p>
  <button onclick="refreshChips()">Refresh ideas from Phase 1</button>
  <button onclick="addCluster()">+ Add cluster</button>
  <div class="cluster-zone" id="cluster-zone"></div>
</div>

<!-- ============ Phase 3: Evaluate ============ -->
<div class="phase" id="phase-evaluate">
  <h2><span class="phase-num">Phase 3</span> Evaluate</h2>
  <p class="phase-subtitle">Score each idea / cluster. Score = Impact / Effort.</p>
  <button onclick="refreshEvalTable()">Refresh from clusters</button>
  <table class="eval-table" id="eval-table">
    <thead><tr><th>Idea / Cluster</th><th>Feasibility (1-5)</th><th>Impact (1-5)</th><th>Effort (1-5)</th><th>Score</th></tr></thead>
    <tbody id="eval-body"></tbody>
  </table>
</div>

<!-- ============ Phase 4: Converge ============ -->
<div class="phase" id="phase-converge">
  <h2><span class="phase-num">Phase 4</span> Converge</h2>
  <p class="phase-subtitle">Top 3 ideas by score with risks and next steps.</p>
  <button onclick="refreshConverge()">Refresh top picks from scores</button>
  <div id="converge-list"></div>
</div>

<script>
(function() {
  /* ---- Phase 1: Diverge ---- */
  var ideaCount = 0;
  window.addIdea = function(value) {
    ideaCount++;
    var list = document.getElementById('idea-list');
    var row = document.createElement('div');
    row.className = 'idea-row';
    row.innerHTML = '<span class="num">' + ideaCount + '.</span>' +
      '<input type="text" class="idea-input" placeholder="Idea..." value="' + (value || '') + '" />' +
      '<button class="danger" onclick="this.parentElement.remove()">x</button>';
    list.appendChild(row);
  };
  for (var i = 0; i < 10; i++) { window.addIdea(''); }

  function getIdeas() {
    var inputs = document.querySelectorAll('.idea-input');
    var ideas = [];
    inputs.forEach(function(el) { if (el.value.trim()) ideas.push(el.value.trim()); });
    return ideas;
  }

  /* ---- Phase 2: Cluster ---- */
  var clusterCount = 0;
  window.addCluster = function(name) {
    clusterCount++;
    var zone = document.getElementById('cluster-zone');
    var div = document.createElement('div');
    div.className = 'cluster';
    div.setAttribute('data-cluster', clusterCount);
    div.addEventListener('dragover', function(e) { e.preventDefault(); div.classList.add('drag-over'); });
    div.addEventListener('dragleave', function() { div.classList.remove('drag-over'); });
    div.addEventListener('drop', function(e) {
      e.preventDefault();
      div.classList.remove('drag-over');
      var text = e.dataTransfer.getData('text/plain');
      var srcCluster = e.dataTransfer.getData('application/cluster');
      if (srcCluster) {
        var srcEl = document.querySelector('.cluster[data-cluster="' + srcCluster + '"]');
        if (srcEl) {
          var chips = srcEl.querySelectorAll('.chip');
          chips.forEach(function(c) { if (c.textContent === text) c.remove(); });
        }
      }
      var chip = makeChip(text, clusterCount);
      div.appendChild(chip);
    });
    div.innerHTML = '<h3><input type="text" value="' + (name || 'Cluster ' + clusterCount) + '" style="background:transparent;border:none;color:#94a3b8;padding:0;" /></h3>';
    zone.appendChild(div);
    return div;
  };

  function makeChip(text, clusterId) {
    var chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = text;
    chip.draggable = true;
    chip.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('text/plain', text);
      e.dataTransfer.setData('application/cluster', clusterId || '');
    });
    return chip;
  }

  window.refreshChips = function() {
    var zone = document.getElementById('cluster-zone');
    zone.innerHTML = '';
    clusterCount = 0;
    var ideas = getIdeas();
    var unclustered = window.addCluster('Unclustered');
    ideas.forEach(function(idea) {
      unclustered.appendChild(makeChip(idea, 1));
    });
    window.addCluster('Group A');
    window.addCluster('Group B');
  };

  /* ---- Phase 3: Evaluate ---- */
  function getClusterItems() {
    var items = [];
    var clusters = document.querySelectorAll('.cluster');
    clusters.forEach(function(cl) {
      var name = cl.querySelector('h3 input') ? cl.querySelector('h3 input').value : 'Unnamed';
      var chips = cl.querySelectorAll('.chip');
      if (chips.length > 0) {
        chips.forEach(function(ch) {
          items.push(name + ': ' + ch.textContent);
        });
      }
    });
    if (items.length === 0) {
      var ideas = getIdeas();
      ideas.forEach(function(idea) { items.push(idea); });
    }
    return items;
  }

  function calcRatio(impact, effort) {
    return effort > 0 ? (impact / effort).toFixed(2) : '—';
  }

  window.refreshEvalTable = function() {
    var body = document.getElementById('eval-body');
    body.innerHTML = '';
    var items = getClusterItems();
    items.forEach(function(item, idx) {
      var tr = document.createElement('tr');
      tr.setAttribute('data-idx', idx);
      tr.innerHTML = '<td>' + item + '</td>' +
        '<td><input type="range" min="1" max="5" value="3" class="sl-feasibility" oninput="updateScore(this)" /><span class="score-val">3</span></td>' +
        '<td><input type="range" min="1" max="5" value="3" class="sl-impact" oninput="updateScore(this)" /><span class="score-val">3</span></td>' +
        '<td><input type="range" min="1" max="5" value="3" class="sl-effort" oninput="updateScore(this)" /><span class="score-val">3</span></td>' +
        '<td class="ratio">' + calcRatio(3, 3) + '</td>';
      body.appendChild(tr);
    });
  };

  window.updateScore = function(el) {
    el.nextElementSibling.textContent = el.value;
    var tr = el.closest('tr');
    var impact = parseInt(tr.querySelector('.sl-impact').value);
    var effort = parseInt(tr.querySelector('.sl-effort').value);
    tr.querySelector('.ratio').textContent = calcRatio(impact, effort);
  };

  /* ---- Phase 4: Converge ---- */
  window.refreshConverge = function() {
    var rows = document.querySelectorAll('#eval-body tr');
    var scored = [];
    rows.forEach(function(tr) {
      var label = tr.cells[0].textContent;
      var impact = parseInt(tr.querySelector('.sl-impact').value);
      var effort = parseInt(tr.querySelector('.sl-effort').value);
      var feasibility = parseInt(tr.querySelector('.sl-feasibility').value);
      var ratio = effort > 0 ? impact / effort : 0;
      scored.push({ label: label, ratio: ratio, feasibility: feasibility, impact: impact, effort: effort });
    });
    scored.sort(function(a, b) { return b.ratio - a.ratio; });
    var top = scored.slice(0, 3);

    var list = document.getElementById('converge-list');
    list.innerHTML = '';
    if (top.length === 0) {
      list.innerHTML = '<p style="color:#64748b;">No scored items yet. Complete Phase 3 first.</p>';
      return;
    }
    top.forEach(function(item, i) {
      var div = document.createElement('div');
      div.className = 'top-pick';
      div.innerHTML = '<h3>#' + (i + 1) + ' — ' + item.label + ' <span style="color:#60a5fa;font-size:0.85em;">(score: ' + item.ratio.toFixed(2) + ')</span></h3>' +
        '<label>Description</label><textarea placeholder="Describe the approach..."></textarea>' +
        '<label>Risks</label><textarea placeholder="What could go wrong?"></textarea>' +
        '<label>Next Step</label><input type="text" placeholder="Concrete next action..." />';
      list.appendChild(div);
    });
  };
})();
</script>

</body>
</html>`;

  const outPath = `/tmp/orchestrate-brainstorm-${Date.now()}.html`;
  fs.writeFileSync(outPath, html);
  console.log(`Brainstorm written to: ${outPath}`);

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
  console.log('  orchestrate brainstorm <description>   Generate interactive brainstorm HTML and open in browser');
  console.log('');
  console.log('Examples:');
  console.log('  orchestrate validate /tmp/myapp-phases/phase-a-types/prd.json');
  console.log('  orchestrate status /tmp/myapp-phases/phase-b-api/prd.json');
  console.log('  orchestrate status-all /tmp/myapp-phases');
  console.log('  orchestrate dashboard /tmp/myapp-phases');
  console.log('  orchestrate brainstorm "Add real-time collaboration to the editor"');
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
    case 'brainstorm': {
      if (!target) { printUsage(); process.exit(1); }
      generateBrainstorm(target);
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main();
