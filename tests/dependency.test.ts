import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { DependencyAnalyzer } from '../src/lib/dependency';

describe('DependencyAnalyzer', () => {
  function makeAnalyzer() {
    const a = new DependencyAnalyzer();
    a.addPhase({ id: 'a', name: 'Phase A', produces: ['types'], consumes: [], dependencies: [] });
    a.addPhase({ id: 'b', name: 'Phase B', produces: ['modules'], consumes: ['types'], dependencies: ['a'] });
    a.addPhase({ id: 'c', name: 'Phase C', produces: ['templates'], consumes: ['types', 'modules'], dependencies: ['a', 'b'] });
    a.addPhase({ id: 'd', name: 'Phase D', produces: ['cli'], consumes: ['modules', 'templates'], dependencies: ['b', 'c'] });
    a.addEdge('a', 'b', 'hard');
    a.addEdge('a', 'c', 'hard');
    a.addEdge('b', 'c', 'hard');
    a.addEdge('b', 'd', 'hard');
    a.addEdge('c', 'd', 'hard');
    return a;
  }

  describe('findParallelGroups', () => {
    it('groups phases by dependency level', () => {
      const a = makeAnalyzer();
      const groups = a.findParallelGroups();
      assert.equal(groups.length, 4);
      assert.deepEqual(groups[0].phases, ['a']);
      assert.deepEqual(groups[1].phases, ['b']);
      assert.deepEqual(groups[2].phases, ['c']);
      assert.deepEqual(groups[3].phases, ['d']);
    });

    it('puts independent phases in same group', () => {
      const a = new DependencyAnalyzer();
      a.addPhase({ id: 'x', name: 'X', produces: [], consumes: [], dependencies: [] });
      a.addPhase({ id: 'y', name: 'Y', produces: [], consumes: [], dependencies: [] });
      a.addPhase({ id: 'z', name: 'Z', produces: [], consumes: [], dependencies: ['x', 'y'] });
      a.addEdge('x', 'z', 'hard');
      a.addEdge('y', 'z', 'hard');
      const groups = a.findParallelGroups();
      assert.equal(groups.length, 2);
      assert.deepEqual(groups[0].phases.sort(), ['x', 'y']);
      assert.deepEqual(groups[1].phases, ['z']);
    });
  });

  describe('findCriticalPath', () => {
    it('finds longest path', () => {
      const a = makeAnalyzer();
      const cp = a.findCriticalPath();
      assert.deepEqual(cp.phases, ['a', 'b', 'c', 'd']);
      assert.equal(cp.length, 4);
    });
  });

  describe('detectCircular', () => {
    it('throws on circular dependency', () => {
      const a = new DependencyAnalyzer();
      a.addPhase({ id: 'a', name: 'A', produces: [], consumes: [], dependencies: ['b'] });
      a.addPhase({ id: 'b', name: 'B', produces: [], consumes: [], dependencies: ['a'] });
      a.addEdge('a', 'b', 'hard');
      a.addEdge('b', 'a', 'hard');
      assert.throws(() => a.detectCircular(), /Circular dependency/);
    });

    it('does not throw on valid DAG', () => {
      const a = makeAnalyzer();
      assert.doesNotThrow(() => a.detectCircular());
    });
  });

  describe('buildGraph', () => {
    it('returns complete graph', () => {
      const a = makeAnalyzer();
      const graph = a.buildGraph();
      assert.equal(graph.nodes.length, 4);
      assert.equal(graph.edges.length, 5);
      assert.ok(graph.parallelGroups.length > 0);
      assert.ok(graph.criticalPath.length > 0);
    });
  });

  describe('toAscii', () => {
    it('produces readable output', () => {
      const a = makeAnalyzer();
      const ascii = a.toAscii();
      assert.ok(ascii.includes('Group 1'));
      assert.ok(ascii.includes('Critical Path'));
      assert.ok(ascii.includes('Phase A'));
    });
  });
});
