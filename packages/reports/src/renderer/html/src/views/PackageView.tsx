// PackageView.tsx — drill-down for a single package: gauges, dimension chips, suite tree.
import React, { useState } from 'react';
import { C, alpha, fmt, hue, covColor, totalF, Donut, FindingsBadge, passRateHealth, coverageHealth, findingsHealth } from '../shared.tsx';
import { SuiteTree } from './SuiteTree.tsx';
import type { PackageInfo, SuiteInfo } from '../derive.ts';


interface PackageViewProps {
  pkg: PackageInfo;
  allSuites: SuiteInfo[];
}

type DimFilter = { dim: string; val: string } | null;

export function PackageView({ pkg, allSuites }: PackageViewProps) {
  const [dimFilter, setDimFilter] = useState<DimFilter>(null);

  // Suites belonging to this package
  const suites = allSuites.filter(s => s.pkg === pkg.name);

  // Aggregate dimension chips from suites
  const dims: Record<string, Record<string, { t: number; f: number }>> = {
    role: {}, domain: {}, layer: {},
  };
  for (const s of suites) {
    for (const [dim, val] of [['role', s.role], ['domain', s.domain], ['layer', s.layer]] as const) {
      if (!val || val === 'unknown') continue;
      if (!dims[dim][val]) dims[dim][val] = { t: 0, f: 0 };
      dims[dim][val].t += s.tests.length;
      dims[dim][val].f += s.tests.filter(t => t.status === 'failed').length;
    }
  }

  const hasDimChips = Object.values(dims).some(d => Object.keys(d).length > 0);

  const filtered = dimFilter
    ? suites.filter(s => s[dimFilter.dim as 'role' | 'domain' | 'layer'] === dimFilter.val)
    : suites;

  const pH = passRateHealth(pkg.passRate ?? 0);
  const cH = coverageHealth(pkg.coverage);
  const fH = findingsHealth(pkg.findings);

  return (
    <div>
      {/* ── Gauge row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>

        {/* Pass rate */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderLeft: `4px solid ${pH.accent}`, borderRadius: 12,
          padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, width: 100, height: 100,
            background: `radial-gradient(circle at top left, ${alpha(pH.accent, 9)}, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <span style={{
            position: 'absolute', top: 10, right: 10, fontSize: 10, padding: '2px 7px',
            borderRadius: 4, background: pH.bg, color: pH.accent, fontWeight: 600,
            letterSpacing: '0.04em', whiteSpace: 'nowrap',
          }}>{pH.chip}</span>
          <div style={{ marginTop: 22 }}>
            <Donut value={pkg.passRate ?? 0} size={88} color={hue(pkg.passRate ?? 0)}
              label="Pass Rate" sub={`${pkg.passed}/${pkg.tests} tests`} />
          </div>
        </div>

        {/* Coverage */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderLeft: `4px solid ${cH.accent}`, borderRadius: 12,
          padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, width: 100, height: 100,
            background: `radial-gradient(circle at top left, ${alpha(cH.accent, 9)}, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <span style={{
            position: 'absolute', top: 10, right: 10, fontSize: 10, padding: '2px 7px',
            borderRadius: 4, background: cH.bg, color: cH.accent, fontWeight: 600,
            letterSpacing: '0.04em', whiteSpace: 'nowrap',
          }}>{cH.chip}</span>
          <div style={{ marginTop: 22 }}>
            <Donut value={pkg.coverage} size={88} color={covColor(pkg.coverage)}
              label="Coverage" sub="by LCov" />
          </div>
        </div>

        {/* Findings */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderLeft: `4px solid ${fH.accent}`, borderRadius: 12,
          padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, width: 100, height: 100,
            background: `radial-gradient(circle at top left, ${alpha(fH.accent, 9)}, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <span style={{
            position: 'absolute', top: 10, right: 10, fontSize: 10, padding: '2px 7px',
            borderRadius: 4, background: fH.bg, color: fH.accent, fontWeight: 600,
            letterSpacing: '0.04em',
          }}>{fH.chip}</span>
          <div style={{ marginTop: 22, fontSize: 36, fontWeight: 800, lineHeight: 1, color: fH.accent }}>
            {totalF(pkg.findings)}
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>Findings</div>
          <FindingsBadge f={pkg.findings} />
        </div>

        {/* Suite count — neutral */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderLeft: `4px solid ${C.accent}`, borderRadius: 12,
          padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, width: 100, height: 100,
            background: `radial-gradient(circle at top left, ${alpha(C.accent, 9)}, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <div style={{ marginTop: 22, fontSize: 36, fontWeight: 800, color: C.text, lineHeight: 1 }}>
            {suites.length}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Test Suites</div>
          <div style={{ fontSize: 12, color: C.muted }}>{pkg.tests} total tests</div>
        </div>
      </div>

      {/* ── Dimension filter chips ── */}
      {hasDimChips && (
        <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
          {Object.entries(dims).map(([dim, vals]) => {
            if (Object.keys(vals).length === 0) return null;
            return (
              <div key={dim}>
                <div style={{
                  fontSize: 11, color: C.muted, marginBottom: 6,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{dim}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {Object.entries(vals).map(([val, st]) => {
                    const active = dimFilter?.dim === dim && dimFilter?.val === val;
                    return (
                      <button
                        key={val}
                        onClick={() => setDimFilter(active ? null : { dim, val })}
                        aria-pressed={active}
                        style={{
                          fontSize: 12, padding: '4px 10px', borderRadius: 6,
                          cursor: 'pointer', fontWeight: 500,
                          background: active ? alpha(C.accent, 13) : C.surface,
                          color:      active ? C.accent       : C.muted,
                          border:     `1px solid ${active ? C.accent : C.border}`,
                          transition: 'all 0.12s',
                        }}
                      >
                        {val}
                        <span style={{ color: C.muted, marginLeft: 5 }}>{st.t}</span>
                        {st.f > 0 && <span style={{ color: C.failed, marginLeft: 4 }}>·{st.f}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active filter notice */}
      {dimFilter && (
        <div style={{
          fontSize: 13, color: C.muted, marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          Showing <span style={{ color: C.accent, fontWeight: 600 }}>
            {dimFilter.dim}: {dimFilter.val}
          </span>
          <button
            onClick={() => setDimFilter(null)}
            aria-label="Clear filter"
            style={{ background: 'none', border: 'none', color: C.failed, cursor: 'pointer', fontSize: 13, padding: 0 }}
          >✕</button>
        </div>
      )}

      {/* ── Suite tree ── */}
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
        Test Suites
        {dimFilter && (
          <span style={{ fontSize: 13, fontWeight: 400, color: C.muted, marginLeft: 8 }}>
            ({filtered.length} of {suites.length})
          </span>
        )}
      </div>

      {filtered.length === 0
        ? <div style={{ color: C.muted, fontSize: 13, padding: '24px 0' }}>
            No suites match the current filter.
          </div>
        : <SuiteTree suites={filtered} activeDim={dimFilter ?? undefined} />
      }
    </div>
  );
}
