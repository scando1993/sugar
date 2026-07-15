import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { getFlag, getPositional } from '../src/lib/argv';

describe('getFlag', () => {
  it('returns the value following a flag', () => {
    assert.equal(getFlag(['--story', 'US-001'], '--story'), 'US-001');
  });

  it('returns undefined when the flag is absent', () => {
    assert.equal(getFlag(['--other', 'x'], '--story'), undefined);
  });

  it('returns undefined when the flag is the last token (no value)', () => {
    assert.equal(getFlag(['--workspace', '/tmp/ws', '--story'], '--story'), undefined);
  });

  it('returns undefined when the next token is itself another flag', () => {
    assert.equal(getFlag(['--story', '--status', 'passed'], '--story'), undefined);
  });
});

describe('getPositional', () => {
  it('finds the positional argument before any flags', () => {
    assert.equal(getPositional(['/tmp/ws', '--max-iterations', '20'], ['--max-iterations', '--model']), '/tmp/ws');
  });

  it('skips a flag and its value even when the value does not start with --', () => {
    assert.equal(
      getPositional(['--max-iterations', '20', '/tmp/ws'], ['--max-iterations', '--model']),
      '/tmp/ws',
    );
  });

  it('returns undefined when only flags are present', () => {
    assert.equal(getPositional(['--max-iterations', '20'], ['--max-iterations', '--model']), undefined);
  });
});
