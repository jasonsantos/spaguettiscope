import type { DimensionDefinition } from '../model.js'

// Package inference is handled by InferenceEngine.inferPackage() via package.json walking.
// This stub definition registers 'package' as a known dimension so the engine processes it.
export const packageDimension: DimensionDefinition = {
  name: 'package',
  patterns: [],
}
