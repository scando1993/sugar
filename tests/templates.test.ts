import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { generateClaudeMd } from '../src/lib/templates/claude-md';
import { generateVerifyMd } from '../src/lib/templates/verify-md';
import { generateRalphLoop } from '../src/lib/templates/ralph-loop-sh';

describe('Template Generators', () => {
  describe('generateClaudeMd', () => {
    it('produces CLAUDE.md with iron laws', () => {
      const result = generateClaudeMd({
        phaseName: 'Core Types',
        branchName: 'phase-a-types',
        phaseScope: 'Expand type system',
        taskDescription: 'Refactor to library',
        workspacePath: '/tmp/test/phase-a',
        dependenciesSatisfied: [],
        knownPatterns: [],
        qualityChecks: ['npm run typecheck', 'npm test'],
      });
      assert.ok(result.includes('ONE STORY PER ITERATION'));
      assert.ok(result.includes('NEVER COMMIT CODE THAT FAILS'));
      assert.ok(result.includes('READ PROGRESS.TXT'));
      assert.ok(result.includes('phase-a-types'));
      assert.ok(result.includes('Refactor to library'));
    });

    it('includes known patterns when provided', () => {
      const result = generateClaudeMd({
        phaseName: 'Test',
        branchName: 'test',
        phaseScope: 'test',
        taskDescription: 'test',
        workspacePath: '/tmp/test',
        dependenciesSatisfied: ['phase-a'],
        knownPatterns: [
          { id: 'P1', learned_in: 'phase-a', description: 'Use barrel exports', applies_to: [], confidence: 'high' },
        ],
        qualityChecks: ['npm test'],
      });
      assert.ok(result.includes('**P1** (from phase-a)'));
      assert.ok(result.includes('barrel exports'));
    });

    it('includes quality check commands', () => {
      const result = generateClaudeMd({
        phaseName: 'Test',
        branchName: 'test',
        phaseScope: 'test',
        taskDescription: 'test',
        workspacePath: '/tmp/test',
        dependenciesSatisfied: [],
        knownPatterns: [],
        qualityChecks: ['npm run typecheck', 'npm run lint', 'npm test'],
      });
      assert.ok(result.includes('npm run typecheck && npm run lint && npm test'));
    });

    it('includes red flags table', () => {
      const result = generateClaudeMd({
        phaseName: 'Test',
        branchName: 'test',
        phaseScope: 'test',
        taskDescription: 'test',
        workspacePath: '/tmp/test',
        dependenciesSatisfied: [],
        knownPatterns: [],
        qualityChecks: [],
      });
      assert.ok(result.includes('Red Flags'));
      assert.ok(result.includes("I'll just implement two quick stories"));
    });
  });

  describe('generateVerifyMd', () => {
    it('produces VERIFY.md with iron law', () => {
      const result = generateVerifyMd({ phaseName: 'Core Types' });
      assert.ok(result.includes('DO NOT TRUST THE IMPLEMENTER'));
      assert.ok(result.includes('VOTE:PASS'));
      assert.ok(result.includes('VOTE:FAIL'));
      assert.ok(result.includes('Core Types'));
    });

    it('includes red flags table', () => {
      const result = generateVerifyMd({ phaseName: 'Test' });
      assert.ok(result.includes('Red Flags'));
      assert.ok(result.includes('looks reasonable'));
    });
  });

  describe('generateRalphLoop', () => {
    it('produces an executable thin wrapper around `sugar run`', () => {
      const result = generateRalphLoop({
        phaseName: 'Core Types',
        maxIterations: 15,
        defaultModel: 'sonnet',
        sugarBin: 'npx sugar',
      });
      assert.ok(result.startsWith('#!/bin/bash'));
      assert.ok(result.includes('Core Types'));
      assert.ok(result.includes('15')); // maxIterations default
      assert.ok(result.includes('npx sugar'));
      assert.ok(result.includes('run'));
      assert.ok(result.includes('exec'));
    });

    it('does not duplicate iteration/escalation logic — all state lives behind `sugar run`', () => {
      const result = generateRalphLoop({
        phaseName: 'Test',
        maxIterations: 20,
        defaultModel: 'sonnet',
        sugarBin: 'sugar',
      });
      // The bash escalation counter, consensus grepping, and per-command
      // sugar calls all moved into LoopRunner — the script only invokes `run`.
      assert.ok(!result.includes('python3'));
      assert.ok(!result.includes('pick-story'));
      assert.ok(!result.includes('story-update'));
      assert.ok(!result.includes('CONSECUTIVE_FAILURES'));
      assert.ok(result.includes('sugar run') || result.includes('run "$SCRIPT_DIR"'));
    });
  });
});
