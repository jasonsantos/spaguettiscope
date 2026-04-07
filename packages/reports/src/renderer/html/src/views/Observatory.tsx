// Observatory.tsx — project-wide overview: package map, connectors, trend, dimension widgets.
import React, { useState } from 'react';
import { LineChart, Line, Area, AreaChart, Tooltip, ResponsiveContainer } from 'recharts';
import { C, fmt, hue, covColor, totalF, StatusBar, PackageIcon } from '../shared.tsx';
import type { PackageInfo, FindingsCount, RawSummary } from '../derive.ts';

// ─── Status system ────────────────────────────────────────────────────────────
type HealthStatus = 'ok' | 'warn' | 'error' | 'neutral';

const S = {
  ok:      { accent: C.passed,  glow: C.passed,  text: C.passed,  bg: C.passedBg,  chip: '✓ Healthy'  },
  warn:    { accent: C.warning, glow: C.warning, text: C.warning, bg: C.warningBg, chip: '⚠ Warning'  },
  error:   { accent: C.failed,  glow: C.failed,  text: C.failed,  bg: C.failedBg,  chip: '✕ Issues'   },
  neutral: { accent: C.border,  glow: C.border,  text: C.text,    bg: 'transparent', chip: ''          },
} as const;

function passRateStatus(r: number): HealthStatus {
  if (r >= 1.0)  return 'ok';
  if (r >= 0.90) return 'warn';
  return 'error';
}
function coverageStatus(c: number): HealthStatus {
  if (c >= 0.80) return 'ok';
  if (c >= 0.60) return 'warn';
  return 'error';
}
function findingsStatus(f: FindingsCount): HealthStatus {
  if (f.error > 0)   return 'error';
  if (f.warning > 0) return 'warn';
  return 'ok';
}

