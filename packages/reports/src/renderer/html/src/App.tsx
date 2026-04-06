import React, { useState, useEffect } from 'react'
import { LayerHealth } from './views/LayerHealth.tsx'
import { Overview } from './views/Overview.tsx'
import { E2EConfidence } from './views/E2EConfidence.tsx'
import { Drilldown } from './views/Drilldown.tsx'
import { Findings } from './views/Findings.tsx'
import type { DashboardData } from './types.ts'

type TabId = 'overview' | 'layer-health' | 'e2e' | 'drilldown' | 'findings'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'layer-health', label: 'Layer Health' },
  { id: 'e2e', label: 'E2E Confidence' },
  { id: 'drilldown', label: 'Drill Down' },
  { id: 'findings', label: 'Findings' },
]

export function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  useEffect(() => {
    fetch('data/summary.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} loading data/summary.json`)
        return r.json() as Promise<DashboardData>
      })
      .then(setData)
      .catch(e => setLoadError((e as Error).message))
  }, [])

  if (loadError) {
    return (
      <div className="spasco-root">
        <div className="spasco-error">
          Failed to load dashboard: {loadError}
          <br />
          <small>Serve this directory over HTTP — do not open index.html as a file.</small>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="spasco-root">
        <div className="spasco-loading">Loading…</div>
      </div>
    )
  }

  return (
    <div className="spasco-root">
      <header className="spasco-header">
        <h1>SpaguettiScope</h1>
        {data.projectName && <span className="project-name">{data.projectName}</span>}
        <div className="overall-summary">
          <span className="total">{data.overall.total} records</span>
          <span className="pass-rate">{(data.overall.passRate * 100).toFixed(1)}% passing</span>
          <span className="generated-at">
            Generated {new Date(data.generatedAt).toLocaleString()}
          </span>
        </div>
      </header>

      <nav className="spasco-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="spasco-main">
        {activeTab === 'overview' && (
          <Overview
            connectors={data.connectors}
            overall={data.overall}
            byConnector={data.byConnector ?? {}}
          />
        )}
        {activeTab === 'layer-health' && <LayerHealth dimensions={data.dimensions} />}
        {activeTab === 'e2e' && <E2EConfidence playwrightData={data.byConnector?.['playwright']} />}
        {activeTab === 'drilldown' && <Drilldown />}
        {activeTab === 'findings' && <Findings />}
      </main>
    </div>
  )
}
