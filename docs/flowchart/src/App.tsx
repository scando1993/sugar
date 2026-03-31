import { useState, useRef, useCallback } from 'react';
import type { Node, Edge, NodeChange, EdgeChange, Connection, NodeTypes, ReactFlowInstance } from '@xyflow/react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase =
  | 'setup' | 'phase1' | 'phase2' | 'analysis' | 'generation'
  | 'execution' | 'ralph' | 'error' | 'phase4' | 'done';

type ViewMode = 'overview' | 'phase1' | 'phase2' | 'phase3' | 'phase4';

interface PhaseColor { bg: string; border: string; tag: string }

const phaseColors: Record<Phase, PhaseColor> = {
  setup:      { bg: '#f0f7ff', border: '#4a90d9', tag: 'Input' },
  phase1:     { bg: '#f0f7ff', border: '#4a90d9', tag: 'Phase 1' },
  phase2:     { bg: '#f0f7ff', border: '#4a90d9', tag: 'Phase 2' },
  analysis:   { bg: '#faf0ff', border: '#8b5cf6', tag: 'Phase 3a' },
  generation: { bg: '#f0fffe', border: '#0891b2', tag: 'Phase 3b' },
  execution:  { bg: '#f0fff4', border: '#22863a', tag: 'Phase 3c' },
  ralph:      { bg: '#fff8f0', border: '#d97706', tag: 'Agent Loop' },
  error:      { bg: '#fff2f2', border: '#dc2626', tag: 'Error' },
  phase4:     { bg: '#fdf0ff', border: '#9333ea', tag: 'Phase 4' },
  done:       { bg: '#f0fff4', border: '#38a169', tag: 'Complete' },
};

// ─── Overview cards ──────────────────────────────────────────────────────────

const overviewCards = [
  {
    id: 'ov-1', num: '01', title: 'Planning',
    color: phaseColors.phase1,
    description: 'Analyze the task and produce a complete execution plan — without writing any code.',
    artifacts: ['plan.md', 'todo.md'],
    detail: 'phase1' as ViewMode,
  },
  {
    id: 'ov-2', num: '02', title: 'Workspace Setup',
    color: phaseColors.phase2,
    description: 'Create an isolated git worktree and branch for each execution phase.',
    artifacts: ['git worktrees', 'branches', 'progress.txt'],
    detail: 'phase2' as ViewMode,
  },
  {
    id: 'ov-3', num: '03', title: 'Implementation',
    color: phaseColors.execution,
    description: 'Dependency analysis → PRD generation → parallel agent loops. One story at a time, atomic commits.',
    artifacts: ['execution.md', 'prd.json', 'CLAUDE.md', 'ralph-loop.sh'],
    detail: 'phase3' as ViewMode,
  },
  {
    id: 'ov-4', num: '04', title: 'Merge',
    color: phaseColors.phase4,
    description: 'Merge all phase branches in dependency order. Validate with full quality checks after each merge.',
    artifacts: ['merge_order.md'],
    detail: 'phase4' as ViewMode,
  },
];

// ─── Steps ───────────────────────────────────────────────────────────────────

