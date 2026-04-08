import { describe, it, expect } from 'vitest'
import {
  initGuidance,
  scanGuidance,
  annotateListGuidance,
  annotateResolveGuidance,
  analyzeGuidance,
  dashboardGuidance,
  checkGuidance,
} from '../../formatter/guidance.js'

describe('scanGuidance', () => {
  it('suggests annotate resolve when there are pending entries', () => {
    const msg = scanGuidance({
      fileCount: 903,
      newEntries: 19,
      unchanged: 0,
      stale: 0,
      pendingDomains: 4,
      pendingLayers: 7,
      layerPolicyPackages: 3,
      skeletonPath: '.spasco/skeleton.yaml',
    })
    expect(msg).toContain('annotate')
    expect(msg).toContain('4 proposed domains')
    expect(msg).toContain('7 proposed layers')
    expect(msg).toContain('init → scan')
  })

  it('suggests analyze/dashboard when nothing is pending', () => {
    const msg = scanGuidance({
      fileCount: 903,
      newEntries: 0,
      unchanged: 19,
      stale: 0,
      pendingDomains: 0,
      pendingLayers: 0,
      layerPolicyPackages: 3,
      skeletonPath: '.spasco/skeleton.yaml',
    })
    expect(msg).toContain('nothing pending')
    expect(msg).toContain('analyze')
    expect(msg).toContain('dashboard')
  })
})

describe('initGuidance', () => {
  it('suggests scan as next step', () => {
    const msg = initGuidance({
      connectorCount: 3,
      pluginCount: 1,
      configPath: 'spasco.config.json',
    })
    expect(msg).toContain('spasco scan')
    expect(msg).toContain('3 connector')
  })
})

describe('analyzeGuidance', () => {
  it('includes entropy score', () => {
    const msg = analyzeGuidance({
      errorCount: 0,
      warningCount: 2,
      infoCount: 5,
      entropyScore: 4.2,
      entropyClassification: 'good',
    })
    expect(msg).toContain('4.2')
    expect(msg).toContain('good')
    expect(msg).toContain('dashboard')
  })

  it('suggests investigating when there are errors', () => {
    const msg = analyzeGuidance({
      errorCount: 3,
      warningCount: 0,
      infoCount: 0,
      entropyScore: 7.5,
      entropyClassification: 'poor',
    })
    expect(msg).toContain('3 error')
    expect(msg).toContain('7.5')
  })
})

describe('annotateListGuidance', () => {
  it('suggests resolve when entries exist', () => {
    const msg = annotateListGuidance({ pendingCount: 11, dimensions: ['domain', 'layer'] })
    expect(msg).toContain('annotate resolve')
    expect(msg).toContain('11')
  })

  it('suggests analyze when fully resolved', () => {
    const msg = annotateListGuidance({ pendingCount: 0, dimensions: [] })
    expect(msg).toContain('fully resolved')
    expect(msg).toContain('analyze')
  })
})

describe('annotateResolveGuidance', () => {
  it('suggests next dimension when more remain', () => {
    const msg = annotateResolveGuidance({ resolved: 4, remainingDimensions: ['layer'] })
    expect(msg).toContain('layer')
    expect(msg).toContain('annotate resolve')
  })

  it('suggests analyze when all resolved', () => {
    const msg = annotateResolveGuidance({ resolved: 7, remainingDimensions: [] })
    expect(msg).toContain('analyze')
  })
})

describe('dashboardGuidance', () => {
  it('mentions output path and check command', () => {
    const msg = dashboardGuidance({
      outputPath: '.spasco/reports/index.html',
      entropyScore: 3.1,
      entropyClassification: 'good',
      testPassRate: 1.0,
      findingCount: 0,
    })
    expect(msg).toContain('.spasco/reports/index.html')
    expect(msg).toContain('spasco check')
  })
})

describe('checkGuidance', () => {
  it('shows pass result', () => {
    const msg = checkGuidance({
      passed: true,
      entropyScore: 2.1,
      maxEntropy: undefined,
      severity: 'error',
      errorCount: 0,
      warningCount: 0,
    })
    expect(msg).toContain('passed')
  })

  it('shows fail result with suggestions', () => {
    const msg = checkGuidance({
      passed: false,
      entropyScore: 8.0,
      maxEntropy: 7.0,
      severity: 'error',
      errorCount: 3,
      warningCount: 5,
    })
    expect(msg).toContain('failed')
    expect(msg).toContain('entropy')
  })
})
