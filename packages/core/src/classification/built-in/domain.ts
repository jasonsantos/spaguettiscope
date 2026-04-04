import type { DimensionDefinition, DimensionPattern } from '../model.js';

/**
 * Extracts the domain value from a file path by looking for known structural patterns.
 * Returns undefined when no domain can be inferred.
 */
export function inferDomainFromPath(relativePath: string): string | undefined {
  // Next.js App Router: app/(group)/domain/... or app/domain/...
  const appRouterMatch = relativePath.match(
    /(?:^|[/\\])app[/\\](?:\([^)]+\)[/\\])?([^[/\\().]+)[/\\]/
  );
  if (appRouterMatch) return appRouterMatch[1];

  // Next.js Pages Router: pages/domain/...
  const pagesMatch = relativePath.match(/(?:^|[/\\])pages[/\\]([^[/\\().]+)[/\\]/);
  if (pagesMatch && pagesMatch[1] !== 'api') return pagesMatch[1];

  // Explicit feature/module directories
  const featuresMatch = relativePath.match(
    /(?:^|[/\\])(?:features|modules|domains)[/\\]([^[/\\().]+)[/\\]/
  );
  if (featuresMatch) return featuresMatch[1];

  return undefined;
}

export const domainDimension: DimensionDefinition = {
  name: 'domain',
  // patterns is empty — domain inference uses inferDomainFromPath() in InferenceEngine
  patterns: [] as DimensionPattern[],
  // no fallback — files outside a recognizable domain have no domain tag
};
