function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildBrainstormHtml(description: string, timestamp: string): string {
  const safeDescription = escapeHtml(description);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Brainstorm — ${safeDescription}</title>
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
  .idea-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
  .idea-row input { flex: 1; }
  .idea-row .num { color: #64748b; font-size: 0.85em; min-width: 28px; text-align: right; }
  .cluster-zone { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 12px; }
  .cluster { background: #0f172a; border: 2px dashed #334155; border-radius: 8px; padding: 12px; min-width: 200px; flex: 1; min-height: 120px; }
  .cluster.drag-over { border-color: #60a5fa; background: #1a2744; }
  .cluster h3 { margin: 0 0 8px; font-size: 0.95em; color: #94a3b8; display: flex; align-items: center; gap: 8px; }
  .cluster h3 input { font-size: 0.95em; }
  .chip { background: #334155; color: #e2e8f0; padding: 4px 10px; border-radius: 4px; font-size: 0.85em; margin-bottom: 4px; cursor: grab; display: inline-block; }
  .chip:active { cursor: grabbing; }
  .eval-table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.85em; }
  .eval-table th { text-align: left; color: #64748b; padding: 6px 8px; border-bottom: 1px solid #334155; }
  .eval-table td { padding: 6px 8px; border-bottom: 1px solid #1e293b; vertical-align: middle; }
  .eval-table input[type="range"] { width: 80px; accent-color: #60a5fa; }
  .score-val { display: inline-block; min-width: 18px; text-align: center; color: #94a3b8; font-size: 0.85em; }
  .ratio { color: #60a5fa; font-weight: 600; }
  .top-pick { background: #0f172a; border-radius: 8px; padding: 16px; margin-bottom: 12px; border-left: 4px solid #22c55e; }
  .top-pick h3 { margin: 0 0 10px; font-size: 1em; color: #f1f5f9; }
  .top-pick label { display: block; color: #64748b; font-size: 0.8em; margin-bottom: 4px; margin-top: 10px; }
</style>
</head>
<body>
<h1>Brainstorm</h1>
<div class="timestamp">Generated: ${timestamp}</div>
<div class="feature-desc"><strong>Feature:</strong> ${safeDescription}</div>
<div class="phase" id="phase-diverge">
  <h2><span class="phase-num">Phase 1</span> Diverge</h2>
  <p class="phase-subtitle">Generate as many ideas as possible. Quantity over quality.</p>
  <div id="idea-list"></div>
  <button onclick="addIdea()">+ Add idea</button>
</div>
<div class="phase" id="phase-cluster">
  <h2><span class="phase-num">Phase 2</span> Cluster</h2>
  <p class="phase-subtitle">Drag ideas into thematic groups. Rename clusters as needed.</p>
  <button onclick="refreshChips()">Refresh ideas from Phase 1</button>
  <button onclick="addCluster()">+ Add cluster</button>
  <div class="cluster-zone" id="cluster-zone"></div>
</div>
<div class="phase" id="phase-evaluate">
  <h2><span class="phase-num">Phase 3</span> Evaluate</h2>
  <p class="phase-subtitle">Score each idea / cluster. Score = Impact / Effort.</p>
  <button onclick="refreshEvalTable()">Refresh from clusters</button>
  <table class="eval-table" id="eval-table">
    <thead><tr><th>Idea / Cluster</th><th>Feasibility (1-5)</th><th>Impact (1-5)</th><th>Effort (1-5)</th><th>Score</th></tr></thead>
    <tbody id="eval-body"></tbody>
  </table>
</div>
<div class="phase" id="phase-converge">
  <h2><span class="phase-num">Phase 4</span> Converge</h2>
  <p class="phase-subtitle">Top 3 ideas by score with risks and next steps.</p>
  <button onclick="refreshConverge()">Refresh top picks from scores</button>
  <div id="converge-list"></div>
</div>
<script>
(function() {
  var ideaCount = 0;
  window.addIdea = function(value) {
    ideaCount++;
    var list = document.getElementById('idea-list');
    var row = document.createElement('div');
    row.className = 'idea-row';
    row.innerHTML = '<span class="num">' + ideaCount + '.</span><input type="text" class="idea-input" placeholder="Idea..." value="' + (value || '') + '" /><button class="danger" onclick="this.parentElement.remove()">x</button>';
    list.appendChild(row);
  };
  for (var i = 0; i < 10; i++) { window.addIdea(''); }
  function getIdeas() {
    var inputs = document.querySelectorAll('.idea-input');
    var ideas = [];
    inputs.forEach(function(el) { if (el.value.trim()) ideas.push(el.value.trim()); });
    return ideas;
  }
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
      e.preventDefault(); div.classList.remove('drag-over');
      var text = e.dataTransfer.getData('text/plain');
      var srcCluster = e.dataTransfer.getData('application/cluster');
      if (srcCluster) { var srcEl = document.querySelector('.cluster[data-cluster="' + srcCluster + '"]'); if (srcEl) { var chips = srcEl.querySelectorAll('.chip'); chips.forEach(function(c) { if (c.textContent === text) c.remove(); }); } }
      var chip = makeChip(text, clusterCount);
      div.appendChild(chip);
    });
    div.innerHTML = '<h3><input type="text" value="' + (name || 'Cluster ' + clusterCount) + '" style="background:transparent;border:none;color:#94a3b8;padding:0;" /></h3>';
    zone.appendChild(div);
    return div;
  };
  function makeChip(text, clusterId) {
    var chip = document.createElement('div');
    chip.className = 'chip'; chip.textContent = text; chip.draggable = true;
    chip.addEventListener('dragstart', function(e) { e.dataTransfer.setData('text/plain', text); e.dataTransfer.setData('application/cluster', clusterId || ''); });
    return chip;
  }
  window.refreshChips = function() {
    var zone = document.getElementById('cluster-zone'); zone.innerHTML = ''; clusterCount = 0;
    var ideas = getIdeas();
    var unclustered = window.addCluster('Unclustered');
    ideas.forEach(function(idea) { unclustered.appendChild(makeChip(idea, 1)); });
    window.addCluster('Group A'); window.addCluster('Group B');
  };
  function getClusterItems() {
    var items = [];
    document.querySelectorAll('.cluster').forEach(function(cl) {
      var name = cl.querySelector('h3 input') ? cl.querySelector('h3 input').value : 'Unnamed';
      cl.querySelectorAll('.chip').forEach(function(ch) { items.push(name + ': ' + ch.textContent); });
    });
    if (items.length === 0) { getIdeas().forEach(function(idea) { items.push(idea); }); }
    return items;
  }
  function calcRatio(impact, effort) { return effort > 0 ? (impact / effort).toFixed(2) : '—'; }
  window.refreshEvalTable = function() {
    var body = document.getElementById('eval-body'); body.innerHTML = '';
    getClusterItems().forEach(function(item, idx) {
      var tr = document.createElement('tr'); tr.setAttribute('data-idx', idx);
      tr.innerHTML = '<td>' + item + '</td><td><input type="range" min="1" max="5" value="3" class="sl-feasibility" oninput="updateScore(this)" /><span class="score-val">3</span></td><td><input type="range" min="1" max="5" value="3" class="sl-impact" oninput="updateScore(this)" /><span class="score-val">3</span></td><td><input type="range" min="1" max="5" value="3" class="sl-effort" oninput="updateScore(this)" /><span class="score-val">3</span></td><td class="ratio">' + calcRatio(3, 3) + '</td>';
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
  window.refreshConverge = function() {
    var rows = document.querySelectorAll('#eval-body tr'); var scored = [];
    rows.forEach(function(tr) {
      var label = tr.cells[0].textContent;
      var impact = parseInt(tr.querySelector('.sl-impact').value);
      var effort = parseInt(tr.querySelector('.sl-effort').value);
      var feasibility = parseInt(tr.querySelector('.sl-feasibility').value);
      scored.push({ label: label, ratio: effort > 0 ? impact / effort : 0, feasibility: feasibility, impact: impact, effort: effort });
    });
    scored.sort(function(a, b) { return b.ratio - a.ratio; });
    var top = scored.slice(0, 3);
    var list = document.getElementById('converge-list'); list.innerHTML = '';
    if (top.length === 0) { list.innerHTML = '<p style="color:#64748b;">No scored items yet. Complete Phase 3 first.</p>'; return; }
    top.forEach(function(item, i) {
      var div = document.createElement('div'); div.className = 'top-pick';
      div.innerHTML = '<h3>#' + (i + 1) + ' — ' + item.label + ' <span style="color:#60a5fa;font-size:0.85em;">(score: ' + item.ratio.toFixed(2) + ')</span></h3><label>Description</label><textarea placeholder="Describe the approach..."></textarea><label>Risks</label><textarea placeholder="What could go wrong?"></textarea><label>Next Step</label><input type="text" placeholder="Concrete next action..." />';
      list.appendChild(div);
    });
  };
})();
</script>
</body>
</html>`;
}
