import {
  PhaseNode,
  DependencyEdge,
  ParallelGroup,
  CriticalPath,
  DependencyGraph,
  DependencyType,
} from '../types';

export class DependencyAnalyzer {
  private nodes: Map<string, PhaseNode> = new Map();
  private edges: DependencyEdge[] = [];

  addPhase(node: PhaseNode): void {
    this.nodes.set(node.id, node);
  }

  addEdge(from: string, to: string, type: DependencyType = 'hard', artifact?: string): void {
    this.edges.push({ from, to, type, artifact });
  }

  buildGraph(): DependencyGraph {
    this.detectCircular();
    const parallelGroups = this.findParallelGroups();
    const criticalPath = this.findCriticalPath();
    return {
      nodes: Array.from(this.nodes.values()),
      edges: [...this.edges],
      parallelGroups,
      criticalPath,
    };
  }

  findParallelGroups(): ParallelGroup[] {
    const groups: ParallelGroup[] = [];
    const assigned = new Set<string>();
    let groupNumber = 1;

    while (assigned.size < this.nodes.size) {
      // Find all phases whose hard dependencies are fully assigned
      const ready: string[] = [];
      for (const [id] of this.nodes) {
        if (assigned.has(id)) continue;
        const hardDeps = this.edges
          .filter(e => e.to === id && e.type === 'hard')
          .map(e => e.from);
        if (hardDeps.every(d => assigned.has(d))) {
          ready.push(id);
        }
      }

      if (ready.length === 0) {
        // Remaining nodes have unresolvable deps — shouldn't happen after circular check
        break;
      }

      const dependsOnGroups = new Set<number>();
      for (const id of ready) {
        const deps = this.edges.filter(e => e.to === id).map(e => e.from);
        for (const dep of deps) {
          const g = groups.find(g => g.phases.includes(dep));
          if (g) dependsOnGroups.add(g.groupNumber);
        }
      }

      groups.push({
        groupNumber,
        phases: ready,
        dependsOnGroups: Array.from(dependsOnGroups).sort(),
      });

      for (const id of ready) assigned.add(id);
      groupNumber++;
    }

    return groups;
  }

  findCriticalPath(): CriticalPath {
    // Longest path in DAG using topological sort + dynamic programming
    const dist = new Map<string, number>();
    const prev = new Map<string, string | null>();

    for (const [id] of this.nodes) {
      dist.set(id, 0);
      prev.set(id, null);
    }

    const topo = this.topologicalSort();
    for (const id of topo) {
      const outEdges = this.edges.filter(e => e.from === id && e.type === 'hard');
      for (const edge of outEdges) {
        const newDist = (dist.get(id) || 0) + 1;
        if (newDist > (dist.get(edge.to) || 0)) {
          dist.set(edge.to, newDist);
          prev.set(edge.to, id);
        }
      }
    }

    // Find node with max distance
    let maxNode = topo[0] || '';
    let maxDist = 0;
    for (const [id, d] of dist) {
      if (d > maxDist) {
        maxDist = d;
        maxNode = id;
      }
    }

    // Trace back
    const pathReversed: string[] = [maxNode];
    let current: string | null | undefined = prev.get(maxNode);
    while (current) {
      pathReversed.push(current);
      current = prev.get(current);
    }

    const phases = pathReversed.reverse();
    return { phases, length: phases.length };
  }

  detectCircular(): void {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (id: string): void => {
      visited.add(id);
      recStack.add(id);

      const neighbors = this.edges
        .filter(e => e.from === id && e.type === 'hard')
        .map(e => e.to);

      for (const neighbor of neighbors) {
        if (recStack.has(neighbor)) {
          throw new Error(`Circular dependency detected: ${id} → ${neighbor}`);
        }
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        }
      }

      recStack.delete(id);
    };

    for (const [id] of this.nodes) {
      if (!visited.has(id)) dfs(id);
    }
  }

  toAscii(): string {
    const groups = this.findParallelGroups();
    const lines: string[] = ['Dependency Graph', '================', ''];

    for (const group of groups) {
      const phaseNames = group.phases
        .map(id => this.nodes.get(id)?.name || id)
        .join(', ');
      const deps = group.dependsOnGroups.length > 0
        ? ` (after Group ${group.dependsOnGroups.join(', ')})`
        : ' (no dependencies)';
      lines.push(`Group ${group.groupNumber}: [${phaseNames}]${deps}`);
    }

    lines.push('');
    lines.push('Critical Path:');
    const cp = this.findCriticalPath();
    const cpNames = cp.phases.map(id => this.nodes.get(id)?.name || id);
    lines.push(`  ${cpNames.join(' → ')}`);

    return lines.join('\n');
  }

  private topologicalSort(): string[] {
    const inDegree = new Map<string, number>();
    for (const [id] of this.nodes) inDegree.set(id, 0);

    for (const edge of this.edges) {
      if (edge.type !== 'hard') continue;
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      for (const edge of this.edges) {
        if (edge.from !== current || edge.type !== 'hard') continue;
        const newDeg = (inDegree.get(edge.to) || 1) - 1;
        inDegree.set(edge.to, newDeg);
        if (newDeg === 0) queue.push(edge.to);
      }
    }

    return result;
  }
}
