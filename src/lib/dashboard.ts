import { PrdJson } from '../types';

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface DashboardPhase {
  name: string;
  prd: PrdJson;
}

export function buildDashboardHtml(phases: DashboardPhase[], basePath: string, timestamp: string): string {
  const phaseCards = phases.map(({ name, prd }) => {
    const passing = prd.userStories.filter(s => s.status === 'passed').length;
    const total = prd.userStories.length;
    const pct = total > 0 ? Math.round((passing / total) * 100) : 0;
    const color = pct === 100 ? '#22c55e' : pct > 50 ? '#f59e0b' : '#ef4444';

    const storyRows = prd.userStories.map(s => {
      const status = s.status || 'pending';
      const badge = status === 'passed' ? '✓' : status === 'blocked' ? '!' : status === 'rejected' ? '✗' : '○';
      return `<tr><td>${badge}</td><td>${escapeHtml(s.id)}</td><td>${escapeHtml(s.title)}</td><td>${escapeHtml(status)}</td><td>${escapeHtml(s.notes || '')}</td></tr>`;
    }).join('');

    return `
    <div class="phase-card">
      <div class="phase-header">
        <h2>${escapeHtml(prd.project)} — ${escapeHtml(name)}</h2>
        <span class="branch">${escapeHtml(prd.branchName)}</span>
      </div>
      <p class="description">${escapeHtml(prd.description)}</p>
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sugar Dashboard</title>
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
<h1>Sugar Dashboard</h1>
<div class="timestamp">Generated: ${timestamp} | Base: ${escapeHtml(basePath)}</div>
${phaseCards}
</body>
</html>`;
}
