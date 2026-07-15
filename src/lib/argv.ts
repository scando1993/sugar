/**
 * Reads the value following a `--flag` in an argv-style array. Returns
 * undefined if the flag is absent, is the last token (no value follows), or
 * is immediately followed by another flag — so a truncated invocation like
 * `sugar verify --story` (missing the id) fails with a clear usage error
 * instead of silently treating the next flag's name as the value.
 */
export function getFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  const value = args[idx + 1];
  if (value === undefined || value.startsWith('--')) return undefined;
  return value;
}

/**
 * Finds the first bare positional argument, skipping both flag tokens and
 * their values — so `sugar run --max-iterations 20 /tmp/ws` doesn't mistake
 * "20" (a flag's own value, which doesn't start with "--") for the positional.
 */
export function getPositional(args: string[], knownFlags: string[]): string | undefined {
  const consumed = new Set<number>();
  args.forEach((arg, i) => {
    if (knownFlags.includes(arg)) {
      consumed.add(i);
      consumed.add(i + 1);
    }
  });
  return args.find((arg, i) => !consumed.has(i) && !arg.startsWith('--'));
}
