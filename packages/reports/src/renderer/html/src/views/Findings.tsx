import React, { useState, useEffect } from 'react'
import type { Finding } from '../../../../../model/findings.ts'

type SeverityFilter = 'all' | 'error' | 'warning' | 'info'
type KindFilter = 'all' | Finding['kind']

function subjectLabel(f: Finding): string {
  if (f.subject.type === 'file') return f.subject.path
  if (f.subject.type === 'edge') return `${f.subject.from} → ${f.subject.to}`
  return JSON.stringify(f.subject.dimensions)
}

export function Findings() {
  const [findings, setFindings] = useState<Finding[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')

  useEffect(() => {
    fetch('data/findings.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} loading data/findings.json`)
        return r.json() as Promise<Finding[]>
      })
      .then(setFindings)
      .catch(e => setLoadError((e as Error).message))
  }, [])

  if (loadError) {
    return <div className="spasco-error">Failed to load findings: {loadError}</div>
  }
  if (!findings) {
    return <div className="spasco-loading">Loading findings…</div>
  }

  const filtered = findings.filter(f => {
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false
    if (kindFilter !== 'all' && f.kind !== kindFilter) return false
    return true
  })

  const summary = { error: 0, warning: 0, info: 0 }
  for (const f of findings) summary[f.severity]++

  return (
    <div className="findings">
      <div className="findings-summary">
        <span className={`badge badge-error${summary.error === 0 ? ' badge-zero' : ''}`}>
          {summary.error} errors
        </span>
        <span className={`badge badge-warning${summary.warning === 0 ? ' badge-zero' : ''}`}>
          {summary.warning} warnings
        </span>
        <span className={`badge badge-info${summary.info === 0 ? ' badge-zero' : ''}`}>
          {summary.info} info
        </span>
      </div>

      <div className="filter-bar">
        <label className="filter-control">
          <span className="filter-label">severity</span>
          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value as SeverityFilter)}
          >
            <option value="all">All</option>
            <option value="error">error</option>
            <option value="warning">warning</option>
            <option value="info">info</option>
          </select>
        </label>
        <label className="filter-control">
          <span className="filter-label">kind</span>
          <select
            value={kindFilter}
            onChange={e => setKindFilter(e.target.value as KindFilter)}
          >
            <option value="all">All</option>
            <option value="violation">violation</option>
            <option value="coverage-gap">coverage-gap</option>
            <option value="flakiness">flakiness</option>
            <option value="unused">unused</option>
            <option value="metric">metric</option>
          </select>
        </label>
        {(severityFilter !== 'all' || kindFilter !== 'all') && (
          <button
            className="clear-filters"
            onClick={() => {
              setSeverityFilter('all')
              setKindFilter('all')
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <p className="findings-count">
        {filtered.length} of {findings.length} findings
        {findings.length === 0 && <span className="findings-clean"> — no findings, all good!</span>}
      </p>

      {filtered.length > 0 && (
        <table className="findings-table">
          <thead>
            <tr>
              <th>severity</th>
              <th>kind</th>
              <th>rule</th>
              <th>subject</th>
              <th>message</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f, i) => {
              const label = subjectLabel(f)
              return (
                <tr key={i} className={`severity-${f.severity}`}>
                  <td>{f.severity}</td>
                  <td>{f.kind}</td>
                  <td>{f.ruleId}</td>
                  <td title={label} className="subject-cell">
                    {label}
                  </td>
                  <td>{f.message}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