// ─── Metric card ─────────────────────────────────────────────────────────────
function MetricCard({
  label, value, sub, status, bar,
}: {
  label: string;
  value: string;
  sub: string;
  status: HealthStatus;
  bar?: { passed: number; failed: number; broken: number; skipped: number; total: number };
}) {
  const st = S[status];
  return (
    <div style={{
      background: C.surface,
      borderRadius: 12,
      border: `1px solid ${C.border}`,
      borderLeft: `4px solid ${st.accent}`,
      padding: '20px 20px 20px 18px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Corner glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '60%', height: '100%',
        background: `linear-gradient(135deg, ${st.glow}12 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Label + status chip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
          {label}
        </div>
        {st.chip && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
            background: st.bg, color: st.text,
            border: `1px solid ${st.accent}44`,
            letterSpacing: '0.03em',
          }}>{st.chip}</span>
        )}
      </div>

      {/* Value */}
      <div style={{
        fontSize: 32, fontWeight: 800, color: st.text,
        letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 6,
      }}>{value}</div>

      {/* Sub */}
      <div style={{ fontSize: 12, color: C.muted }}>{sub}</div>

      {/* Optional status bar */}
      {bar && bar.total > 0 && (
        <div style={{ marginTop: 14 }}>
          <StatusBar {...bar} height={4} />
        </div>
      )}
    </div>
  );
}

// ─── Package map tiles ────────────────────────────────────────────────────────
const HIDDEN_FROM_DIM_PANELS = new Set(['package']);

const CONNECTOR_LABELS: Record<string, string> = {
  vitest:     'Vitest',
  playwright: 'Playwright E2E',
  allure:     'Allure',
  lcov:       'Coverage (LCov)',
  eslint:     'ESLint',
  typescript: 'TypeScript',
};

const CONNECTOR_CATEGORY_LABEL: Record<string, string> = {
  testing:  'testing',
  coverage: 'coverage',
  lint:     'lint',
};

const CONNECTOR_CATEGORY_COLOR: Record<string, string> = {
  testing:  C.accent,
  coverage: C.coverage,
  lint:     C.info,
};

interface PackageMapProps {
  packages: PackageInfo[];
  onSelect: (name: string) => void;
}

function PackageMap({ packages, onSelect }: PackageMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(134px, 1fr))',
      gap: 8,
    }}>
      {packages.map(p => {
        const st   = S[passRateStatus(p.passRate)];
        const isH  = hovered === p.name;
        const shortName = p.name.split('/').pop() ?? p.name;

        return (
          <div
            key={p.name}
            role="button"
            tabIndex={0}
            aria-label={`${p.name}: ${fmt(p.passRate)} pass rate, ${fmt(p.coverage)} coverage. Click to drill in.`}
            onClick={() => onSelect(p.name)}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect(p.name)}
            onMouseEnter={() => setHovered(p.name)}
            onMouseLeave={() => setHovered(null)}
            style={{
              borderRadius: 10,
              background: isH ? C.surfaceHigh : st.bg,
              border: `1px solid ${isH ? st.accent : st.accent + '55'}`,
              borderTop: `3px solid ${st.accent}`,
              padding: '14px 14px 12px',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 5,
              transition: 'all 0.15s', outline: 'none',
              boxShadow: isH ? `0 4px 24px ${st.accent}22, 0 0 0 1px ${st.accent}33` : 'none',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Package type watermark — bleeds off top-right, tinted to health border */}
            <div style={{
              position: 'absolute', right: -10, top: -10,
              color: st.accent,
              opacity: isH ? 0.18 : 0.10,
              pointerEvents: 'none',
              transition: 'opacity 0.15s',
              transform: 'rotate(5deg)',
            }}>
              <PackageIcon type={p.type} size={62} />
            </div>

            {/* Corner glow on hover */}
            {isH && (
              <div style={{
                position: 'absolute', inset: 0,
                background: `radial-gradient(ellipse at top left, ${st.accent}10 0%, transparent 60%)`,
                pointerEvents: 'none',
              }} />
            )}

            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {shortName}
            </div>
            <div style={{ fontSize: 23, fontWeight: 800, color: st.text, lineHeight: 1, letterSpacing: '-0.02em' }}>
              {fmt(p.passRate)}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>{p.tests} tests</div>
            <StatusBar passed={p.passed} failed={p.failed} broken={p.broken} skipped={p.skipped} total={p.tests} height={4} />
            <div style={{ fontSize: 11, fontWeight: 600, color: covColor(p.coverage), marginTop: 1 }}>
              {fmt(p.coverage)} cov
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Observatory ─────────────────────────────────────────────────────────────
interface ObservatoryProps {
  summary: RawSummary;
  packages: PackageInfo[];
  onSelectPackage: (name: string) => void;
  onSelectDimension: (dim: string, val: string) => void;
}

export function Observatory({ summary, packages, onSelectPackage, onSelectDimension }: ObservatoryProps) {
  const { overall, byConnector, history, dimensions, connectors } = summary;

  const trend = history.slice(-20).map((h, i) => ({ i, passRate: h.overall.passRate }));
  const avgCoverage = byConnector['lcov']?.overall.passRate ?? 0;

  const allFindings: FindingsCount = packages.reduce(
    (acc, p) => ({ error: acc.error + p.findings.error, warning: acc.warning + p.findings.warning, info: acc.info + p.findings.info }),
    { error: 0, warning: 0, info: 0 }
  );

  const dimEntries = Object.entries(dimensions).filter(([k]) => !HIDDEN_FROM_DIM_PANELS.has(k));

  return (
    <div>
      {/* ── Metric cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <MetricCard
          label="Pass Rate"
          value={fmt(overall.passRate)}
          sub={`${overall.passed.toLocaleString()} / ${overall.total.toLocaleString()} records`}
          status={passRateStatus(overall.passRate)}
          bar={{ passed: overall.passed, failed: overall.failed, broken: overall.broken, skipped: overall.skipped, total: overall.total }}
        />
        <MetricCard
          label="Coverage"
          value={fmt(avgCoverage)}
          sub={`${byConnector['lcov']?.overall.passed ?? 0} files covered`}
          status={coverageStatus(avgCoverage)}
        />
        <MetricCard
          label="Findings"
          value={String(allFindings.error + allFindings.warning)}
          sub={`${allFindings.error} errors · ${allFindings.warning} warnings · ${allFindings.info} info`}
          status={findingsStatus(allFindings)}
        />
        <MetricCard
          label="Packages"
          value={String(packages.length)}
          sub={`${connectors.length} connector${connectors.length !== 1 ? 's' : ''} active`}
          status="neutral"
        />
      </div>

      {/* ── Package map + sidebar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 296px', gap: 20, marginBottom: 32 }}>
        {/* Package map */}
        <div style={{
          background: C.surface, borderRadius: 12,
          border: `1px solid ${C.border}`, padding: 22,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Package Health Map</span>
            <span style={{ fontSize: 12, color: C.muted }}>click any package to drill in</span>
          </div>
          {packages.length > 0
            ? <PackageMap packages={packages} onSelect={onSelectPackage} />
            : <div style={{ color: C.muted, fontSize: 13, padding: '20px 0' }}>
                No packages found — run <code>spasco scan</code> first.
              </div>
          }
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Trend sparkline */}
          {trend.length > 1 && (
            <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Pass Rate Trend</div>
              <ResponsiveContainer width="100%" height={90}>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.passed} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={C.passed} stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="passRate" stroke={C.passed} strokeWidth={2}
                    fill="url(#trendGrad)" dot={false} />
                  <Tooltip
                    contentStyle={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, fontSize: 11, borderRadius: 8 }}
                    formatter={(v: number) => [fmt(v), 'Pass Rate']}
                    labelFormatter={() => ''}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                last {trend.length} runs
              </div>
            </div>
          )}

          {/* Connectors */}
          <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Connectors</div>
            {connectors.map(id => {
              const conn = byConnector[id];
              if (!conn) return null;
              const r   = conn.overall.passRate;
              const cat = conn.category;
              const catColor = CONNECTOR_CATEGORY_COLOR[cat] ?? C.muted;
              return (
                <div key={id} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                        {CONNECTOR_LABELS[id] ?? id}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99,
                        color: catColor, background: catColor + '18', border: `1px solid ${catColor}33`,
                        letterSpacing: '0.03em',
                      }}>{CONNECTOR_CATEGORY_LABEL[cat] ?? cat}</span>
                    </div>
                    <span style={{ fontSize: 13, color: hue(r), fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(r)}
                    </span>
                  </div>
                  <StatusBar
                    passed={conn.overall.passed} failed={conn.overall.failed}
                    skipped={conn.overall.skipped} broken={conn.overall.broken}
                    total={conn.overall.total} height={5}
                  />
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                    {conn.overall.total.toLocaleString()} {cat === 'testing' ? 'tests' : 'files'}
                    {conn.overall.failed > 0 && (
                      <span style={{ color: C.failed, marginLeft: 6 }}>
                        · {conn.overall.failed} failing
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Dimension panels ── */}
      {dimEntries.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(3, dimEntries.length)}, 1fr)`,
          gap: 20,
        }}>
          {dimEntries.map(([dim, slices]) => (
            <div key={dim} style={{
              background: C.surface, borderRadius: 12,
              border: `1px solid ${C.border}`, padding: 20,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, marginBottom: 16, color: C.muted,
                textTransform: 'uppercase', letterSpacing: '0.09em',
              }}>By {dim}</div>

              {/* Column headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: '10px 1fr 52px 52px 16px',
                gap: 8, alignItems: 'center', marginBottom: 4, paddingRight: 2,
              }}>
                <span />
                <span style={{ fontSize: 11, color: C.muted }}>value</span>
                <span style={{ fontSize: 11, color: C.muted, textAlign: 'right' }}>tests</span>
                <span style={{ fontSize: 11, color: C.muted, textAlign: 'right' }}>pass</span>
                <span />
              </div>

              {/* Rows */}
              {slices.map(s => {
                const rowStatus = s.passRate >= 1.0 ? 'ok' : s.passRate >= 0.90 ? 'warn' : 'error';
                const dotColor  = S[rowStatus].accent;
                return (
                  <button
                    key={s.value}
                    onClick={() => onSelectDimension(dim, s.value)}
                    aria-label={`${dim}: ${s.value} — ${s.total} tests, ${fmt(s.passRate)} passing. Click to view.`}
                    style={{
                      display: 'grid', gridTemplateColumns: '10px 1fr 52px 52px 16px',
                      gap: 8, alignItems: 'center', width: '100%',
                      background: 'none', border: 'none',
                      padding: '6px 4px 6px 0', borderRadius: 6,
                      cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.surfaceHigh)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    onFocus={e => (e.currentTarget.style.outline = `2px solid ${C.accent}`)}
                    onBlur={e => (e.currentTarget.style.outline = 'none')}
                  >
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      display: 'inline-block', justifySelf: 'center',
                      background: dotColor,
                      boxShadow: `0 0 6px ${dotColor}66`,
                    }} />

                    <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                      <span style={{
                        fontSize: 13, color: C.text, fontWeight: 600,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{s.value}</span>
                      <span style={{ height: 4, borderRadius: 2, overflow: 'hidden', background: C.border, display: 'block' }}>
                        <span style={{
                          display: 'block', height: '100%',
                          width: `${s.passRate * 100}%`, background: dotColor,
                          borderRadius: 2, transition: 'width 0.3s ease',
                        }} />
                      </span>
                    </span>

                    <span style={{
                      fontSize: 12, color: C.muted, textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}>{s.total}</span>

                    <span style={{
                      fontSize: 12, fontWeight: 700, textAlign: 'right',
                      color: dotColor, fontVariantNumeric: 'tabular-nums',
                    }}>{fmt(s.passRate)}</span>

                    {/* Arrow indicator — always present, signals interactivity */}
                    <span style={{ color: C.dim, fontSize: 11, textAlign: 'right' }}>›</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
