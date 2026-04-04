import type { AggregationResult } from '../aggregator/index.js';

export interface TerminalSummaryOptions {
  projectName?: string;
  connectors: string[];
}

export function formatTerminalSummary(
  result: AggregationResult,
  options: TerminalSummaryOptions
): string {
  const { overall } = result;
  const passRatePct = (overall.passRate * 100).toFixed(1);
  const lines: string[] = [];

  lines.push('');
  lines.push(`  ${options.connectors.map(c => `✔  Reading ${c}`).join('\n  ')}`);
  lines.push('');
  lines.push(`  Overview: ${passRatePct}% pass · ${overall.total} tests`);
  if (overall.failed > 0) lines.push(`  ✘ ${overall.failed} failing`);
  if (overall.skipped > 0) lines.push(`  ○ ${overall.skipped} skipped`);
  lines.push('');

  return lines.join('\n');
}
