import React, { useState, useEffect } from 'react'
import type { NormalizedRunRecord } from '../../../../../model/normalized.ts'

type DimensionFilters = Record<string, string>

function deriveFilterOptions(records: NormalizedRunRecord[]): Record<string, string[]> {
  const map: Record<string, Set<string>> = {}
  for (const record of records) {
    for (const [key, value] of Object.entries(record.dimensions)) {
      if (!map[key]) map[key] = new Set()
      map[key].add(value)
    }
  }
  // Only dimensions with 2+ distinct values become filter controls
  return Object.fromEntries(
    Object.entries(map)
      .filter(([, values]) => values.size >= 2)
      .map(([key, values]) => [key, Array.from(values).sort()])
  )
}

function applyFilters(
  records: NormalizedRunRecord[],
  filters: DimensionFilters
): NormalizedRunRecord[] {
  return records.filter(r =>
    Object.entries(filters).every(([dim, val]) => r.dimensions[dim] === val)
  )
}

export function Drilldown() {
  const [records, setRecords] = useState<NormalizedRunRecord[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filters, setFilters] = useState<DimensionFilters>({})

  useEffect(() => {
    fetch('data/records.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} loading data/records.json`)
        return r.json() as Promise<NormalizedRunRecord[]>
      })
      .then(setRecords)
      .catch(e => setLoadError((e as Error).message))
  }, [])

  if (loadError) {
    return <div className="spasco-error">Failed to load records: {loadError}</div>
  }
  if (!records) {
    return <div className="spasco-loading">Loading records…</div>
  }

  const filterOptions = deriveFilterOptions(records)
  const filtered = applyFilters(records, filters)
  const visibleDimensions = Object.keys(filterOptions)

  return (
    <div className="drilldown">
      <div className="filter-bar">
        {visibleDimensions.map(dim => (
          <label key={dim} className="filter-control">
            <span className="filter-label">{dim}</span>
            <select
              value={filters[dim] ?? ''}
              onChange={e => {
                const val = e.target.value
                setFilters(prev => {
                  const next = { ...prev }
                  if (val === '') delete next[dim]
                  else next[dim] = val
                  return next
                })
              }}
            >
              <option value="">All</option>
              {filterOptions[dim].map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
        ))}
        {Object.keys(filters).length > 0 && (
          <button className="clear-filters" onClick={() => setFilters({})}>
            Clear filters
          </button>
        )}
      </div>

      <p className="drilldown-count">
        {filtered.length} of {records.length} records
        {Object.keys(filters).length > 0 && (
          <span className="active-filters">
            {' '}— filtered by{' '}
            {Object.entries(filters)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')}
          </span>
        )}
      </p>

      <table className="records-table">
        <thead>
          <tr>
            <th>status</th>
            <th>name</th>
            <th>connector</th>
            {visibleDimensions.map(dim => <th key={dim}>{dim}</th>)}
            <th>ms</th>
          </tr>
        </thead>
        <tbody>
          {filtered.slice(0, 500).map(r => (
            <tr key={r.id} className={`status-${r.status}`}>
              <td>{r.status}</td>
              <td title={r.fullName}>{r.name}</td>
              <td>{r.connectorId}</td>
              {visibleDimensions.map(dim => (
                <td key={dim}>{r.dimensions[dim] ?? '—'}</td>
              ))}
              <td>{r.duration > 0 ? r.duration : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {filtered.length > 500 && (
        <p className="truncation-notice">
          Showing first 500 of {filtered.length} records.
        </p>
      )}
    </div>
  )
}
