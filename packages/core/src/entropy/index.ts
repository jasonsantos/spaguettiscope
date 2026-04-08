export { type EntropyResult, type EntropySubscore, type EntropyInput, ENTROPY_THRESHOLDS, SUBSCORE_WEIGHTS, classifyEntropy } from './types.js'

import type { EntropyInput, EntropyResult, EntropySubscore } from './types.js'
import { SUBSCORE_WEIGHTS, classifyEntropy } from './types.js'
import {
  stabilitySubscore,
  boundariesSubscore,
  coverageSubscore,
  violationsSubscore,
  classificationSubscore,
} from './subscores.js'

type SubscoreKey = keyof typeof SUBSCORE_WEIGHTS

const SUBSCORE_FNS: Record<SubscoreKey, (input: EntropyInput) => EntropySubscore> = {
  stability: stabilitySubscore,
  boundaries: boundariesSubscore,
  coverage: coverageSubscore,
  violations: violationsSubscore,
  classification: classificationSubscore,
}

export function computeEntropy(input: EntropyInput): EntropyResult {
  if (input.fileCount === 0) {
    return {
      score: 0,
      classification: 'excellent',
      subscores: {
        stability: { score: 0, available: false },
        boundaries: { score: 0, available: false },
        coverage: { score: 0, available: false },
        violations: { score: 0, available: false },
        classification: { score: 0, available: false },
      },
    }
  }

  const subscores = {} as EntropyResult['subscores']
  let totalWeight = 0
  let weightedSum = 0

  for (const key of Object.keys(SUBSCORE_FNS) as SubscoreKey[]) {
    const sub = SUBSCORE_FNS[key](input)
    subscores[key] = sub
    if (sub.available) {
      totalWeight += SUBSCORE_WEIGHTS[key]
      weightedSum += SUBSCORE_WEIGHTS[key] * sub.score
    }
  }

  const score = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 10) / 10
    : 0

  return {
    score,
    classification: classifyEntropy(score),
    subscores,
  }
}
