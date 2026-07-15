import { describe, it } from 'node:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync, execFileSync } from 'child_process';
import { generateRalphLoop } from '../src/lib/templates/ralph-loop-sh';

function hasShellcheck(): boolean {
  try {
    execSync('command -v shellcheck', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

describe('generated ralph-loop.sh', () => {
  it('passes shellcheck with no warnings', { skip: hasShellcheck() ? false : 'shellcheck is not installed' }, () => {
    const script = generateRalphLoop({
      phaseName: 'Smoke Test',
      maxIterations: 20,
      defaultModel: 'sonnet',
      sugarBin: 'node /path/to/dist/index.js',
    });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sugar-shellcheck-'));
    const scriptPath = path.join(tmpDir, 'ralph-loop.sh');
    fs.writeFileSync(scriptPath, script);
    fs.chmodSync(scriptPath, 0o755);

    try {
      execFileSync('shellcheck', [scriptPath], { encoding: 'utf-8' });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
