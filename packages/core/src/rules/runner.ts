import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Rule, RuleYield, RuleCandidate } from './types.js'
import type { ImportGraph } from '../graph/index.js'
import { evaluateGraphPredicate } from '../graph/predicates.js'

export interface RunRulesOptions {
  disabledRuleIds?: Set<string>
  importGraph?: ImportGraph
}

interface CompiledRule {
  rule: Rule
  regex: RegExp
  captureCount: number
  contentRegex: RegExp | undefined
}

function compileRule(rule: Rule): CompiledRule {
  let captureCount = 0
  let regexStr = rule.selector.path
    .replace(/\./g, '\\.')
    .replace(/\(\$\d+\)/g, () => {
      captureCount++
      return '([^/]+)'
    })
    .replace(/\/\*\*\//g, '/(?:.+/)?')
    .replace(/\/\*\*$/, '(?:/.+)?')
    .replace(/^\*\*\//, '(?:.+/)?')
    .replace(/\*\*/g, '.+')
    .replace(/\*/g, '[^/]*')

  return {
    rule,
    regex: new RegExp(`^${regexStr}$`),
    captureCount,
    contentRegex: rule.selector.content ? new RegExp(rule.selector.content) : undefined,
  }
}

function resolveYields(
  yields: RuleYield[],
  captures: (string | undefined)[]
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

function deriveCandidatePath(pattern: string, captures: (string | undefined)[]): string {
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
  options?: RunRulesOptions
): RuleCandidate[] {
  const disabledRuleIds = options?.disabledRuleIds ?? new Set<string>()
  const importGraph = options?.importGraph

  const compiled = rules.filter(r => !disabledRuleIds.has(r.id)).map(compileRule)
  const grouped = new Map<string, RuleCandidate>()

  for (const filePath of relativeFilePaths) {
    for (const { rule, regex, captureCount, contentRegex } of compiled) {
      // 1. Path predicate
      const match = filePath.match(regex)
      if (!match) continue

      // 2. Content predicate
      if (contentRegex) {
        try {
          const abs = join(projectRoot, filePath)
          const content = readFileSync(abs, { encoding: 'utf-8' })
          if (!contentRegex.test(content.slice(0, 200))) continue
        } catch {
          continue
        }
      }

      // 3. Graph predicate — skip rule (not error) when no graph provided
      if (rule.selector.graph) {
        if (!importGraph) continue
        if (!evaluateGraphPredicate(filePath, rule.selector.graph, importGraph)) continue
      }

      const captures = match.slice(1, captureCount + 1) as (string | undefined)[]
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
