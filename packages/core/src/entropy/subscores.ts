import type { EntropyInput, EntropySubscore } from './types.js'

export function stabilitySubscore(input: EntropyInput): EntropySubscore {
  if (input.passRate === undefined) return { score: 0, available: false }
  const base = 10 * (1 - input.passRate)
  // Matches flaky-test rule threshold (10-90% failure rate)
  const flakyPenalty = (input.flakyRatio ?? 0) > 0.1 ? 2 : 0
  return { score: Math.min(10, base + flakyPenalty), available: true }
}

export function boundariesSubscore(input: EntropyInput): EntropySubscore {
  if (input.fileCount === 0) return { score: 0, available: true }
  // 50% files in cycles → score 5
  const circularScore = input.circularDepFiles / input.fileCount * 10
  const possibleEdges = input.fileCount * (input.fileCount - 1) || 1
  // 10% graph density → score 10
  const densityScore = input.edgeCount / possibleEdges * 100
  // 3× average fan-out → score 10
  const avgFanOut = input.edgeCount / input.fileCount
  const fanOutScore = input.maxFanOut / (avgFanOut * 3 || 1) * 10
  // 50% files unused → score 5
  const unusedScore = input.unusedExports / input.fileCount * 10
  const avg = (circularScore + densityScore + fanOutScore + unusedScore) / 4
  return {
    score: Math.min(10, avg),
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
  return { score: Math.min(10, rate), available: true }
}

export function classificationSubscore(input: EntropyInput): EntropySubscore {
  return { score: 10 * (1 - input.resolvedRatio), available: input.fileCount > 0 }
}
