import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { buildBrainstormHtml } from '../src/lib/brainstorm-html';

describe('buildBrainstormHtml', () => {
  it('renders the feature description and timestamp', () => {
    const html = buildBrainstormHtml('Add real-time collaboration', '2026-01-01T00:00:00.000Z');
    assert.ok(html.includes('Add real-time collaboration'));
    assert.ok(html.includes('2026-01-01T00:00:00.000Z'));
    assert.ok(html.startsWith('<!DOCTYPE html>'));
  });

  it('escapes HTML-significant characters in the feature description', () => {
    const html = buildBrainstormHtml('<script>alert(1)</script>', '2026-01-01T00:00:00.000Z');
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&lt;script&gt;'));
  });
});
