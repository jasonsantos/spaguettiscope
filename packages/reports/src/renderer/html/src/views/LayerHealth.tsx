import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { AggregatedSlice } from '../types.ts';

interface LayerHealthProps {
  dimensions: Record<string, AggregatedSlice[]>;
}

const STATUS_COLORS = {
  passed: '#22c55e',
  failed: '#ef4444',
  skipped: '#a3a3a3',
  broken: '#f97316',
  unknown: '#6b7280',
};

function DimensionPanel({ name, slices }: { name: string; slices: AggregatedSlice[] }) {
  const sorted = [...slices].sort((a, b) => b.total - a.total);

  return (
    <section className="dimension-panel">
      <h2 className="dimension-title">By {name}</h2>
      <ResponsiveContainer width="100%" height={Math.max(120, sorted.length * 40)}>
        <BarChart data={sorted} layout="vertical" margin={{ left: 16, right: 16 }}>
          <XAxis type="number" domain={[0, 'dataMax']} hide />
          <YAxis type="category" dataKey="value" width={160} tick={{ fill: '#e5e7eb' }} />
          <Tooltip
            formatter={(value: number, name: string) => [value, name]}
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
            <th>total</th>
            <th>pass rate</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(slice => (
            <tr key={slice.value} className={slice.failed > 0 ? 'has-failures' : ''}>
              <td>{slice.value}</td>
              <td>{slice.total}</td>
              <td>{(slice.passRate * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function LayerHealth({ dimensions }: LayerHealthProps) {
  const entries = Object.entries(dimensions);

  if (entries.length === 0) {
    return (
      <section className="dimension-panel empty">
        <p>No dimension data available. Check your connector configuration.</p>
      </section>
    );
  }

  return (
    <div className="layer-health">
      <h1 className="view-title">Layer Health</h1>
      {entries.map(([name, slices]) => (
        <DimensionPanel key={name} name={name} slices={slices} />
      ))}
    </div>
  );
}
