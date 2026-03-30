import { useState, useRef, useCallback } from 'react';
import type { Node, Edge, NodeChange, EdgeChange, Connection, NodeTypes } from '@xyflow/react';
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
  reconnectEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';

// ─── Types ─────────────────────────────────────────────────────────────────

type Phase =
  | 'setup'
  | 'phase1'
  | 'phase2'
  | 'analysis'
  | 'generation'
  | 'execution'
  | 'ralph'
  | 'error'
  | 'phase4'
  | 'done';

interface PhaseColor { bg: string; border: string; tag: string }

const phaseColors: Record<Phase, PhaseColor> = {
  setup:      { bg: '#f0f7ff', border: '#4a90d9', tag: 'Input' },
  phase1:     { bg: '#f0f7ff', border: '#4a90d9', tag: 'Phase 1' },
  phase2:     { bg: '#f0f7ff', border: '#4a90d9', tag: 'Phase 2' },
  analysis:   { bg: '#faf0ff', border: '#8b5cf6', tag: 'Phase 3a' },
  generation: { bg: '#f0fffe', border: '#0891b2', tag: 'Phase 3b' },
  execution:  { bg: '#f0fff4', border: '#22863a', tag: 'Phase 3c' },
  ralph:      { bg: '#fff8f0', border: '#d97706', tag: 'Ralph Loop' },
  error:      { bg: '#fff2f2', border: '#dc2626', tag: 'Error' },
  phase4:     { bg: '#fdf0ff', border: '#9333ea', tag: 'Phase 4' },
  done:       { bg: '#f0fff4', border: '#38a169', tag: 'Complete' },
};

// ─── Step definitions ───────────────────────────────────────────────────────

const allSteps: {
  id: string;
  label: string;
  description: string;
  phase: Phase;
  type?: 'custom' | 'decision' | 'gate' | 'note';
}[] = [
  // Main flow
  { id: '1',  label: '/phase <your task>',          description: 'Invoke the orchestration skill',          phase: 'setup' },
  { id: '2',  label: 'Phase 1 — Planning',           description: 'Produce plan.md + todo.md · no code',     phase: 'phase1' },
  { id: '3',  label: 'User approval gate',           description: 'Review plan before any code is written',  phase: 'phase1', type: 'gate' },
  { id: '4',  label: 'Phase 2 — Workspace Setup',   description: 'git worktree per phase · init progress.txt', phase: 'phase2' },
  { id: '5',  label: 'User approval gate',           description: 'Verify branches + workspaces',            phase: 'phase2', type: 'gate' },
  { id: '6',  label: 'Phase 3a — Dep Analysis',     description: 'Map produces/consumes · find parallel groups · critical path', phase: 'analysis' },
  { id: '7',  label: 'Phase 3b — PRD Generation',   description: 'execution.md · prd.json · CLAUDE.md · ralph-loop.sh', phase: 'generation' },
  { id: '8',  label: 'Phase 3c — Launch',           description: 'Spawn ralph-loop.sh for each group in parallel', phase: 'execution' },

  // Ralph loop
  { id: '9',  label: 'Read prd.json + progress.txt', description: 'Check Codebase Patterns section first',  phase: 'ralph' },
  { id: '10', label: 'Pick next story',              description: 'Highest priority where passes: false',    phase: 'ralph' },
  { id: '11', label: 'No stories left?',             description: '',                                         phase: 'ralph', type: 'decision' },
  { id: '12', label: 'Implement the story',          description: 'One story · focused scope · follow patterns', phase: 'ralph' },
  { id: '13', label: 'Run quality checks',           description: 'typecheck · lint · tests',                 phase: 'ralph' },
  { id: '14', label: 'Checks pass?',                 description: '',                                         phase: 'ralph', type: 'decision' },
  { id: '15', label: 'Retry fix (attempt 1–3)',      description: 'Read error · targeted fix · re-run checks', phase: 'error' },
  { id: '16', label: 'Still failing after 3x?',     description: '',                                         phase: 'error', type: 'decision' },
  { id: '17', label: 'Record blocker + reset',       description: 'Set prd.json notes · git checkout -- .',  phase: 'error' },
  { id: '18', label: 'Commit changes',               description: 'feat: US-001 - Story Title',               phase: 'ralph' },
  { id: '19', label: 'Set passes: true',             description: 'Update story in prd.json',                phase: 'ralph' },
  { id: '20', label: 'Append to progress.txt',       description: 'Learnings · codebase patterns · gotchas', phase: 'ralph' },
  { id: '21', label: 'More stories?',                description: '',                                         phase: 'ralph', type: 'decision' },
  { id: '22', label: 'Push + PHASE_COMPLETE',        description: 'git push origin · signal done to loop',   phase: 'ralph' },

  // Post ralph
  { id: '23', label: 'All parallel phases done?',   description: '',                                         phase: 'execution', type: 'decision' },
  { id: '24', label: 'Propagate codebase patterns', description: 'Inject Group N learnings into Group N+1',  phase: 'execution' },
  { id: '25', label: 'Launch next group',            description: 'Dependent phases now run in parallel',    phase: 'execution' },
  { id: '26', label: 'User approval gate',           description: 'Confirm all stories pass · review blockers', phase: 'execution', type: 'gate' },

  // Phase 4
  { id: '27', label: 'Phase 4 — Merge',             description: 'Create merge_order.md · dependency order', phase: 'phase4' },
  { id: '28', label: 'Merge branch + validate',     description: 'One merge · typecheck · lint · tests',    phase: 'phase4' },
  { id: '29', label: 'All merges done?',            description: '',                                         phase: 'phase4', type: 'decision' },
  { id: '30', label: 'Done!',                        description: 'All phases merged · final validation pass', phase: 'done' },
];

