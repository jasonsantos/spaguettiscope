import chalk from 'chalk'

const dim = chalk.dim
const bold = chalk.bold
const cyan = chalk.cyan

function pipeline(current: string): string {
  const steps = ['init', 'scan', 'annotate resolve', 'analyze/dashboard']
  return steps.map(s => (s === current ? bold.underline(s) : dim(s))).join(dim(' → '))
}

// --- init ---

export interface InitGuidanceInput {
  connectorCount: number
  pluginCount: number
  configPath: string
}

export function initGuidance(input: InitGuidanceInput): string {
  const lines = [
    '',
    dim(
      `What happened: Detected ${input.connectorCount} connector(s)${input.pluginCount > 0 ? ` and ${input.pluginCount} plugin(s)` : ''}, wrote ${input.configPath}.`
    ),
    '',
    dim('Pipeline: ') + pipeline('init'),
    '',
    `Next step: Scan your project files to build the skeleton and import graph.`,
    cyan(`  spasco scan`),
    '',
    dim(`The scan will discover workspace packages, classify files by role/domain/layer,`),
    dim(`and propose dimension values for you to review.`),
  ]
  return lines.join('\n')
}

// --- scan ---

export interface ScanGuidanceInput {
  fileCount: number
  newEntries: number
  unchanged: number
  stale: number
  pendingDomains: number
  pendingLayers: number
  layerPolicyPackages: number
  skeletonPath: string
}

export function scanGuidance(input: ScanGuidanceInput): string {
  const hasPending = input.pendingDomains > 0 || input.pendingLayers > 0
  const lines = [
    '',
    dim(
      `What happened: Scanned ${input.fileCount} files → ${input.newEntries} new, ${input.unchanged} unchanged, ${input.stale} stale entries in ${input.skeletonPath}.`
    ),
  ]

  if (input.layerPolicyPackages > 0) {
    lines.push(
      dim(
        `Analyzed import directions for ${input.layerPolicyPackages} package(s) and drafted a layer policy.`
      )
    )
  }

  lines.push('')
  lines.push(dim('Pipeline: ') + pipeline('scan'))
  lines.push('')

  if (hasPending) {
    const parts: string[] = []
    if (input.pendingDomains > 0) parts.push(`${input.pendingDomains} proposed domains`)
    if (input.pendingLayers > 0) parts.push(`${input.pendingLayers} proposed layers`)
    lines.push(`You have ${parts.join(' and ')} awaiting confirmation.`)
    lines.push(`Normally you'd confirm the proposed annotations next, then run analysis.`)
    lines.push('')
    lines.push(`Next step: Review and confirm the proposed annotations.`)
    lines.push(
      cyan(`  spasco annotate list`) + dim(`                          — see all pending entries`)
    )
    if (input.pendingDomains > 0) {
      lines.push(
        cyan(`  spasco annotate resolve --as domain --all`) +
          dim(`     — accept all proposed domains`)
      )
    }
    if (input.pendingLayers > 0) {
      lines.push(
        cyan(`  spasco annotate resolve --as layer --all`) +
          dim(`      — accept all proposed layers`)
      )
    }
    lines.push('')
    lines.push(
      dim(
        `If you're confident in the proposals, confirm with --all. To inspect first, run annotate list.`
      )
    )
  } else {
    lines.push(
      `Normally you'd confirm annotations next, but ${bold('nothing pending')} — skeleton is fully resolved.`
    )
    lines.push('')
    lines.push(`Next step: Run analysis or generate the dashboard.`)
    lines.push(
      cyan(`  spasco analyze`) +
        dim(`      — run analysis rules, compute entropy, surface findings`)
    )
    lines.push(cyan(`  spasco dashboard`) + dim(`    — generate the full HTML dashboard`))
  }

  return lines.join('\n')
}

// --- annotate list ---

export interface AnnotateListGuidanceInput {
  pendingCount: number
  dimensions: string[]
}

export function annotateListGuidance(input: AnnotateListGuidanceInput): string {
  const lines = ['']

  if (input.pendingCount === 0) {
    lines.push(dim('Pipeline: ') + pipeline('annotate resolve'))
    lines.push('')
    lines.push(`Skeleton is ${bold('fully resolved')} — no pending annotations.`)
    lines.push('')
    lines.push(`Next step: Run analysis or generate the dashboard.`)
    lines.push(cyan(`  spasco analyze`) + dim(`      — run analysis rules, compute entropy`))
    lines.push(cyan(`  spasco dashboard`) + dim(`    — generate the full HTML dashboard`))
  } else {
    lines.push(dim('Pipeline: ') + pipeline('annotate resolve'))
    lines.push('')
    lines.push(
      `${input.pendingCount} entries need annotation across dimensions: ${input.dimensions.join(', ')}.`
    )
    lines.push('')
    lines.push(`Next step: Resolve pending entries by dimension.`)
    for (const d of input.dimensions) {
      lines.push(
        cyan(`  spasco annotate resolve --as ${d} --all`) +
          dim(`  — accept all proposed ${d} values`)
      )
    }
    lines.push('')
    lines.push(dim(`Use --all to accept proposals, or pass specific values to override.`))
  }

  return lines.join('\n')
}