const allSteps: {
  id: string; label: string; description: string; phase: Phase;
  type?: 'custom' | 'decision' | 'gate';
}[] = [
  // Phase 1
  { id: '1', label: '/phase <your task>',        description: 'Invoke the orchestration skill',                         phase: 'setup' },
  { id: '2', label: 'Phase 1 — Planning',         description: 'Produce plan.md + todo.md · no code written',           phase: 'phase1' },
  { id: '3', label: 'User approval gate',         description: 'Review plan before any code is written',                phase: 'phase1', type: 'gate' },
  // Phase 2
  { id: '4', label: 'Phase 2 — Workspace Setup', description: 'git worktree per phase · init progress.txt',            phase: 'phase2' },
  { id: '5', label: 'User approval gate',         description: 'Verify branches and workspaces are ready',              phase: 'phase2', type: 'gate' },
  // Phase 3
  { id: '6',  label: 'Phase 3a — Dep Analysis',    description: 'Map produces/consumes · parallel groups · critical path', phase: 'analysis' },
  { id: '7',  label: 'Phase 3b — PRD Generation',  description: 'execution.md · prd.json · CLAUDE.md · ralph-loop.sh',     phase: 'generation' },
  { id: '8',  label: 'Phase 3c — Launch',          description: 'Spawn ralph-loop.sh for each group in parallel',           phase: 'execution' },
  { id: '9',  label: 'Read prd.json + progress.txt', description: 'Check Codebase Patterns section first',               phase: 'ralph' },
  { id: '10', label: 'Pick next story',            description: 'Highest priority where passes: false',                  phase: 'ralph' },
  { id: '11', label: 'No stories left?',           description: '',                                                       phase: 'ralph', type: 'decision' },
  { id: '12', label: 'Implement the story',        description: 'One story · focused scope · follow patterns',           phase: 'ralph' },
  { id: '13', label: 'Run quality checks',         description: 'typecheck · lint · tests',                              phase: 'ralph' },
  { id: '14', label: 'Checks pass?',               description: '',                                                       phase: 'ralph', type: 'decision' },
  { id: '15', label: 'Retry fix (1–3 attempts)',   description: 'Read error · targeted fix · re-run checks',             phase: 'error' },
  { id: '16', label: 'Still failing after 3x?',   description: '',                                                       phase: 'error', type: 'decision' },
  { id: '17', label: 'Record blocker + reset',     description: 'Set prd.json notes · git checkout -- .',                phase: 'error' },
  { id: '18', label: 'Commit changes',             description: 'feat: US-001 - Story Title',                            phase: 'ralph' },
  { id: '19', label: 'Set passes: true',           description: 'Update story state in prd.json',                        phase: 'ralph' },
  { id: '20', label: 'Append to progress.txt',     description: 'Learnings · codebase patterns · gotchas',               phase: 'ralph' },
  { id: '21', label: 'More stories?',              description: '',                                                       phase: 'ralph', type: 'decision' },
  { id: '22', label: 'Push + PHASE_COMPLETE',      description: 'git push origin · signal done to loop',                 phase: 'ralph' },
  { id: '23', label: 'All groups done?',           description: '',                                                       phase: 'execution', type: 'decision' },
  { id: '24', label: 'Propagate patterns',         description: 'Inject Group N learnings into Group N+1 CLAUDE.md',     phase: 'execution' },
  { id: '25', label: 'Launch next group',          description: 'Dependent phases now run in parallel',                  phase: 'execution' },
  { id: '26', label: 'User approval gate',         description: 'Confirm all stories pass · review any blockers',        phase: 'execution', type: 'gate' },
  // Phase 4
  { id: '27', label: 'Phase 4 — Merge',           description: 'Create merge_order.md · dependency order',              phase: 'phase4' },
  { id: '28', label: 'Merge branch + validate',   description: 'One merge · typecheck · lint · tests',                  phase: 'phase4' },
  { id: '29', label: 'All merges done?',          description: '',                                                       phase: 'phase4', type: 'decision' },
  { id: '30', label: 'Done!',                      description: 'All phases merged · final validation passes',           phase: 'done' },
];

// Ordered step ID list per phase (controls the reveal sequence)
const phaseStepLists: Record<Exclude<ViewMode, 'overview'>, string[]> = {
  phase1: ['1', '2', '3'],
  phase2: ['4', '5'],
  phase3: ['6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26'],
  phase4: ['27', '28', '29', '30'],
};

// ─── Notes (phase 3 only) ─────────────────────────────────────────────────────

