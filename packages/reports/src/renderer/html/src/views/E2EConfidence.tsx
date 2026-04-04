import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { AggregatedSlice, ConnectorAggregation } from '../types.ts'

interface E2EConfidenceProps {
  playwrightData: ConnectorAggregation | undefined
}

const STATUS_COLORS = {
  passed: '#22c55e',
  failed: '#ef4444',
  skipped: '#a3a3a3',
  broken: '#f97316',
  unknown: '#6b7280',
}

function confidenceColor(rate: number): string {
  if (rate >= 0.9) return '#22c55e'
  if (rate >= 0.7) return '#f97316'
  return '#ef4444'
}

function ConfidencePanel({ name, slices }: { name: string; slices: AggregatedSlice[] }) {
  const sorted = [...slices].sort((a, b) => b.total - a.total)

  return (
    <section className="dimension-panel">
      <h2 className="dimension-title">By {name}</h2>
      <ResponsiveContainer width="100%" height={Math.max(160, sorted.length * 48)}>
        <BarChart data={sorted} layout="vertical" margin={{ left: 16, right: 16 }}>
          <XAxis type="number" domain={[0, 'dataMax']} hide />
          <YAxis type="category" dataKey="value" width={160} tick={{ fill: '#e5e7eb' }} />
          <Tooltip
            formatter={(value: number, seriesName: string) => [value, seriesName]}
            contentStyle={{ background: '#1f2937', border: '1px solid #374151' }}
          />
          <Bar dataKey="passed" stackId="a" fill={STATUS_COLORS.passed} />
          <Bar dataKey="failed" stackId="a" fill={STATUS_COLORS.failed} />
          <Bar dataKey="skipped" stackId="a" fill={STATUS_COLORS.skipped} />
          <Bar dataKey="broken" stackId="a" fill={STATUS_COLORS.broken} />
          <Bar dataKey="unknown" stackId="a" fill={STATUS_COLORS.unknown} />
        </BarChart>
      </ResponsiveContainer>
      <table className="slice-table">
        <thead>
          <tr>
            <th>{name}</th>
            <th>specs</th>
            <th>confidence</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(slice => (
            <tr key={slice.value} className={slice.failed > 0 ? 'has-failures' : ''}>
              <td>{slice.value}</td>
              <td>{slice.total}</td>
              <td style={{ color: confidenceColor(slice.passRate) }}>
                {(slice.passRate * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export function E2EConfidence({ playwrightData }: E2EConfidenceProps) {
  if (!playwrightData) {
    return (
      <section className="dimension-panel empty">
        <p>No Playwright data. Add a playwright connector to your config.</p>
      </section>
    )
  }

  const { overall, dimensions } = playwrightData
  const entries = Object.entries(dimensions)
  const confidencePct = (overall.passRate * 100).toFixed(1)

  return (
    <div className="e2e-confidence">
      <div className="e2e-header">
        <span className="confidence-score" style={{ color: confidenceColor(overall.passRate) }}>
          {confidencePct}%
        </span>
        <span className="confidence-label">E2E Confidence</span>
        <span className="e2e-total">{overall.total} specs</span>
      </div>

      {entries.length === 0 ? (
        <p className="no-dimensions">No dimension data available from Playwright results.</p>
      ) : (
        entries.map(([name, slices]) => <ConfidencePanel key={name} name={name} slices={slices} />)
      )}
    </div>
  )
}
