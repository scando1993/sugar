#!/usr/bin/env node
/**
 * Regenerates every non-Claude platform copy of a skill from its canonical
 * .claude/skills/<name>/SKILL.md, so a fix landing in the canonical file can
 * never silently fail to propagate to the other 5+ copies (the drift that
 * left Phase 3c's foreground-`wait` bug and the sugar-CLI prerequisite
 * section out of sync across platforms).
 *
 * The canonical body is the single source of truth. Each platform's
 * frontmatter shape and tool vocabulary are fundamentally different (not
 * mechanically derivable from Claude's), so they're declared per-platform
 * below; only the description text and body content flow from canonical.
 *
 * Usage:
 *   node scripts/sync-skills.ts            regenerate all target files
 *   node scripts/sync-skills.ts --check    exit 1 and list stale files, write nothing
 */
// Deliberately CommonJS (require/module.exports), not `import`/`export`: this
// script runs directly via Node's native TypeScript support without a build
// step, and this repo's package.json has no "type": "module" — using `import`
// syntax here makes Node auto-detect the file as ESM instead, where __dirname
// isn't defined.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findRepoRoot(startDir: string): string {
  try {
    const commonDir = execSync('git rev-parse --git-common-dir', {
      cwd: startDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();
    if (commonDir) {
      const abs = path.isAbsolute(commonDir) ? commonDir : path.join(startDir, commonDir);
      return path.dirname(abs);
    }
  } catch {
    // fall through
  }
  return startDir;
}

const REPO_ROOT = findRepoRoot(__dirname);

interface CanonicalFrontmatter {
  name: string;
  description: string;
  argumentHint?: string;
}

interface ParsedSkill {
  frontmatter: CanonicalFrontmatter;
  body: string; // includes its own leading "\n" (the blank line after the frontmatter fence)
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
  return trimmed;
}

function parseCanonical(filePath: string): ParsedSkill {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`No frontmatter found in ${filePath}`);
  const [, fmBlock, body] = match;

  const nameMatch = fmBlock.match(/^name:\s*(.+)$/m);
  const descMatch = fmBlock.match(/^description:\s*(.+)$/m);
  const hintMatch = fmBlock.match(/^argument-hint:\s*(.+)$/m);
  if (!nameMatch || !descMatch) throw new Error(`Missing name/description frontmatter in ${filePath}`);

  return {
    frontmatter: {
      name: unquote(nameMatch[1]),
      description: unquote(descMatch[1]),
      argumentHint: hintMatch ? unquote(hintMatch[1]) : undefined,
    },
    body,
  };
}

/**
 * Only Codex (which keeps `$ARGUMENTS`) and the Copilot prompt file (which
 * uses VS Code's `${input}`) have a literal task-substitution mechanism.
 * Everything else gets a short adapter note instead of silently showing an
 * unresolved `$ARGUMENTS` token with no explanation.
 */
const NO_SUBSTITUTION_NOTE =
  '\n> This platform has no literal argument-substitution mechanism — wherever these instructions say `$ARGUMENTS`, treat it as the engineering task under discussion in the current conversation.\n';

function withArgumentsToken(body: string, token: string | null): string {
  if (token === null) return NO_SUBSTITUTION_NOTE + body;
  if (token === '$ARGUMENTS') return body;
  return body.split('$ARGUMENTS').join(token);
}

interface PlatformAdapter {
  key: string;
  outPath: string;
  buildFrontmatter: (fm: CanonicalFrontmatter) => string | null; // null = no frontmatter block (Gemini)
  argumentsToken: string | null;
}

const PLATFORMS: PlatformAdapter[] = [
  {
    key: 'codex',
    outPath: '.agents/skills/orchestrate/SKILL.md',
    argumentsToken: '$ARGUMENTS',
    buildFrontmatter: (fm) => `---\nname: ${fm.name}\ndescription: "${fm.description}"\n---`,
  },
  {
    key: 'opencode',
    outPath: '.opencode/agents/orchestrate.md',
    argumentsToken: null,
    buildFrontmatter: (fm) => `---\ndescription: "${fm.description}"\nmode: primary\n---`,
  },
  {
    key: 'gemini',
    outPath: '.gemini/skills/orchestrate.md',
    argumentsToken: null,
    buildFrontmatter: () => null,
  },
  {
    key: 'copilot-agent',
    outPath: '.github/agents/sugar.md',
    argumentsToken: null,
    buildFrontmatter: (fm) => [
      '---',
      'name: sugar',
      `description: "${fm.description}"`,
      'tools:',
      '  - "read"',
      '  - "edit"',
      '  - "search"',
      '  - "terminal"',
      '  - "test-runner"',
      '---',
    ].join('\n'),
  },
  {
    key: 'copilot-prompt',
    outPath: '.github/prompts/sugar.prompt.md',
    argumentsToken: '${input}',
    buildFrontmatter: (fm) => [
      '---',
      "name: 'sugar'",
      `description: '${fm.description.replace(/'/g, "''")}'`,
      "agent: 'agent'",
      'tools:',
      "  - 'read_file'",
      "  - 'write_file'",
      "  - 'edit_file'",
      "  - 'codebase_search'",
      "  - 'run_in_terminal'",
      "  - 'run_tests'",
      `argument-hint: '${fm.argumentHint || ''}'`,
      '---',
    ].join('\n'),
  },
  {
    key: 'cursor',
    outPath: '.cursor/rules/orchestrate.mdc',
    argumentsToken: null,
    buildFrontmatter: (fm) => `---\ndescription: "${fm.description}"\nalwaysApply: false\n---`,
  },
];

const CANONICAL_SKILL = path.join(REPO_ROOT, '.claude', 'skills', 'orchestrate', 'SKILL.md');

function render(platform: PlatformAdapter, parsed: ParsedSkill): string {
  const fm = platform.buildFrontmatter(parsed.frontmatter);
  const body = withArgumentsToken(parsed.body, platform.argumentsToken);
  return fm !== null ? `${fm}\n${body}` : body.replace(/^\n+/, '');
}

function main(): void {
  const check = process.argv.includes('--check');
  const parsed = parseCanonical(CANONICAL_SKILL);

  const stale: string[] = [];
  for (const platform of PLATFORMS) {
    const outPath = path.join(REPO_ROOT, platform.outPath);
    const content = render(platform, parsed);
    const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf-8') : null;

    if (existing === content) continue;

    if (check) {
      stale.push(platform.outPath);
      continue;
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, content);
    console.log(`wrote ${platform.outPath}`);
  }

  if (check) {
    if (stale.length > 0) {
      console.error('Skill copies out of sync with .claude/skills/orchestrate/SKILL.md:');
      for (const f of stale) console.error(`  - ${f}`);
      console.error('Run `node scripts/sync-skills.ts` to regenerate.');
      process.exit(1);
    }
    console.log('All platform skill copies are in sync.');
  }
}

main();