// ─── Note annotations ───────────────────────────────────────────────────────

const notes = [
  {
    id: 'note-prd',
    appearsWithStep: 7,
    position: { x: 360, y: 640 },
    color: { bg: '#f0fffe', border: '#0891b2' },
    content: `// prd.json (per phase workspace)
{
  "project": "my-app",
  "branchName": "phase-a-types",
  "userStories": [
    {
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
    }
  ]
}`,
  },
  {
    id: 'note-progress',
    appearsWithStep: 20,
    position: { x: 840, y: 1400 },
    color: { bg: '#fff8f0', border: '#d97706' },
    content: `## Codebase Patterns
- Use drizzle ORM for all DB queries
- Server actions live in app/actions/
- All mutations go through useAction hook

## 2025-06-01 - US-003
- Added status field to tasks table
- Files: db/schema.ts, migrations/003.sql
- Learnings: always run tsc after schema change`,
  },
];

// ─── Node positions ─────────────────────────────────────────────────────────

// Main spine: x=60 · Ralph loop: x=440 · Error branch: x=720
const W = 240; // node width

const positions: Record<string, { x: number; y: number }> = {
  '1':  { x: 60,  y: 20 },
  '2':  { x: 60,  y: 140 },
  '3':  { x: 70,  y: 260 },     // gate (smaller)
  '4':  { x: 60,  y: 360 },
  '5':  { x: 70,  y: 480 },     // gate
  '6':  { x: 60,  y: 580 },
  '7':  { x: 60,  y: 700 },
  '8':  { x: 60,  y: 820 },     // launch — connects right to ralph

  // Ralph loop (x=440)
  '9':  { x: 440, y: 820 },
  '10': { x: 440, y: 940 },
  '11': { x: 440, y: 1060 },    // decision: no stories?
  '12': { x: 440, y: 1180 },    // implement
  '13': { x: 440, y: 1300 },    // quality checks
  '14': { x: 440, y: 1420 },    // decision: pass?
  '15': { x: 720, y: 1300 },    // retry
  '16': { x: 720, y: 1420 },    // still failing?
  '17': { x: 720, y: 1540 },    // record blocker
  '18': { x: 440, y: 1540 },    // commit
  '19': { x: 440, y: 1640 },    // passes: true
  '20': { x: 440, y: 1740 },    // progress.txt
  '21': { x: 440, y: 1860 },    // more stories?
  '22': { x: 440, y: 1980 },    // push + complete

  // Back to main spine (x=60)
  '23': { x: 60,  y: 1060 },    // all phases done?
  '24': { x: 60,  y: 1180 },    // propagate patterns
  '25': { x: 60,  y: 1300 },    // launch next group
  '26': { x: 70,  y: 1420 },    // approval gate

  // Phase 4
  '27': { x: 60,  y: 1540 },
  '28': { x: 60,  y: 1660 },
  '29': { x: 60,  y: 1780 },    // all merges done?
  '30': { x: 60,  y: 1900 },    // done!

  // Notes
  'note-prd':      { x: 360, y: 640 },
  'note-progress': { x: 840, y: 1400 },
};

// ─── Edge connections ───────────────────────────────────────────────────────

