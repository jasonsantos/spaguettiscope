import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Rule, RuleYield, RuleCandidate } from './types.js'

interface CompiledRule {
  rule: Rule
  regex: RegExp
  captureCount: number
}

function compileRule(rule: Rule): CompiledRule {
  let captureCount = 0
  let regexStr = rule.selector.path
    // Escape literal dots
    .replace(/\./g, '\\.')
    // Replace ($N) capture groups — each matches one path segment
    .replace(/\(\$\d+\)/g, () => {
      captureCount++
      return '([^/]+)'
    })
    // Replace /**/ (zero or more segments in the middle)
    .replace(/\/\*\*\//g, '/(?:.+/)?')
    // Replace /** at end (everything under a directory)
    .replace(/\/\*\*$/, '(?:/.+)?')
    // Replace **/ at start (any prefix path)
    .replace(/^\*\*\//, '(?:.+/)?')
    // Replace any remaining **
    .replace(/\*\*/g, '.+')
    // Replace single * (one segment, no slashes)
    .replace(/\*/g, '[^/]*')

  return { rule, regex: new RegExp(`^${regexStr}$`), captureCount }
}

function resolveYields(
  yields: RuleYield[],
  captures: string[]
): { attributes: Record<string, string>; isUncertain: boolean } {
  const attributes: Record<string, string> = {}
  let isUncertain = false
  for (const y of yields) {
    if (y.kind === 'concrete') {
      attributes[y.key] = y.value
    } else if (y.kind === 'extracted') {
      attributes[y.key] = captures[y.capture - 1] ?? ''
    } else {
      attributes['?'] = captures[y.capture - 1] ?? ''
      isUncertain = true
    }
  }
  return { attributes, isUncertain }
}

function deriveCandidatePath(pattern: string, captures: string[]): string {
  if (captures.length === 0) return pattern
  let i = 0
  const withCaptures = pattern.replace(/\(\$\d+\)/g, () => captures[i++] ?? '')
  const wildcardIdx = withCaptures.search(/[*?]/)
  if (wildcardIdx === -1) return withCaptures
  const prefix = withCaptures.slice(0, wildcardIdx).replace(/\/$/, '')
  return prefix ? `${prefix}/**` : withCaptures
}

export function runRules(
  relativeFilePaths: string[],
  rules: Rule[],
  projectRoot: string,
  disabledRuleIds: Set<string> = new Set()
): RuleCandidate[] {
  const compiled = rules.filter(r => !disabledRuleIds.has(r.id)).map(compileRule)

  const grouped = new Map<string, RuleCandidate>()

  for (const filePath of relativeFilePaths) {
    for (const { rule, regex, captureCount } of compiled) {
      const match = filePath.match(regex)
      if (!match) continue

      if (rule.selector.content) {
        try {
          const abs = join(projectRoot, filePath)
          const content = readFileSync(abs, { encoding: 'utf-8' })
          if (!new RegExp(rule.selector.content).test(content.slice(0, 200))) continue
        } catch {
          continue
        }
      }

      const captures = match.slice(1, captureCount + 1) as string[]
      const { attributes, isUncertain } = resolveYields(rule.yields, captures)
      const pathPattern = deriveCandidatePath(rule.selector.path, captures)
      const groupKey = `${rule.id}::${pathPattern}`

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, { pathPattern, attributes, source: rule.id, isUncertain })
      }
    }
  }

  return Array.from(grouped.values())
}