// appearsAfterStepId: show when this step ID has been revealed
const notes = [
  {
    id: 'note-prd',
    appearsAfterStepId: '7',
    position: { x: 760, y: 560 },
    color: { bg: '#f0fffe', border: '#0891b2' },
    content: `// prd.json (per phase workspace)
{
  "project": "my-app",
  "branchName": "phase-a-types",
  "userStories": [{
    "id": "US-001",
    "title": "Add status column",
    "acceptanceCriteria": [
      "Add column with default 'pending'",
      "Generate and run migration",
      "Typecheck passes"
    ],
    "priority": 1,
    "passes": false,
    "notes": ""
  }]
}`,
  },
  {
    id: 'note-progress',
    appearsAfterStepId: '20',
    position: { x: 850, y: 1160 },
    color: { bg: '#fff8f0', border: '#d97706' },
    content: `## Codebase Patterns
- Use drizzle ORM for all DB queries
- Server actions live in app/actions/
- Mutations go through useAction hook

## 2025-06-01 — US-003
Files: db/schema.ts, migrations/003.sql
Learning: run tsc after every schema change`,
  },
];

// ─── Positions ────────────────────────────────────────────────────────────────

const ovPositions: Record<string, { x: number; y: number }> = {
  'ov-1': { x: 0, y: 0 },
  'ov-2': { x: 0, y: 210 },
  'ov-3': { x: 0, y: 420 },
  'ov-4': { x: 0, y: 630 },
};

// Each phase has its own local coordinate system (starts near 0,0)
const stepPositions: Record<string, { x: number; y: number }> = {
  // Phase 1
  '1': { x: 60, y: 20 },
  '2': { x: 60, y: 140 },
  '3': { x: 70, y: 260 },
  // Phase 2
  '4': { x: 60, y: 20 },
  '5': { x: 70, y: 140 },
  // Phase 3 — main spine x=60, loop x=440, error x=720
  '6':  { x: 60,  y: 20 },
  '7':  { x: 60,  y: 140 },
  '8':  { x: 60,  y: 260 },
  '9':  { x: 440, y: 260 },
  '10': { x: 440, y: 380 },
  '11': { x: 440, y: 500 },
  '12': { x: 440, y: 620 },
  '13': { x: 440, y: 740 },
  '14': { x: 440, y: 860 },
  '15': { x: 720, y: 740 },
  '16': { x: 720, y: 860 },
  '17': { x: 720, y: 980 },
  '18': { x: 440, y: 980 },
  '19': { x: 440, y: 1080 },
  '20': { x: 440, y: 1180 },
  '21': { x: 440, y: 1300 },
  '22': { x: 440, y: 1420 },
  '23': { x: 60,  y: 500 },
  '24': { x: 60,  y: 620 },
  '25': { x: 60,  y: 740 },
  '26': { x: 70,  y: 860 },
  // Phase 4
  '27': { x: 60, y: 20 },
  '28': { x: 60, y: 140 },
  '29': { x: 60, y: 260 },
  '30': { x: 60, y: 380 },
};

// ─── Edges ────────────────────────────────────────────────────────────────────