// --- annotate resolve ---

export interface AnnotateResolveGuidanceInput {
  resolved: number
  remainingDimensions: string[]
}

export function annotateResolveGuidance(input: AnnotateResolveGuidanceInput): string {
  const lines = [
    '',
    dim(`What happened: Resolved ${input.resolved} entr${input.resolved === 1 ? 'y' : 'ies'}.`),
    '',
    dim('Pipeline: ') + pipeline('annotate resolve'),
    '',
  ]

  if (input.remainingDimensions.length > 0) {
    lines.push(`Still pending: ${input.remainingDimensions.join(', ')} dimension(s).`)
    lines.push('')
    lines.push(`Next step: Resolve the remaining dimensions.`)
    for (const d of input.remainingDimensions) {
      lines.push(cyan(`  spasco annotate resolve --as ${d} --all`))
    }
  } else {
    lines.push(`All annotations resolved. Normally you'd run analysis next.`)
    lines.push('')
    lines.push(`Next step: Run analysis to compute entropy and surface findings.`)
    lines.push(cyan(`  spasco analyze`) + dim(`      — run analysis rules, compute entropy`))
    lines.push(cyan(`  spasco dashboard`) + dim(`    — generate the full HTML dashboard`))
  }

  return lines.join('\n')
}

// --- analyze ---

export interface AnalyzeGuidanceInput {
  errorCount: number
  warningCount: number
  infoCount: number
  entropyScore: number
  entropyClassification: string
}

export function analyzeGuidance(input: AnalyzeGuidanceInput): string {
  const total = input.errorCount + input.warningCount + input.infoCount
  const lines = [
    '',
    dim(
      `What happened: Ran analysis rules → ${total} findings (${input.errorCount} errors, ${input.warningCount} warnings, ${input.infoCount} info).`
    ),
    dim(`Entropy: ${input.entropyScore} (${input.entropyClassification}).`),
    '',
    dim('Pipeline: ') + pipeline('analyze/dashboard'),
    '',
  ]

  if (input.errorCount > 0) {
    lines.push(
      `Found ${bold(String(input.errorCount))} error-severity finding(s). These would fail a CI gate.`
    )
    lines.push('')
  }

  lines.push(`Next step: Generate the dashboard to visualize results, or gate CI.`)
  lines.push(
    cyan(`  spasco dashboard`) +
      dim(`                    — generate the full HTML dashboard with entropy`)
  )
  lines.push(
    cyan(`  spasco check`) +
      dim(`                        — exit 1 if error findings exist (for CI)`)
  )
  lines.push(
    cyan(`  spasco check --max-entropy 7.0`) + dim(`    — also fail if entropy exceeds threshold`)
  )

  return lines.join('\n')
}

// --- dashboard ---

export interface DashboardGuidanceInput {
  outputPath: string
  entropyScore: number
  entropyClassification: string
  testPassRate: number
  findingCount: number
}

export function dashboardGuidance(input: DashboardGuidanceInput): string {
  const lines = [
    '',
    dim(`What happened: Generated dashboard at ${input.outputPath}.`),
    dim(
      `Pass rate: ${(input.testPassRate * 100).toFixed(1)}% · Entropy: ${input.entropyScore} (${input.entropyClassification}) · ${input.findingCount} findings.`
    ),
    '',
    dim('Pipeline: ') + pipeline('analyze/dashboard'),
    '',
    `The dashboard is ready to view. For CI gating:`,
    cyan(`  spasco check`) + dim(`                        — exit 1 on error findings`),
    cyan(`  spasco check --severity warning`) + dim(`  — exit 1 on warnings too`),
    cyan(`  spasco check --max-entropy 7.0`) + dim(`    — also fail if entropy exceeds threshold`),
  ]

  return lines.join('\n')
}

// --- check ---

export interface CheckGuidanceInput {
  passed: boolean
  entropyScore: number
  maxEntropy: number | undefined
  severity: string
  errorCount: number
  warningCount: number
}

export function checkGuidance(input: CheckGuidanceInput): string {
  const lines = ['']

  if (input.passed) {
    lines.push(`Check ${bold('passed')} — no findings at ${input.severity} severity or above.`)
    if (input.maxEntropy !== undefined) {
      lines.push(dim(`Entropy ${input.entropyScore} is within threshold ${input.maxEntropy}.`))
    }
  } else {
    lines.push(`Check ${bold('failed')}.`)
    if (input.errorCount > 0) {
      lines.push(dim(`${input.errorCount} error(s) found. Run spasco analyze to see details.`))
    }
    if (input.maxEntropy !== undefined && input.entropyScore > input.maxEntropy) {
      lines.push(
        dim(
          `entropy score ${input.entropyScore} exceeds threshold ${input.maxEntropy}. Reduce complexity to lower it.`
        )
      )
    }
    lines.push('')
    lines.push(`To investigate:`)
    lines.push(cyan(`  spasco analyze`) + dim(`      — see all findings with details`))
    lines.push(cyan(`  spasco dashboard`) + dim(`    — generate visual dashboard for drill-down`))
  }

  return lines.join('\n')
}