const edgeConnections: {
  source: string; target: string;
  sourceHandle?: string; targetHandle?: string;
  label?: string; animated?: boolean;
}[] = [
  // Main spine
  { source: '1',  target: '2',  sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '2',  target: '3',  sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '3',  target: '4',  sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '4',  target: '5',  sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '5',  target: '6',  sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '6',  target: '7',  sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '7',  target: '8',  sourceHandle: 'bottom', targetHandle: 'top' },

  // Step 8 → Ralph loop start (horizontal right)
  { source: '8',  target: '9',  sourceHandle: 'right', targetHandle: 'left', label: 'per phase' },

  // Ralph loop inner flow
  { source: '9',  target: '10', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '10', target: '11', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '11', target: '22', sourceHandle: 'right',  targetHandle: 'top', label: 'Yes → PHASE_COMPLETE' },
  { source: '11', target: '12', sourceHandle: 'bottom', targetHandle: 'top', label: 'No → implement' },
  { source: '12', target: '13', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '13', target: '14', sourceHandle: 'bottom', targetHandle: 'top' },

  // pass branch
  { source: '14', target: '18', sourceHandle: 'bottom', targetHandle: 'top', label: 'Pass' },

  // fail branch → retry
  { source: '14', target: '15', sourceHandle: 'right',  targetHandle: 'top', label: 'Fail' },
  { source: '15', target: '16', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '16', target: '13', sourceHandle: 'left',   targetHandle: 'right', label: 'No → retry' },
  { source: '16', target: '17', sourceHandle: 'bottom', targetHandle: 'top', label: 'Yes' },
  { source: '17', target: '10', sourceHandle: 'left',   targetHandle: 'right', label: 'skip → next story' },

  // Commit flow
  { source: '18', target: '19', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '19', target: '20', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '20', target: '21', sourceHandle: 'bottom', targetHandle: 'top' },

  // More stories loop
  { source: '21', target: '9',  sourceHandle: 'right',  targetHandle: 'right', label: 'Yes → loop' },
  { source: '21', target: '22', sourceHandle: 'bottom', targetHandle: 'top', label: 'No' },

  // PHASE_COMPLETE → main spine (back left)
  { source: '22', target: '23', sourceHandle: 'left',   targetHandle: 'right', label: 'phase done' },

  // All phases done? branch
  { source: '23', target: '24', sourceHandle: 'bottom', targetHandle: 'top', label: 'More groups' },
  { source: '24', target: '25', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '25', target: '8',  sourceHandle: 'top',    targetHandle: 'left', label: 'launch next group' },
  { source: '23', target: '26', sourceHandle: 'left',   targetHandle: 'right', label: 'All done' },

  // Phase 4
  { source: '26', target: '27', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '27', target: '28', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '28', target: '29', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '29', target: '28', sourceHandle: 'right',  targetHandle: 'right', label: 'Conflicts → fix' },
  { source: '29', target: '30', sourceHandle: 'bottom', targetHandle: 'top', label: 'All merged' },
];

// ─── Build initial nodes + edges ────────────────────────────────────────────

function makeNodes(visibleCount: number): Node[] {
  const stepNodes: Node[] = allSteps.map((step, index) => {
    const stepNum = parseInt(step.id);
    const visible = stepNum <= visibleCount;
    const pos = positions[step.id] ?? { x: 0, y: 0 };
    const type = step.type === 'decision' ? 'decision'
      : step.type === 'gate' ? 'gate'
      : 'custom';

    return {
      id: step.id,
      type,
      position: pos,
      data: { label: step.label, description: step.description, phase: step.phase },
      style: {
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.5s ease',
        pointerEvents: visible ? 'all' : 'none',
      },
    };
  });

  const noteNodes: Node[] = notes.map(note => ({
    id: note.id,
    type: 'note',
    position: note.position,
    data: { content: note.content, color: note.color },
    style: {
      opacity: visibleCount >= note.appearsWithStep ? 1 : 0,
      transition: 'opacity 0.6s ease',
      pointerEvents: visibleCount >= note.appearsWithStep ? 'all' : 'none',
    },
  }));

  return [...stepNodes, ...noteNodes];
}

function makeEdges(visibleCount: number): Edge[] {
  return edgeConnections.map((conn, i) => {
    const src = parseInt(conn.source);
    const tgt = parseInt(conn.target);
    const visible = src <= visibleCount && tgt <= visibleCount;
    return {
      id: `e${i}`,
      source: conn.source,
      target: conn.target,
      sourceHandle: conn.sourceHandle,
      targetHandle: conn.targetHandle,
      label: conn.label,
      animated: visible && (conn.animated !== false),
      style: {
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.5s ease',
        stroke: '#888',
        strokeWidth: 1.5,
      },
      labelStyle: { fontSize: 10, fill: '#555', fontWeight: 600 },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.85 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: '#888',
      },
    };
  });
}

// ─── Custom node components ──────────────────────────────────────────────────