const edgeConnections: {
  source: string; target: string;
  sourceHandle?: string; targetHandle?: string;
  label?: string;
}[] = [
  { source: '1',  target: '2',  sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '2',  target: '3',  sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '4',  target: '5',  sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '6',  target: '7',  sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '7',  target: '8',  sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '8',  target: '9',  sourceHandle: 'right',  targetHandle: 'left',  label: 'per phase' },
  { source: '9',  target: '10', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '10', target: '11', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '11', target: '22', sourceHandle: 'right',  targetHandle: 'top',   label: 'Yes → done' },
  { source: '11', target: '12', sourceHandle: 'bottom', targetHandle: 'top',   label: 'No' },
  { source: '12', target: '13', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '13', target: '14', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '14', target: '18', sourceHandle: 'bottom', targetHandle: 'top',   label: 'Pass' },
  { source: '14', target: '15', sourceHandle: 'right',  targetHandle: 'top',   label: 'Fail' },
  { source: '15', target: '16', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '16', target: '13', sourceHandle: 'left',   targetHandle: 'right', label: 'No → retry' },
  { source: '16', target: '17', sourceHandle: 'bottom', targetHandle: 'top',   label: 'Yes → skip' },
  { source: '17', target: '10', sourceHandle: 'left',   targetHandle: 'right' },
  { source: '18', target: '19', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '19', target: '20', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '20', target: '21', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '21', target: '9',  sourceHandle: 'right',  targetHandle: 'right', label: 'Yes → loop' },
  { source: '21', target: '22', sourceHandle: 'bottom', targetHandle: 'top',   label: 'No' },
  { source: '22', target: '23', sourceHandle: 'left',   targetHandle: 'right', label: 'phase done' },
  { source: '23', target: '24', sourceHandle: 'bottom', targetHandle: 'top',   label: 'More groups' },
  { source: '24', target: '25', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '25', target: '8',  sourceHandle: 'top',    targetHandle: 'left',  label: 'next group' },
  { source: '23', target: '26', sourceHandle: 'left',   targetHandle: 'right', label: 'All done' },
  { source: '27', target: '28', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '28', target: '29', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '29', target: '28', sourceHandle: 'right',  targetHandle: 'right', label: 'Fix conflicts' },
  { source: '29', target: '30', sourceHandle: 'bottom', targetHandle: 'top',   label: 'All merged' },
];

// ─── Node / edge builders ─────────────────────────────────────────────────────

function buildOverviewNodes(livePos: Record<string, { x: number; y: number }>): Node[] {
  return overviewCards.map(card => ({
    id: card.id,
    type: 'phaseCard',
    position: livePos[card.id] ?? ovPositions[card.id],
    data: card,
  }));
}

