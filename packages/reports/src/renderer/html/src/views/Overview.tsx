import React from 'react'
import type { ConnectorAggregation, OverallSummary } from '../types.ts'

interface OverviewProps {
  connectors: string[]
  overall: OverallSummary
  byConnector: Record<string, ConnectorAggregation>
}

const CONNECTOR_LABELS: Record<string, string> = {
  allure: 'Allure',
  playwright: 'Playwright E2E',
  vitest: 'Vitest',
  lcov: 'Coverage (LCOV)',
  eslint: 'ESLint',
  typescript: 'TypeScript',
}

const COVERAGE_CONNECTORS = new Set(['lcov'])
const LINT_CONNECTORS = new Set(['eslint', 'typescript'])

function passRateColor(rate: number): string {
  if (rate >= 0.9) return '#22c55e'
  if (rate >= 0.7) return '#f97316'
  return '#ef4444'
}

function ConnectorCard({ id, aggregation }: { id: string; aggregation: ConnectorAggregation }) {
  const { overall } = aggregation
  const label = CONNECTOR_LABELS[id] ?? id
  const pct = (overall.passRate * 100).toFixed(1)
  const color = passRateColor(overall.passRate)
  const isCoverage = COVERAGE_CONNECTORS.has(id)
  const isLint = LINT_CONNECTORS.has(id)

  return (
    <div className="connector-card">
      <div className="connector-card-header">
        <span className="connector-name">{label}</span>
        <span className="connector-rate" style={{ color }}>
          {isCoverage ? `${pct}% covered` : isLint ? `${pct}% clean` : `${pct}% passing`}
        </span>
      </div>
      <div className="connector-card-stats">
        <span className="stat">
          <span className="stat-value">{overall.total}</span>
          <span className="stat-label">{isCoverage || isLint ? 'files' : 'tests'}</span>
        </span>
        {overall.failed > 0 && (
          <span className="stat stat-failed">
            <span className="stat-value">{overall.failed}</span>
            <span className="stat-label">failing</span>
          </span>
        )}
        {overall.skipped > 0 && (
          <span className="stat stat-skipped">
            <span className="stat-value">{overall.skipped}</span>
            <span className="stat-label">skipped</span>
          </span>
        )}
      </div>
    </div>
  )
}

export function Overview({ connectors, overall, byConnector }: OverviewProps) {
  const overallPct = (overall.passRate * 100).toFixed(1)
  const overallColor = passRateColor(overall.passRate)

  return (
    <div className="overview">
      <div className="overall-card">
        <span className="overall-label">All connectors</span>
        <span className="overall-pct" style={{ color: overallColor }}>
          {overallPct}%
        </span>
        <span className="overall-total">{overall.total} total records</span>
      </div>

      <div className="connector-grid">
        {connectors.map(id => {
          const aggregation = byConnector[id]
          if (!aggregation) return null
          return <ConnectorCard key={id} id={id} aggregation={aggregation} />
        })}
      </div>
    </div>
  )
}