function CustomNode({ data }: { data: { label: string; description: string; phase: Phase } }) {
  const colors = phaseColors[data.phase];
  return (
    <div className="custom-node" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
      <Handle type="target" position={Position.Top}    id="top" />
      <Handle type="target" position={Position.Left}   id="left" />
      <Handle type="target" position={Position.Right}  id="right" />
      <Handle type="target" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Top}    id="top" />
      <Handle type="source" position={Position.Left}   id="left" />
      <Handle type="source" position={Position.Right}  id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <div className="node-content">
        <div className="node-phase-tag" style={{ color: colors.border }}>{colors.tag}</div>
        <div className="node-label">{data.label}</div>
        {data.description && <div className="node-description">{data.description}</div>}
      </div>
    </div>
  );
}

function DecisionNode({ data }: { data: { label: string; description: string; phase: Phase } }) {
  const colors = phaseColors[data.phase];
  return (
    <div className="decision-node" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
      <Handle type="target" position={Position.Top}    id="top" />
      <Handle type="target" position={Position.Left}   id="left" />
      <Handle type="target" position={Position.Right}  id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left}   id="left" />
      <Handle type="source" position={Position.Right}  id="right" />
      <div className="node-content">
        <div style={{ fontSize: 16, marginBottom: 4 }}>◆</div>
        <div className="node-label" style={{ color: colors.border }}>{data.label}</div>
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
  custom:   CustomNode,
  decision: DecisionNode,
  gate:     GateNode,
  note:     NoteNode,
};

// ─── App ─────────────────────────────────────────────────────────────────────

const TOTAL_STEPS = allSteps.length;

export default function App() {
  const [visibleCount, setVisibleCount] = useState(1);
  const [nodes, setNodes, onNodesChange] = useNodesState(makeNodes(1));
  const [edges, setEdges, onEdgesChange] = useEdgesState(makeEdges(1));
  const reconnectEdgeRef = useRef<ReturnType<typeof reconnectEdge> | null>(null);

  const updateVisible = useCallback((count: number) => {
    setVisibleCount(count);
    setNodes(makeNodes(count));
    setEdges(makeEdges(count));
  }, [setNodes, setEdges]);

  const handleNext = () => updateVisible(Math.min(visibleCount + 1, TOTAL_STEPS));
  const handlePrev = () => updateVisible(Math.max(visibleCount - 1, 1));
  const handleReset = () => updateVisible(1);
  const handleShowAll = () => updateVisible(TOTAL_STEPS);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes(ns => applyNodeChanges(changes, ns)),
    [setNodes],
  );
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges(es => applyEdgeChanges(changes, es)),
    [setEdges],
  );
  const handleConnect = useCallback(
    (connection: Connection) => setEdges(es => addEdge(connection, es)),
    [setEdges],
  );

  const currentStep = allSteps[visibleCount - 1];

  const legendItems: { phase: Phase; label: string }[] = [
    { phase: 'phase1',     label: 'Phases 1–2' },
    { phase: 'analysis',   label: 'Phase 3a' },
    { phase: 'generation', label: 'Phase 3b' },
    { phase: 'execution',  label: 'Phase 3c' },
    { phase: 'ralph',      label: 'Ralph Loop' },
    { phase: 'error',      label: 'Error Recovery' },
    { phase: 'phase4',     label: 'Phase 4' },
  ];

  return (
    <div className="app-container">
      <div className="header">
        <h1>How Orchestration Works</h1>
        <p>Step-by-step walkthrough of the phased engineering workflow — from task to merged code</p>
      </div>

      <div className="flow-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.2}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'smoothstep',
            style: { stroke: '#888', strokeWidth: 1.5 },
          }}
          proOptions={{ hideAttribution: false }}
        >
          <Controls />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e5e5" />
        </ReactFlow>
      </div>

      <div className="controls">
        <button className="reset-btn" onClick={handleReset} disabled={visibleCount === 1}>
          Reset
        </button>
        <button onClick={handlePrev} disabled={visibleCount <= 1}>
          ← Prev
        </button>
        <div className="step-counter">
          {visibleCount} / {TOTAL_STEPS}
          {currentStep && (
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
              {phaseColors[currentStep.phase].tag}
            </div>
          )}
        </div>
        <button onClick={handleNext} disabled={visibleCount >= TOTAL_STEPS}>
          Next →
        </button>
        <button onClick={handleShowAll} disabled={visibleCount === TOTAL_STEPS}>
          Show All
        </button>
      </div>

      <div style={{ padding: '10px 20px 14px', borderTop: '1px solid #eee' }}>
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
    </div>
  );
}
