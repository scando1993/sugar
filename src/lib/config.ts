import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { SugarConfig, DEFAULT_CONFIG } from '../types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Recursively merges `override` onto `base`. Unlike a shallow spread, a partial
 * nested object (e.g. `{ models: { default: 'haiku' } }`) does not wipe out the
 * sibling keys of that nested object.
 */
export function deepMerge<T>(base: T, override: Partial<T> | undefined): T {
  if (!isPlainObject(override)) return base;
  const result: Record<string, unknown> = isPlainObject(base) ? { ...(base as Record<string, unknown>) } : {};
  for (const key of Object.keys(override)) {
    const overrideVal = (override as Record<string, unknown>)[key];
    const baseVal = result[key];
    if (isPlainObject(overrideVal) && isPlainObject(baseVal)) {
      result[key] = deepMerge(baseVal, overrideVal);
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal;
    }
  }
  return result as T;
}

/**
 * Resolves the root of the main repository, even when invoked from inside a
 * git worktree (a phase workspace). `git rev-parse --show-toplevel` returns the
 * *worktree's own* root, which is the wrong answer for shared config like
 * `sugar.config.json` — that only exists in the main repo. `--git-common-dir`
 * always points at the shared `.git` directory regardless of which worktree
 * you're standing in, so its parent is the correct repo root.
 */
export function findRepoRoot(startDir: string = process.cwd()): string {
  try {
    const commonDir = execSync('git rev-parse --git-common-dir', {
      cwd: startDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();
    if (commonDir) {
      const absCommonDir = path.isAbsolute(commonDir) ? commonDir : path.join(startDir, commonDir);
      return path.dirname(absCommonDir);
    }
  } catch {
    // Not inside a git repo (or git unavailable) — fall through to package.json walk-up.
  }

  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

/**
 * Loads sugar.config.json from the given repo root (defaulting to the
 * resolved repo root, not `process.cwd()`), deep-merged onto DEFAULT_CONFIG.
 */
export function loadConfig(repoRoot: string = findRepoRoot()): SugarConfig {
  const configPath = path.join(repoRoot, 'sugar.config.json');
  if (fs.existsSync(configPath)) {
    const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return deepMerge(DEFAULT_CONFIG, userConfig);
  }
  return deepMerge(DEFAULT_CONFIG, undefined);
}

/**
 * Resolves the command generated scripts should use to invoke this CLI.
 * Prefers an explicit config override, then this package's own compiled
 * entrypoint (so generated scripts work regardless of PATH state or whether
 * `npm link` has been run), falling back to `npx sugar` as a last resort.
 *
 * Deliberately does NOT trust `command -v sugar` — an unrelated globally
 * installed package named `sugar` would silently hijack every workspace.
 */
export function resolveSugarBin(configuredBin?: string): string {
  if (configuredBin) return configuredBin;
  const entry = path.join(__dirname, '..', 'index.js');
  if (fs.existsSync(entry)) {
    return `node "${entry}"`;
  }
  return 'npx sugar';
}

/** Resolves the base directory phase worktrees are created under. */
export function resolveWorkspaceBasePath(config: SugarConfig, repoRoot: string): string {
  if (config.workspaceBasePath) return config.workspaceBasePath;
  return path.join('/tmp', `${path.basename(repoRoot)}-phases`);
}