function buildOverviewEdges(): Edge[] {
  return [
    { s: 'ov-1', t: 'ov-2' },
    { s: 'ov-2', t: 'ov-3' },
    { s: 'ov-3', t: 'ov-4' },
  ].map(({ s, t }, i) => ({
    id: `ov-e${i}`,
    source: s, target: t,
    sourceHandle: 'bottom', targetHandle: 'top',
    animated: true,
    style: { stroke: '#ccc', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#ccc' },
  }));
}

// visibleUpTo: how many steps (1-based) in this phase are currently revealed
function buildPhaseNodes(
  mode: Exclude<ViewMode, 'overview'>,
  livePos: Record<string, { x: number; y: number }>,
  visibleUpTo: number,
): Node[] {
  const stepList = phaseStepLists[mode];
  const visibleIds = new Set(stepList.slice(0, visibleUpTo));

  const stepNodes = allSteps
    .filter(s => stepList.includes(s.id))
    .map(s => {
      const type = s.type === 'decision' ? 'decision' : s.type === 'gate' ? 'gate' : 'custom';
      const visible = visibleIds.has(s.id);
      return {
        id: s.id,
        type,
        position: livePos[s.id] ?? stepPositions[s.id] ?? { x: 0, y: 0 },
        data: { label: s.label, description: s.description, phase: s.phase },
        style: {
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.45s ease',
          pointerEvents: visible ? ('all' as const) : ('none' as const),
        },
      };
    });

  if (mode !== 'phase3') return stepNodes;

  // Annotation notes for phase 3
  const noteNodes = notes.map(n => {
    const triggerIdx = stepList.indexOf(n.appearsAfterStepId);
    const visible = triggerIdx !== -1 && visibleUpTo > triggerIdx;
    return {
      id: n.id,
      type: 'note',
      position: livePos[n.id] ?? n.position,
      data: { content: n.content, color: n.color },
      style: {
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.6s ease',
        pointerEvents: visible ? ('all' as const) : ('none' as const),
      },
    };
  });

  return [...stepNodes, ...noteNodes];
}

function buildPhaseEdges(
  mode: Exclude<ViewMode, 'overview'>,
  visibleUpTo: number,
): Edge[] {
  const stepList = phaseStepLists[mode];
  const visibleIds = new Set(stepList.slice(0, visibleUpTo));

  return edgeConnections
    .filter(c => visibleIds.has(c.source) && visibleIds.has(c.target))
    .map((c, i) => ({
      id: `pe-${mode}-${i}`,
      source: c.source, target: c.target,
      sourceHandle: c.sourceHandle, targetHandle: c.targetHandle,
      label: c.label,
      animated: true,
      style: { stroke: '#888', strokeWidth: 1.5 },
      labelStyle: { fontSize: 10, fill: '#555', fontWeight: 600 },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.88 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#888' },
    }));
}

// ─── Node components ──────────────────────────────────────────────────────────

function PhaseCardNode({ data }: { data: typeof overviewCards[0] }) {
  const c = data.color;
  return (
    <div className="phase-card-node" style={{ borderColor: c.border, backgroundColor: c.bg }}>
      <Handle type="target" position={Position.Top}    id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <div className="pcard-num" style={{ color: c.border }}>{data.num}</div>
      <div className="pcard-title">{data.title}</div>
      <div className="pcard-desc">{data.description}</div>
      <div className="pcard-artifacts">
        {data.artifacts.map(a => (
          <span key={a} className="pcard-chip" style={{ borderColor: c.border + '55', color: c.border }}>
            {a}
          </span>
        ))}
      </div>
      <div className="pcard-hint">Click to explore steps →</div>
    </div>
  );
}

function CustomNode({ data }: { data: { label: string; description: string; phase: Phase } }) {
  const c = phaseColors[data.phase];
  return (
    <div className="custom-node" style={{ backgroundColor: c.bg, borderColor: c.border }}>
      <Handle type="target" position={Position.Top}    id="top" />
      <Handle type="target" position={Position.Left}   id="left" />
      <Handle type="target" position={Position.Right}  id="right" />
      <Handle type="target" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Top}    id="top" />
      <Handle type="source" position={Position.Left}   id="left" />
      <Handle type="source" position={Position.Right}  id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <div className="node-content">
        <div className="node-phase-tag" style={{ color: c.border }}>{c.tag}</div>
        <div className="node-label">{data.label}</div>
        {data.description && <div className="node-description">{data.description}</div>}
      </div>
    </div>
  );
}

function DecisionNode({ data }: { data: { label: string; description: string; phase: Phase } }) {
  const c = phaseColors[data.phase];
  return (
    <div className="decision-node" style={{ backgroundColor: c.bg, borderColor: c.border }}>
      <Handle type="target" position={Position.Top}    id="top" />
      <Handle type="target" position={Position.Left}   id="left" />
      <Handle type="target" position={Position.Right}  id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left}   id="left" />
      <Handle type="source" position={Position.Right}  id="right" />
      <div className="node-content">
        <div style={{ fontSize: 15, marginBottom: 3 }}>◆</div>
        <div className="node-label" style={{ color: c.border }}>{data.label}</div>
        {data.description && <div className="node-description">{data.description}</div>}
      </div>
    </div>
  );
}

function GateNode({ data }: { data: { label: string; description: string } }) {
  return (
    <div className="gate-node">
      <Handle type="target" position={Position.Top}    id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Right}  id="right" />
      <div className="node-content">
        <div style={{ fontSize: 13, marginBottom: 2 }}>🔒</div>
        <div className="node-label">{data.label}</div>
        {data.description && <div className="node-description">{data.description}</div>}
      </div>
    </div>
  );
}

