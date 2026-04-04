import React, { useState } from 'react'
import { LayerHealth } from './views/LayerHealth.tsx'
import { Overview } from './views/Overview.tsx'
import { E2EConfidence } from './views/E2EConfidence.tsx'
import type { DashboardData } from './types.ts'

declare global {
  interface Window {
    __SPASCO_DATA__: DashboardData
  }
}

type TabId = 'overview' | 'layer-health' | 'e2e'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'layer-health', label: 'Layer Health' },
  { id: 'e2e', label: 'E2E Confidence' },
]

export function App() {
  const data: DashboardData = window.__SPASCO_DATA__
  const [activeTab, setActiveTab] = useState<TabId>('overview')

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
      </main>
    </div>
  )
}
