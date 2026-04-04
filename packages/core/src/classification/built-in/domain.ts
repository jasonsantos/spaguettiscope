import type { DimensionDefinition } from '../model.js'

// Domain inference is handled by InferenceEngine.inferDomain() via Next.js App Router detection.
// This stub registers 'domain' as a known dimension so the engine processes it.
export const domainDimension: DimensionDefinition = {
  name: 'domain',
  patterns: [],
}
