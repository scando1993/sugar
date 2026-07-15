import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { buildDashboardHtml } from '../src/lib/dashboard';
import { PrdJson } from '../src/types';

function makePrd(overrides: Partial<PrdJson> = {}): PrdJson {
  return {
    project: 'myapp',
    branchName: 'phase-a',
    description: 'Phase A',
    consensus: {
      quorumSize: 3, requiredMajority: 2, implementModel: 'sonnet',
      verifyModel: 'sonnet', escalationModel: 'opus', maxTerms: 3,
    },
    userStories: [
      { id: 'US-001', title: 'Story one', description: '', acceptanceCriteria: [], priority: 1, status: 'passed', term: 0, votes: [], notes: '' },
      { id: 'US-002', title: 'Story two', description: '', acceptanceCriteria: [], priority: 2, status: 'pending', term: 0, votes: [], notes: '' },
    ],
    ...overrides,
  };
}

describe('buildDashboardHtml', () => {
  it('renders phase name, progress, and story rows', () => {
    const html = buildDashboardHtml([{ name: 'phase-a', prd: makePrd() }], '/tmp/myapp-phases', '2026-01-01T00:00:00.000Z');
    assert.ok(html.includes('myapp'));
    assert.ok(html.includes('phase-a'));
    assert.ok(html.includes('US-001'));
    assert.ok(html.includes('1/2 stories (50%)'));
  });

  it('escapes HTML-significant characters in user-controlled fields', () => {
    const prd = makePrd({ description: '<script>alert(1)</script>' });
    prd.userStories[0].notes = '"><img src=x onerror=alert(1)>';
    const html = buildDashboardHtml([{ name: 'phase-a', prd }], '/tmp', '2026-01-01T00:00:00.000Z');
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
  });
});
