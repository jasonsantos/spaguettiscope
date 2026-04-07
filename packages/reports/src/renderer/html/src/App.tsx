// App.tsx — root component: data loading, navigation state, header, breadcrumb.
import React, { useState, useEffect, useMemo } from 'react';
import type { RawSummary, RawRecord, RawFinding } from './derive.ts';
import { derivePackages, deriveSuites } from './derive.ts';
import { C, fmt, hue, PackageIcon } from './shared.tsx';
import { Observatory }   from './views/Observatory.tsx';
import { PackageView }   from './views/PackageView.tsx';
import { DimensionView } from './views/DimensionView.tsx';

// ─── Navigation state ─────────────────────────────────────────────────────────
type Drill =
  | null
  | { type: 'package';   name: string }
  | { type: 'dimension'; dim: string; val: string };

// ─── Data loading hook ────────────────────────────────────────────────────────
function useDashboardData() {
  const [summary,  setSummary]  = useState<RawSummary  | null>(null);
  const [records,  setRecords]  = useState<RawRecord[]  | null>(null);
  const [findings, setFindings] = useState<RawFinding[] | null>(null);
  const [loadErr,  setLoadErr]  = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('data/summary.json').then(r  => { if (!r.ok)  throw new Error(`summary.json: HTTP ${r.status}`);  return r.json() as Promise<RawSummary>;   }),
      fetch('data/records.json').then(r  => { if (!r.ok)  throw new Error(`records.json: HTTP ${r.status}`);  return r.json() as Promise<RawRecord[]>;   }),
      fetch('data/findings.json').then(r => { if (!r.ok)  throw new Error(`findings.json: HTTP ${r.status}`); return r.json() as Promise<RawFinding[]>;  }),
    ])
      .then(([s, rec, fin]) => { setSummary(s); setRecords(rec); setFindings(fin); })
      .catch(e => setLoadErr((e as Error).message));
  }, []);

  const packages = useMemo(
    () => summary && findings ? derivePackages(summary, findings) : [],
    [summary, findings]
  );

  const suites = useMemo(
    () => records ? deriveSuites(records) : [],
    [records]
  );

  return {
    summary, packages, suites, loadErr,
    loading: !summary || !records || !findings,
  };
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [drill, setDrill] = useState<Drill>(null);
  const { summary, packages, suites, loadErr, loading } = useDashboardData();

  // ── Loading / error states ──
  if (loadErr) {
    return (
      <div style={{
        fontFamily: 'sans-serif', background: C.bg, minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 32, flexDirection: 'column', gap: 12, textAlign: 'center',
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.failed }}>
          Failed to load dashboard data
        </div>
        <div style={{ fontSize: 13, color: C.muted }}>{loadErr}</div>
        <div style={{ fontSize: 12, color: C.muted }}>
          Serve this directory over HTTP — do not open <code>index.html</code> as a file:
          <br />
          <code style={{ color: C.text }}>npx serve .</code>
        </div>
      </div>
    );
  }

  if (loading || !summary) {
    return (
      <div style={{
        fontFamily: 'sans-serif', background: C.bg, color: C.muted,
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        Loading…
      </div>
    );
  }

  // ── Layout ──
  const isDrilled = drill !== null;

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: C.bg, color: C.text, minHeight: '100vh', fontSize: 14,
    }}>
      {/* ── Header ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 32px', borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: `linear-gradient(135deg, ${C.accent}, ${C.coverage})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 800, color: '#fff', flexShrink: 0,
            userSelect: 'none',
            boxShadow: `0 0 14px ${C.accent}55`,
          }}>S</div>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>
            SpaguettiScope
          </span>
          {summary.projectName && (
            <span style={{
              fontSize: 13, color: C.muted,
              borderLeft: `1px solid ${C.border}`, paddingLeft: 12,
            }}>{summary.projectName}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
          {/* Health badge */}
          {(() => {
            const r   = summary.overall.passRate;
            const col = r >= 1.0 ? C.passed : r >= 0.9 ? C.warning : C.failed;
            const bg  = r >= 1.0 ? C.passedBg : r >= 0.9 ? C.warningBg : C.failedBg;
            const lbl = r >= 1.0 ? '✓ All passing' : r >= 0.9 ? '⚠ Some failures' : '✕ Failures';
            return (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '5px 12px', borderRadius: 20,
                background: bg, border: `1px solid ${col}44`,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: col,
                  boxShadow: `0 0 6px ${col}`,
                  flexShrink: 0,
                }} />
                <span style={{ color: col, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(r)}
                </span>
                <span style={{ color: col, opacity: 0.8, fontSize: 12 }}>{lbl}</span>
              </span>
            );
          })()}
          <span style={{ color: C.muted }}>
            {new Date(summary.generatedAt).toLocaleString()}
          </span>
        </div>
      </header>

      {/* ── Breadcrumb ── */}
      <nav aria-label="Location" style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '9px 32px',
        borderBottom: `1px solid ${C.border}`, background: C.surface, fontSize: 13,
      }}>
        <button
          onClick={() => setDrill(null)}
          style={{
            background: isDrilled ? 'none' : C.surfaceHigh,
            border: isDrilled ? 'none' : `1px solid ${C.border}`,
            borderRadius: 6, padding: isDrilled ? 0 : '3px 10px', fontSize: 13,
            cursor: isDrilled ? 'pointer' : 'default',
            color: isDrilled ? C.accent : C.text, fontWeight: 600,
            transition: 'color 0.12s',
          }}
        >
          Observatory
        </button>

        {drill?.type === 'package' && (() => {
          const pkg = packages.find(p => p.name === drill.name);
          const r   = pkg?.passRate ?? 1;
          const bc  = r >= 1.0 ? C.passed : r >= 0.9 ? C.warning : C.failed;
          const bg  = r >= 1.0 ? C.passedBg : r >= 0.9 ? C.warningBg : C.failedBg;
          return (
            <>
              <span style={{ color: C.border, fontSize: 18, lineHeight: 1, userSelect: 'none' }} aria-hidden="true">/</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '3px 10px 3px 8px', borderRadius: 6, fontWeight: 600,
                background: bg,
                border: `1px solid ${bc}44`,
                borderLeft: `3px solid ${bc}`,
                color: C.text,
              }}>
                <span style={{ color: bc, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <PackageIcon type={pkg?.type ?? 'library'} size={15} />
                </span>
                {drill.name.split('/').pop()}
              </span>
            </>
          );
        })()}

        {drill?.type === 'dimension' && (
          <>
            <span style={{ color: C.border, fontSize: 18, lineHeight: 1, userSelect: 'none' }} aria-hidden="true">/</span>
            <span style={{ color: C.muted, padding: '3px 6px' }}>{drill.dim}</span>
            <span style={{ color: C.border, fontSize: 18, lineHeight: 1, userSelect: 'none' }} aria-hidden="true">/</span>
            <span style={{
              fontSize: 12, padding: '3px 10px', borderRadius: 6,
              background: C.accent + '22', color: C.accent, fontWeight: 700,
              border: `1px solid ${C.accent}44`,
            }}>{drill.val}</span>
          </>
        )}
      </nav>

      {/* ── Page content ── */}
      <main style={{ padding: '28px 32px' }}>
        {!drill && (
          <Observatory
            summary={summary}
            packages={packages}
            onSelectPackage={name => setDrill({ type: 'package', name })}
            onSelectDimension={(dim, val) => setDrill({ type: 'dimension', dim, val })}
          />
        )}

        {drill?.type === 'package' && (() => {
          const pkg = packages.find(p => p.name === drill.name);
          return pkg
            ? <PackageView pkg={pkg} allSuites={suites} />
            : <div style={{ color: C.muted }}>Package "{drill.name}" not found.</div>;
        })()}

        {drill?.type === 'dimension' && (
          <DimensionView dim={drill.dim} val={drill.val} allSuites={suites} />
        )}
      </main>
    </div>
  );
}
