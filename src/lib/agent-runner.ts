import { execFileSync } from 'child_process';
import { PermissionMode } from '../types';

/** Spawns an agent with the given prompt on stdin and returns its full stdout. */
export type AgentRunner = (prompt: string, model: string) => string;

export interface AgentRunnerOptions {
  runnerBin: string;
  permissionMode: PermissionMode;
  cwd?: string;
}

/**
 * Real AgentRunner that shells out to the configured runner binary (typically
 * `claude`). Kept behind the AgentRunner type so implementer/verifier/loop
 * code can be unit tested with a stub instead of spawning a real agent.
 */
export function createAgentRunner(opts: AgentRunnerOptions): AgentRunner {
  const { runnerBin, permissionMode, cwd } = opts;
  return (prompt: string, model: string): string => {
    const args = ['--model', model, '--print'];
    if (permissionMode === 'skip') {
      args.push('--dangerously-skip-permissions');
    } else if (permissionMode === 'acceptEdits') {
      args.push('--permission-mode', 'acceptEdits');
    }
    return execFileSync(runnerBin, args, {
      input: prompt,
      encoding: 'utf-8',
      cwd,
      maxBuffer: 20 * 1024 * 1024,
    });
  };
}