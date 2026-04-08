// App.tsx — root component: data loading, navigation state, header, breadcrumb.
import React, { useState, useEffect, useMemo } from 'react';
import type { RawSummary, RawRecord, RawFinding } from './derive.ts';
import { derivePackages, deriveSuites, deriveTestingOverall, deriveCoverageDimensions } from './derive.ts';
import { C, alpha, fmt, passRateHealth, PackageIcon } from './shared.tsx';
import { Observatory }   from './views/Observatory.tsx';
import { PackageView }   from './views/PackageView.tsx';
import { DimensionView } from './views/DimensionView.tsx';
import { FindingsView }  from './views/FindingsView.tsx';
import type { PackageInfo } from './derive.ts';

// ─── Theme toggle ─────────────────────────────────────────────────────────────
type ThemeMode = 'system' | 'dark' | 'light';

function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(
    () => (localStorage.getItem('spasco-theme') as ThemeMode) ?? 'system'
  );

  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', mode);
    }
    localStorage.setItem('spasco-theme', mode);
  }, [mode]);

  // Sync system preference changes while in 'system' mode
  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { /* force re-render on system change */ setMode(m => m); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  const cycle = () =>
    setMode(m => m === 'system' ? 'dark' : m === 'dark' ? 'light' : 'system');

  return { mode, cycle };
}

const THEME_ICONS: Record<ThemeMode, React.ReactNode> = {
  system: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  dark: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  light: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
};

const THEME_LABELS: Record<ThemeMode, string> = {
  system: 'System',
  dark:   'Dark',
  light:  'Light',
};

// ─── Navigation state ─────────────────────────────────────────────────────────
type Drill =
  | null
  | { type: 'package';   name: string }
  | { type: 'dimension'; dim: string; val: string }
  | { type: 'findings' };

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
    () => records ? deriveSuites(records, summary?.projectRoot) : [],
    [records, summary]
  );

  const coverageDims = useMemo(
    () => summary ? deriveCoverageDimensions(summary) : {},
    [summary]
  );

  return {
    summary, packages, suites, findings: findings ?? [], coverageDims, loadErr,
    loading: !summary || !records || !findings,
  };
}

// ─── Header health badge ──────────────────────────────────────────────────────
function HealthBadge({ r }: { r: number }) {
  const h = passRateHealth(r);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '5px 12px', borderRadius: 20,
      background: h.bg, border: `1px solid ${alpha(h.accent, 27)}`,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: h.accent,
        boxShadow: `0 0 6px ${h.accent}`,
        flexShrink: 0,
      }} />
      <span style={{ color: h.accent, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {fmt(r)}
      </span>
      <span style={{ color: h.accent, opacity: 0.8, fontSize: 12 }}>{h.chip}</span>
    </span>
  );
}

// ─── Package breadcrumb chip ──────────────────────────────────────────────────
function PackageBreadcrumb({ name, pkg }: { name: string; pkg: PackageInfo | undefined }) {
  const h = pkg?.passRate != null ? passRateHealth(pkg.passRate) : passRateHealth(0);
  return (
    <>
      <span style={{ color: C.border, fontSize: 18, lineHeight: 1, userSelect: 'none' }} aria-hidden="true">/</span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px 3px 8px', borderRadius: 6, fontWeight: 600,
        background: h.bg,
        border: `1px solid ${alpha(h.accent, 27)}`,
        borderLeft: `3px solid ${h.accent}`,
        color: C.text,
      }}>
        <span style={{ color: h.accent, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <PackageIcon type={pkg?.type ?? 'library'} size={15} />
        </span>
        {name.split('/').pop()}
      </span>
    </>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const [drill, setDrill] = useState<Drill>(null);
  const { summary, packages, suites, findings, coverageDims, loadErr, loading } = useDashboardData();
  const { mode: themeMode, cycle: cycleTheme } = useTheme();

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
            width: 32, height: 32, borderRadius: 10,
            background: `linear-gradient(135deg, ${C.accent}, ${C.coverage})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 800,
            color: '#fff', /* intentional pure white — max contrast on gradient */
            flexShrink: 0,
            userSelect: 'none',
            boxShadow: `0 0 14px ${alpha(C.accent, 33)}`,
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
          <button
            onClick={cycleTheme}
            aria-label={`Theme: ${THEME_LABELS[themeMode]} — click to cycle`}
            title={`Theme: ${THEME_LABELS[themeMode]}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', borderRadius: 8,
              background: C.surface, border: `1px solid ${C.border}`,
              color: C.muted, cursor: 'pointer', fontSize: 12, fontWeight: 500,
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            {THEME_ICONS[themeMode]}
            <span>{THEME_LABELS[themeMode]}</span>
          </button>
          <HealthBadge r={deriveTestingOverall(summary).passRate} />
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

        {drill?.type === 'package' && (
          <PackageBreadcrumb
            name={drill.name}
            pkg={packages.find(p => p.name === drill.name)}
          />
        )}

        {drill?.type === 'dimension' && (
          <>
            <span style={{ color: C.border, fontSize: 18, lineHeight: 1, userSelect: 'none' }} aria-hidden="true">/</span>
            <span style={{ color: C.muted, padding: '3px 6px' }}>{drill.dim}</span>
            <span style={{ color: C.border, fontSize: 18, lineHeight: 1, userSelect: 'none' }} aria-hidden="true">/</span>
            <span style={{
              fontSize: 12, padding: '3px 10px', borderRadius: 6,
              background: alpha(C.accent, 13), color: C.accent, fontWeight: 700,
              border: `1px solid ${alpha(C.accent, 27)}`,
            }}>{drill.val}</span>
          </>
        )}

        {drill?.type === 'findings' && (
          <>
            <span style={{ color: C.border, fontSize: 18, lineHeight: 1, userSelect: 'none' }} aria-hidden="true">/</span>
            <span style={{
              fontSize: 12, padding: '3px 10px', borderRadius: 6,
              background: C.failedBg, color: C.failed, fontWeight: 700,
              border: `1px solid ${alpha(C.failed, 27)}`,
            }}>Findings</span>
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
            onSelectFindings={() => setDrill({ type: 'findings' })}
          />
        )}

        {drill?.type === 'package' && (() => {
          const pkg = packages.find(p => p.name === drill.name);
          return pkg
            ? <PackageView pkg={pkg} allSuites={suites} />
            : <div style={{ color: C.muted }}>Package "{drill.name}" not found.</div>;
        })()}

        {drill?.type === 'dimension' && (
          <DimensionView
            dim={drill.dim}
            val={drill.val}
            allSuites={suites}
            coverage={coverageDims[drill.dim]?.get(drill.val)}
          />
        )}

        {drill?.type === 'findings' && (
          <FindingsView findings={findings} />
        )}
      </main>
    </div>
  );
}
