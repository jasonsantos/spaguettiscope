import { describe, it, expect } from 'vitest'
import { computeEntropy, classifyEntropy, type EntropyInput } from '../../entropy/index.js'

function makeInput(overrides: Partial<EntropyInput> = {}): EntropyInput {
  return {
    fileCount: 100,
    passRate: 1.0,
    flakyRatio: 0,
    circularDepFiles: 0,
    edgeCount: 150,
    maxFanOut: 5,
    unusedExports: 0,
    lcovCoverage: 0.8,
    coverageGaps: 0,
    findingsByWeight: 0,
    resolvedRatio: 1.0,
    ...overrides,
  }
}

describe('classifyEntropy', () => {
  it('classifies scores into the correct buckets', () => {
    expect(classifyEntropy(0)).toBe('excellent')
    expect(classifyEntropy(2.9)).toBe('excellent')
    expect(classifyEntropy(3.0)).toBe('good')
    expect(classifyEntropy(4.9)).toBe('good')
    expect(classifyEntropy(5.0)).toBe('moderate')
    expect(classifyEntropy(6.9)).toBe('moderate')
    expect(classifyEntropy(7.0)).toBe('poor')
    expect(classifyEntropy(8.9)).toBe('poor')
    expect(classifyEntropy(9.0)).toBe('critical')
    expect(classifyEntropy(10)).toBe('critical')
  })
})

describe('computeEntropy', () => {
  it('returns excellent for a pristine codebase', () => {
    const result = computeEntropy(makeInput())
    expect(result.score).toBeLessThan(3.0)
    expect(result.classification).toBe('excellent')
    expect(result.subscores.stability.available).toBe(true)
    expect(result.subscores.stability.score).toBe(0)
  })

  it('penalizes low pass rate in stability', () => {
    const result = computeEntropy(makeInput({ passRate: 0.5 }))
    expect(result.subscores.stability.score).toBe(5)
    expect(result.score).toBeGreaterThan(1)
  })

  it('penalizes flaky tests in stability', () => {
    const noFlaky = computeEntropy(makeInput({ passRate: 0.9 }))
    const withFlaky = computeEntropy(makeInput({ passRate: 0.9, flakyRatio: 0.5 }))
    expect(withFlaky.subscores.stability.score).toBeGreaterThan(noFlaky.subscores.stability.score)
  })

  it('penalizes circular dependencies in boundaries', () => {
    const result = computeEntropy(makeInput({ circularDepFiles: 25 }))
    expect(result.subscores.boundaries.score).toBeGreaterThan(0)
  })

  it('penalizes low coverage', () => {
    const result = computeEntropy(makeInput({ lcovCoverage: 0.2 }))
    expect(result.subscores.coverage.score).toBeGreaterThan(5)
  })

  it('penalizes findings by severity weight', () => {
    const result = computeEntropy(makeInput({ findingsByWeight: 50 }))
    expect(result.subscores.violations.score).toBeGreaterThan(0)
  })

  it('penalizes incomplete classification', () => {
    const result = computeEntropy(makeInput({ resolvedRatio: 0.3 }))
    expect(result.subscores.classification.score).toBe(7)
  })

  it('redistributes weight when stability is unavailable', () => {
    const withStability = computeEntropy(makeInput({ passRate: 1.0, lcovCoverage: 0.0 }))
    const withoutStability = computeEntropy(makeInput({ passRate: undefined, lcovCoverage: 0.0 }))
    expect(withoutStability.subscores.stability.available).toBe(false)
    expect(withoutStability.score).toBeGreaterThan(withStability.score)
  })

  it('redistributes weight when coverage is unavailable', () => {
    const result = computeEntropy(makeInput({ lcovCoverage: undefined }))
    expect(result.subscores.coverage.available).toBe(false)
    expect(typeof result.score).toBe('number')
  })

  it('handles zero files gracefully', () => {
    const result = computeEntropy(makeInput({ fileCount: 0 }))
    expect(result.score).toBe(0)
    expect(result.classification).toBe('excellent')
  })

  it('caps all subscores at 10', () => {
    const result = computeEntropy(makeInput({
      passRate: 0,
      flakyRatio: 1.0,
      circularDepFiles: 100,
      maxFanOut: 1000,
      unusedExports: 100,
      lcovCoverage: 0,
      coverageGaps: 100,
      findingsByWeight: 10000,
      resolvedRatio: 0,
    }))
    expect(result.subscores.stability.score).toBeLessThanOrEqual(10)
    expect(result.subscores.boundaries.score).toBeLessThanOrEqual(10)
    expect(result.subscores.coverage.score).toBeLessThanOrEqual(10)
    expect(result.subscores.violations.score).toBeLessThanOrEqual(10)
    expect(result.subscores.classification.score).toBeLessThanOrEqual(10)
    expect(result.score).toBeLessThanOrEqual(10)
  })
})
