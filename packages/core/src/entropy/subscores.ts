import type { EntropyInput, EntropySubscore } from './types.js'

export function stabilitySubscore(input: EntropyInput): EntropySubscore {
  if (input.passRate === undefined) return { score: 0, available: false }
  const base = 10 * (1 - input.passRate)
  const flakyPenalty = (input.flakyRatio ?? 0) * 5
  return { score: Math.min(10, base + flakyPenalty), available: true }
}

export function boundariesSubscore(input: EntropyInput): EntropySubscore {
  if (input.fileCount === 0) return { score: 0, available: true }
  const circularRatio = input.circularDepFiles / input.fileCount
  const circularScore = Math.min(10, circularRatio * 20)
  const possibleEdges = input.fileCount * (input.fileCount - 1)
  const density = possibleEdges > 0 ? input.edgeCount / possibleEdges : 0
  const densityScore = Math.min(10, density * 100)
  const avgFanOut = input.fileCount > 0 ? input.edgeCount / input.fileCount : 0
  const fanOutRatio = avgFanOut > 0 ? input.maxFanOut / (avgFanOut * 3) : 0
  const fanOutScore = Math.min(10, fanOutRatio * 10)
  const unusedRatio = input.unusedExports / input.fileCount
  const unusedScore = Math.min(10, unusedRatio * 20)
  return {
    score: circularScore * 0.35 + densityScore * 0.20 + fanOutScore * 0.25 + unusedScore * 0.20,
    available: true,
  }
}

export function coverageSubscore(input: EntropyInput): EntropySubscore {
  if (input.lcovCoverage === undefined) return { score: 0, available: false }
  const base = 10 * (1 - input.lcovCoverage)
  const gapPenalty = input.fileCount > 0 ? (input.coverageGaps / input.fileCount) * 5 : 0
  return { score: Math.min(10, base + gapPenalty), available: true }
}

export function violationsSubscore(input: EntropyInput): EntropySubscore {
  if (input.fileCount === 0) return { score: 0, available: true }
  const rate = input.findingsByWeight / input.fileCount
  return { score: Math.min(10, rate * 2), available: true }
}

export function classificationSubscore(input: EntropyInput): EntropySubscore {
  return { score: 10 * (1 - input.resolvedRatio), available: true }
}
