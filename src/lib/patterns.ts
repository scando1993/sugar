import * as fs from 'fs';
import * as path from 'path';
import { Pattern, PatternsJson } from '../types';

export class PatternManager {
  private patternsPath: string;

  constructor(repoRoot: string) {
    this.patternsPath = path.join(repoRoot, 'patterns.json');
  }

  extractPatterns(progressTxt: string): Pattern[] {
    const patterns: Pattern[] = [];
    const lines = progressTxt.split('\n');

    let inPatternSection = false;
    let currentPattern: Partial<Pattern> | null = null;

    for (const line of lines) {
      if (line.match(/^##\s*Codebase Patterns/i)) {
        inPatternSection = true;
        continue;
      }

      if (inPatternSection && line.match(/^##\s/) && !line.match(/Codebase Patterns/i)) {
        inPatternSection = false;
        continue;
      }

      if (!inPatternSection) continue;

      // Parse pattern entries: "- **Pattern Name**: description"
      const patternMatch = line.match(/^[-*]\s+\*?\*?(.+?)\*?\*?:\s*(.+)/);
      if (patternMatch) {
        if (currentPattern?.description) {
          patterns.push(this.finalizePattern(currentPattern, patterns.length));
        }
        currentPattern = {
          description: `${patternMatch[1].trim()}: ${patternMatch[2].trim()}`,
        };
      }
    }

    if (currentPattern?.description) {
      patterns.push(this.finalizePattern(currentPattern, patterns.length));
    }

    return patterns;
  }

  mergePatterns(existing: Pattern[], discovered: Pattern[]): Pattern[] {
    const merged = [...existing];
    const descriptions = new Set(existing.map(p => p.description.toLowerCase()));

    for (const pattern of discovered) {
      if (!descriptions.has(pattern.description.toLowerCase())) {
        merged.push(pattern);
        descriptions.add(pattern.description.toLowerCase());
      }
    }

    return merged;
  }

  injectPatterns(claudeMd: string, patterns: Pattern[]): string {
    if (patterns.length === 0) return claudeMd;

    const patternBlock = patterns
      .map(p => `- **${p.id}** (from ${p.learned_in}): ${p.description}`)
      .join('\n');

    const marker = '## Known Patterns';
    const markerIndex = claudeMd.indexOf(marker);

    if (markerIndex !== -1) {
      // Replace everything after marker until next ## or end
      const afterMarker = claudeMd.indexOf('\n##', markerIndex + marker.length);
      const insertEnd = afterMarker !== -1 ? afterMarker : claudeMd.length;
      return (
        claudeMd.slice(0, markerIndex + marker.length) +
        '\n\n' +
        patternBlock +
        '\n' +
        claudeMd.slice(insertEnd)
      );
    }

    // No marker found — append
    return claudeMd + '\n\n' + marker + '\n\n' + patternBlock + '\n';
  }

  readPatterns(): PatternsJson {
    if (!fs.existsSync(this.patternsPath)) {
      return { patterns: [] };
    }
    return JSON.parse(fs.readFileSync(this.patternsPath, 'utf-8'));
  }

  writePatterns(patternsJson: PatternsJson): void {
    fs.writeFileSync(this.patternsPath, JSON.stringify(patternsJson, null, 2));
  }

  propagateFromPhase(
    progressTxtPath: string,
    learnedInPhase: string,
    appliesTo: string[]
  ): Pattern[] {
    const progressTxt = fs.readFileSync(progressTxtPath, 'utf-8');
    const discovered = this.extractPatterns(progressTxt);

    // Tag with source
    for (const p of discovered) {
      p.learned_in = learnedInPhase;
      p.applies_to = appliesTo;
    }

    const existing = this.readPatterns();
    const merged = this.mergePatterns(existing.patterns, discovered);
    this.writePatterns({ patterns: merged });
    return discovered;
  }

  private finalizePattern(partial: Partial<Pattern>, index: number): Pattern {
    return {
      id: partial.id || `P${index + 1}`,
      learned_in: partial.learned_in || 'unknown',
      description: partial.description || '',
      applies_to: partial.applies_to || [],
      confidence: partial.confidence || 'medium',
    };
  }
}