function NoteNode({ data }: { data: { content: string; color: { bg: string; border: string } } }) {
  return (
    <div className="note-node" style={{ backgroundColor: data.color.bg, borderColor: data.color.border }}>
      <pre>{data.content}</pre>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  phaseCard: PhaseCardNode,
  custom:    CustomNode,
  decision:  DecisionNode,
  gate:      GateNode,
  note:      NoteNode,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const phaseTitles: Record<ViewMode, string> = {
  overview: 'How Orchestration Works',
  phase1:   'Phase 1 — Planning',
  phase2:   'Phase 2 — Workspace Setup',
  phase3:   'Phase 3 — Implementation',
  phase4:   'Phase 4 — Merge',
};

// Pan the viewport to a specific step node
function panToStepId(
  stepId: string,
  livePos: Record<string, { x: number; y: number }>,
  rf: ReactFlowInstance | null,
  delay = 60,
) {
  const step = allSteps.find(s => s.id === stepId);
  if (!step || !rf) return;
  const pos = livePos[stepId] ?? stepPositions[stepId];
  if (!pos) return;
  const nodeW = step.type === 'decision' ? 200 : 240;
  const nodeH = 64;
  setTimeout(() => {
    rf.setCenter(pos.x + nodeW / 2, pos.y + nodeH / 2, { zoom: 1.2, duration: 500 });
  }, delay);
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<ViewMode>('overview');
  // 1-based index of how many steps are revealed in the current phase
  const [phaseStep, setPhaseStep] = useState(0);

  const livePos = useRef<Record<string, { x: number; y: number }>>({
    ...ovPositions,
    ...stepPositions,
    ...Object.fromEntries(notes.map(n => [n.id, n.position])),
  });
  const rfInstance = useRef<ReactFlowInstance | null>(null);

  const [nodes, setNodes] = useNodesState<Node>(buildOverviewNodes(livePos.current));
  const [edges, setEdges] = useEdgesState<Edge>(buildOverviewEdges());

  // ── Navigation ──────────────────────────────────────────

  const goToOverview = useCallback(() => {
    setView('overview');
    setPhaseStep(0);
    setNodes(buildOverviewNodes(livePos.current));
    setEdges(buildOverviewEdges());
    setTimeout(() => rfInstance.current?.fitView({ duration: 500, padding: 0.15 }), 60);
  }, [setNodes, setEdges]);

  const goToPhase = useCallback((mode: Exclude<ViewMode, 'overview'>) => {
    setView(mode);
    setPhaseStep(1);
    setNodes(buildPhaseNodes(mode, livePos.current, 1));
    setEdges(buildPhaseEdges(mode, 1));
    // Pan to first step
    const firstId = phaseStepLists[mode][0];
    panToStepId(firstId, livePos.current, rfInstance.current, 80);
  }, [setNodes, setEdges]);

  const handleNext = useCallback(() => {
    if (view === 'overview') return;
    const mode = view as Exclude<ViewMode, 'overview'>;
    const total = phaseStepLists[mode].length;
    if (phaseStep >= total) return;
    const next = phaseStep + 1;
    setPhaseStep(next);
    setNodes(buildPhaseNodes(mode, livePos.current, next));
    setEdges(buildPhaseEdges(mode, next));
    // Pan to the newly revealed step
    panToStepId(phaseStepLists[mode][next - 1], livePos.current, rfInstance.current);
  }, [view, phaseStep, setNodes, setEdges]);

  const handlePrev = useCallback(() => {
    if (view === 'overview' || phaseStep <= 1) return;
    const mode = view as Exclude<ViewMode, 'overview'>;
    const prev = phaseStep - 1;
    setPhaseStep(prev);
    setNodes(buildPhaseNodes(mode, livePos.current, prev));
    setEdges(buildPhaseEdges(mode, prev));
    panToStepId(phaseStepLists[mode][prev - 1], livePos.current, rfInstance.current);
  }, [view, phaseStep, setNodes, setEdges]);

  const handleShowAll = useCallback(() => {
    if (view === 'overview') return;
    const mode = view as Exclude<ViewMode, 'overview'>;
    const total = phaseStepLists[mode].length;
    setPhaseStep(total);
    setNodes(buildPhaseNodes(mode, livePos.current, total));
    setEdges(buildPhaseEdges(mode, total));
    setTimeout(() => rfInstance.current?.fitView({ duration: 500, padding: 0.12 }), 60);
  }, [view, setNodes, setEdges]);

  // ── Interaction handlers ─────────────────────────────────

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const card = overviewCards.find(c => c.id === node.id);
    if (card) goToPhase(card.detail as Exclude<ViewMode, 'overview'>);
  }, [goToPhase]);

  const onNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    livePos.current[node.id] = { ...node.position };
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes(ns => applyNodeChanges(changes, ns)),
    [setNodes],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges(es => applyEdgeChanges(changes, es)),
    [setEdges],
  );
  const onConnect = useCallback(
    (conn: Connection) => setEdges(es => addEdge(conn, es)),
    [setEdges],
  );

  // ── Derived ──────────────────────────────────────────────

  const isPhaseView = view !== 'overview';
  const totalPhaseSteps = isPhaseView ? phaseStepLists[view as Exclude<ViewMode, 'overview'>].length : 0;
  const currentStepLabel = isPhaseView && phaseStep > 0
    ? allSteps.find(s => s.id === phaseStepLists[view as Exclude<ViewMode, 'overview'>][phaseStep - 1])?.label ?? ''
    : '';

  const legendItems: { phase: Phase; label: string }[] = [
    { phase: 'phase1',     label: 'Phases 1–2' },
    { phase: 'analysis',   label: '3a Dep Analysis' },
    { phase: 'generation', label: '3b PRD Gen' },
    { phase: 'execution',  label: '3c Launch' },
    { phase: 'ralph',      label: 'Agent Loop' },
    { phase: 'error',      label: 'Error Recovery' },
    { phase: 'phase4',     label: 'Phase 4' },
  ];

  return (
    <div className="app-container">

      {/* Header */}
      <div className="header">
        <div className="header-left">
          {isPhaseView && (
            <button className="back-btn" onClick={goToOverview}>← Overview</button>
          )}
        </div>
        <div className="header-center">
          <h1>{phaseTitles[view]}</h1>
          <p>
            {view === 'overview'
              ? 'Click any phase to walk through its steps'
              : `Step ${phaseStep} of ${totalPhaseSteps} — use the controls below`}
          </p>
        </div>
        <div className="header-right" />
      </div>

      {/* Flow canvas */}
      <div className="flow-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          onInit={inst => { rfInstance.current = inst; }}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.12}
          maxZoom={2}
          defaultEdgeOptions={{ type: 'smoothstep' }}
          proOptions={{ hideAttribution: false }}
        >
          <Controls />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e8e8e8" />
        </ReactFlow>
      </div>

      {/* Footer */}
      {isPhaseView ? (
        <div className="footer-controls">
          <button className="ctrl-btn secondary" onClick={goToOverview}>← Overview</button>
          <button className="ctrl-btn" onClick={handlePrev} disabled={phaseStep <= 1}>← Prev</button>
          <div className="step-counter">
            <span className="step-fraction">{phaseStep} / {totalPhaseSteps}</span>
            {currentStepLabel && <span className="step-label">{currentStepLabel}</span>}
          </div>
          <button className="ctrl-btn" onClick={handleNext} disabled={phaseStep >= totalPhaseSteps}>Next →</button>
          <button className="ctrl-btn secondary" onClick={handleShowAll} disabled={phaseStep >= totalPhaseSteps}>
            Show All
          </button>
        </div>
      ) : (
        <div className="footer-legend">
          <div className="legend">
            {legendItems.map(item => (
              <div key={item.phase} className="legend-item">
                <div
                  className="legend-dot"
                  style={{ background: phaseColors[item.phase].bg, borderColor: phaseColors[item.phase].border }}
                />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
