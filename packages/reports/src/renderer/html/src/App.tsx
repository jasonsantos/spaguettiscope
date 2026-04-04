import React from 'react';
import { LayerHealth } from './views/LayerHealth.tsx';
import type { DashboardData } from './types.ts';

declare global {
  interface Window {
    __SPASCO_DATA__: DashboardData;
  }
}

export function App() {
  const data: DashboardData = window.__SPASCO_DATA__;

  return (
    <div className="spasco-root">
      <header className="spasco-header">
        <h1>SpaguettiScope</h1>
        {data.projectName && <span className="project-name">{data.projectName}</span>}
        <div className="overall-summary">
          <span className="total">{data.overall.total} tests</span>
          <span className="pass-rate">{(data.overall.passRate * 100).toFixed(1)}% passing</span>
          <span className="generated-at">Generated {new Date(data.generatedAt).toLocaleString()}</span>
        </div>
      </header>

      <main className="spasco-main">
        <LayerHealth dimensions={data.dimensions} />
      </main>
    </div>
  );
}
