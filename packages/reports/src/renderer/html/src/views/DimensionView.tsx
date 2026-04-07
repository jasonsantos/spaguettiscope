// DimensionView.tsx — paginated suite list filtered by a single dimension tag.
import React from 'react';
import { C, fmt, hue, covColor } from '../shared.tsx';
import { SuiteTree } from './SuiteTree.tsx';
import type { SuiteInfo } from '../derive.ts';

interface DimensionViewProps {
  dim: string;
  val: string;
  allSuites: SuiteInfo[];
}

export function DimensionView({ dim, val, allSuites }: DimensionViewProps) {
  // Match on role / domain / layer / pkg
  const matched = allSuites.filter(
    s => s[dim as 'role' | 'domain' | 'layer' | 'pkg'] === val
  );

  const totalTests  = matched.reduce((n, s) => n + s.tests.length, 0);
  const totalPassed = matched.reduce((n, s) => n + s.tests.filter(t => t.status === 'passed').length, 0);
  const totalFailed = matched.reduce((n, s) => n + s.tests.filter(t => t.status === 'failed').length, 0);
  const overallRate = totalTests > 0 ? totalPassed / totalTests : 1;

  const rateColor = hue(overallRate);
  const rateBg    = overallRate >= 1.0 ? C.passedBg : overallRate >= 0.9 ? C.warningBg : C.failedBg;
  const rateChip  = overallRate >= 1.0 ? '✓ All passing' : overallRate >= 0.9 ? '⚠ Some failures' : '✕ Failures';

  return (
    <div>
      {/* ── Hero stats ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28,
        flexWrap: 'wrap', padding: '20px 24px', borderRadius: 14,
        background: C.surface, border: `1px solid ${C.border}`,
        borderLeft: `4px solid ${rateColor}`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Corner glow */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: 120, height: 120,
          background: `radial-gradient(circle at top left, ${rateColor}12, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        {/* Dimension + value title */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{
            fontSize: 11, color: C.muted, textTransform: 'uppercase',
            letterSpacing: '0.08em', fontWeight: 600,
          }}>{dim}</span>
          <span style={{
            fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: '-0.02em',
          }}>{val}</span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 36, background: C.border, flexShrink: 0 }} />

        {/* Pass rate */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ color: rateColor, fontWeight: 800, fontSize: 24, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(overallRate)}
          </span>
          <span style={{
            fontSize: 10, padding: '1px 7px', borderRadius: 4,
            background: rateBg, color: rateColor, fontWeight: 600,
            letterSpacing: '0.04em', alignSelf: 'flex-start',
          }}>{rateChip}</span>
        </div>

        {/* Stats pills */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 12, padding: '4px 10px', borderRadius: 6,
            background: C.surfaceHigh, color: C.muted, border: `1px solid ${C.border}`,
          }}>
            {totalTests} test{totalTests !== 1 ? 's' : ''}
          </span>
          {totalFailed > 0 && (
            <span style={{
              fontSize: 12, padding: '4px 10px', borderRadius: 6,
              background: C.failedBg, color: C.failed, fontWeight: 600,
              border: `1px solid ${C.failed}33`,
            }}>
              {totalFailed} failing
            </span>
          )}
          <span style={{
            fontSize: 12, padding: '4px 10px', borderRadius: 6,
            background: C.surfaceHigh, color: C.muted, border: `1px solid ${C.border}`,
          }}>
            {matched.length} suite{matched.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Suite tree ── */}
      {matched.length === 0
        ? <div style={{ color: C.muted, fontSize: 14, padding: '40px 0', textAlign: 'center' }}>
            No suites found for <strong style={{ color: C.text }}>{dim}: {val}</strong>.
          </div>
        : <SuiteTree suites={matched} activeDim={{ dim, val }} pageSize={10} />
      }
    </div>
  );
}
