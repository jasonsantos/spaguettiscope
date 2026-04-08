// Observatory.tsx — project-wide overview: package map, connectors, trend, dimension widgets.
import React, { useState, useId } from 'react';
import { Area, AreaChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  C, alpha, fmt, hue, StatusBar, PackageIcon,
  passRateHealth, coverageHealth, findingsHealth, neutralHealth, entropyHealth,
  type HealthInfo,
} from '../shared.tsx';
import type { PackageInfo, FindingsCount, RawSummary } from '../derive.ts';
import { deriveTestingOverall, deriveTestingDimensions, deriveCoverageDimensions } from '../derive.ts';

// ─── Connector metadata ───────────────────────────────────────────────────────
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

// ─── Metric card ─────────────────────────────────────────────────────────────
function MetricCard({
  label, value, sub, health, bar, onClick,
}: {
  label: string;
  value: string;
  sub: string;
  health: HealthInfo;
  bar?: { passed: number; failed: number; broken: number; skipped: number; total: number };
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isInteractive = Boolean(onClick);

  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isInteractive ? e => (e.key === 'Enter' || e.key === ' ') && onClick?.() : undefined}
      onMouseEnter={isInteractive ? () => setHovered(true) : undefined}
      onMouseLeave={isInteractive ? () => setHovered(false) : undefined}
      style={{
        background: hovered ? C.surfaceHigh : C.surface,
        borderRadius: 12,
        border: `1px solid ${hovered ? alpha(health.accent, 40) : C.border}`,
        borderLeft: `4px solid ${health.accent}`,
        padding: '20px 20px 20px 18px',
        position: 'relative',
        overflow: 'hidden',
        cursor: isInteractive ? 'pointer' : 'default',
        transition: 'background 0.15s, border-color 0.15s',
        outline: 'none',
      }}
    >
      {/* Corner glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '60%', height: '100%',
        background: `linear-gradient(135deg, ${alpha(health.accent, 7)} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Label + status chip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
          {label}
        </div>
        {health.chip && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
            background: health.bg, color: health.accent,
            border: `1px solid ${alpha(health.accent, 27)}`,
            letterSpacing: '0.03em',
          }}>{health.chip}</span>
        )}
      </div>

      {/* Value */}
      <div style={{
        fontSize: 32, fontWeight: 800, color: health.text,
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

      {/* Interactive hint */}
      {isInteractive && (
        <div style={{
          position: 'absolute', bottom: 10, right: 12,
          fontSize: 11, color: C.dim, opacity: hovered ? 1 : 0,
          transition: 'opacity 0.15s',
        }}>view all ›</div>
      )}
    </div>
  );
}

// ─── Package map tiles ────────────────────────────────────────────────────────
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
        const health = p.passRate !== null ? passRateHealth(p.passRate) : neutralHealth;
        const isH    = hovered === p.name;
        const shortName = p.name.split('/').pop() ?? p.name;

        return (
          <div
            key={p.name}
            role="button"
            tabIndex={0}
            aria-label={`${p.name}: ${p.passRate !== null ? fmt(p.passRate) : 'no tests'} pass rate, ${fmt(p.coverage)} coverage. Click to drill in.`}
            onClick={() => onSelect(p.name)}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect(p.name)}
            onMouseEnter={() => setHovered(p.name)}
            onMouseLeave={() => setHovered(null)}
            style={{
              borderRadius: 10,
              background: isH ? C.surfaceHigh : health.bg,
              border: `1px solid ${isH ? health.accent : alpha(health.accent, 33)}`,
              borderTop: `3px solid ${health.accent}`,
              padding: '14px 14px 12px',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 5,
              transition: 'all 0.15s', outline: 'none',
              boxShadow: isH ? `0 4px 24px ${alpha(health.accent, 13)}, 0 0 0 1px ${alpha(health.accent, 20)}` : 'none',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Package type watermark */}
            <div style={{
              position: 'absolute', right: -10, top: -10,
              color: health.accent,
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
                background: `radial-gradient(ellipse at top left, ${alpha(health.accent, 6)} 0%, transparent 60%)`,
                pointerEvents: 'none',
              }} />
            )}

            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {shortName}
            </div>
            <div style={{ fontSize: 23, fontWeight: 800, color: health.text, lineHeight: 1, letterSpacing: '-0.02em' }}>
              {p.passRate !== null ? fmt(p.passRate) : '—'}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>
              {p.tests > 0 ? `${p.tests} tests` : 'no tests'}
            </div>
            {p.tests > 0 && (
              <StatusBar passed={p.passed} failed={p.failed} broken={p.broken} skipped={p.skipped} total={p.tests} height={4} />
            )}
            <div style={{ fontSize: 11, fontWeight: 600, color: p.passRate !== null ? health.text : C.muted, marginTop: 1 }}>
              {fmt(p.coverage)} cov
            </div>
            {p.entropy && (
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: entropyHealth(p.entropy.score).text,
              }}>
                &#8767; {p.entropy.score.toFixed(1)}
              </div>
            )}
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
  onSelectFindings: () => void;
}

export function Observatory({ summary, packages, onSelectPackage, onSelectDimension, onSelectFindings }: ObservatoryProps) {
  const { overall, byConnector, history, dimensions, connectors } = summary;
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const gradId = useId();

  const trend = history.slice(-20).map((h, i) => ({
    i,
    coverage:     h.coveragePassRate,
    total:        h.overall.total,
    entropy:      h.entropyScore,
  }));
  const hasCoverageTrend = trend.some(t => t.coverage !== undefined);
  const avgCoverage = byConnector['lcov']?.overall.passRate ?? 0;
  const testingOverall = deriveTestingOverall(summary);
  const testingDimensions = deriveTestingDimensions(summary);
  const coverageDimensions = deriveCoverageDimensions(summary);

  const allFindings: FindingsCount = packages.reduce(
    (acc, p) => ({ error: acc.error + p.findings.error, warning: acc.warning + p.findings.warning, info: acc.info + p.findings.info }),
    { error: 0, warning: 0, info: 0 }
  );

  const dimEntries = Object.entries(testingDimensions).filter(([k]) => !HIDDEN_FROM_DIM_PANELS.has(k));

  return (
    <div>
      {/* ── Metric cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        <MetricCard
          label="Pass Rate"
          value={fmt(testingOverall.passRate)}
          sub={`${testingOverall.passed.toLocaleString()} / ${testingOverall.total.toLocaleString()} tests`}
          health={passRateHealth(testingOverall.passRate)}
          bar={{ passed: testingOverall.passed, failed: testingOverall.failed, broken: testingOverall.broken, skipped: testingOverall.skipped, total: testingOverall.total }}
        />
        <MetricCard
          label="Coverage"
          value={fmt(avgCoverage)}
          sub={`${byConnector['lcov']?.overall.passed ?? 0} files covered`}
          health={coverageHealth(avgCoverage)}
        />
        {summary.entropy && (() => {
          const e = summary.entropy.overall;
          const health = entropyHealth(e.score);
          return (
            <MetricCard
              label="ENTROPY"
              value={e.score.toFixed(1)}
              sub={`${e.classification} · 5 subscores`}
              health={health}
            />
          );
        })()}
        <MetricCard
          label="Findings"
          value={String(allFindings.error + allFindings.warning)}
          sub={`${allFindings.error} errors · ${allFindings.warning} warnings · ${allFindings.info} info`}
          health={findingsHealth(allFindings)}
          onClick={onSelectFindings}
        />
        <MetricCard
          label="Packages"
          value={String(packages.length)}
          sub={`${connectors.length} connector${connectors.length !== 1 ? 's' : ''} active`}
          health={neutralHealth}
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
          {/* Trend sparklines */}
          {trend.length > 1 && (
            <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
                Trends
                <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginLeft: 8 }}>last {trend.length} runs</span>
              </div>

              {/* Test count sparkline */}
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Test count</div>
              <ResponsiveContainer width="100%" height={56}>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id={`${gradId}-count`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.accent} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={C.accent} stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="i" hide />
                  <YAxis hide domain={[0, 'auto']} />
                  <Area type="monotone" dataKey="total" stroke={C.accent} strokeWidth={2}
                    fill={`url(#${gradId}-count)`} dot={false} />
                  <Tooltip
                    contentStyle={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, fontSize: 11, borderRadius: 8 }}
                    formatter={(v: unknown) => [String(v), 'total records']}
                    labelFormatter={() => ''}
                  />
                </AreaChart>
              </ResponsiveContainer>

              {/* Coverage sparkline */}
              {hasCoverageTrend && (
                <>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, marginTop: 14 }}>Coverage</div>
                  <ResponsiveContainer width="100%" height={56}>
                    <AreaChart data={trend}>
                      <defs>
                        <linearGradient id={`${gradId}-cov`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={C.coverage} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={C.coverage} stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="i" hide />
                      <YAxis hide domain={[0, 'auto']} />
                      <Area type="monotone" dataKey="coverage" stroke={C.coverage} strokeWidth={2}
                        fill={`url(#${gradId}-cov)`} dot={false} connectNulls={false} />
                      <Tooltip
                        contentStyle={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, fontSize: 11, borderRadius: 8 }}
                        formatter={(v: unknown) => v !== undefined ? [fmt(v as number), 'coverage'] : []}
                        labelFormatter={() => ''}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </>
              )}

              {/* Entropy sparkline */}
              {trend.some(t => t.entropy !== undefined) && (
                <>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, marginTop: 14 }}>Entropy</div>
                  <ResponsiveContainer width="100%" height={56}>
                    <AreaChart data={trend}>
                      <defs>
                        <linearGradient id={`${gradId}-entropy`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={C.entropy} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={C.entropy} stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="i" hide />
                      <YAxis hide domain={[0, 'auto']} />
                      <Area type="monotone" dataKey="entropy" stroke={C.entropy} strokeWidth={2}
                        fill={`url(#${gradId}-entropy)`} dot={false} />
                      <Tooltip
                        contentStyle={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, fontSize: 11, borderRadius: 8 }}
                        formatter={(v: unknown) => v !== undefined ? [(v as number).toFixed(1), 'entropy'] : []}
                        labelFormatter={() => ''}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </>
              )}
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
                        color: catColor, background: alpha(catColor, 9), border: `1px solid ${alpha(catColor, 20)}`,
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
                display: 'grid', gridTemplateColumns: '10px 1fr 60px 52px 16px',
                gap: 8, alignItems: 'center', marginBottom: 4, paddingRight: 2,
              }}>
                <span />
                <span style={{ fontSize: 11, color: C.muted }}>value</span>
                <span style={{ fontSize: 11, color: C.muted, textAlign: 'right' }}>pass</span>
                <span style={{ fontSize: 11, color: C.muted, textAlign: 'right' }}>cov</span>
                <span />
              </div>

              {/* Rows */}
              {slices.map(s => {
                const { accent: dotColor } = passRateHealth(s.passRate);
                const rowKey = `${dim}:${s.value}`;
                const isActive = hoveredRow === rowKey;
                const covMap = coverageDimensions[dim];
                const covRate = covMap?.get(s.value);
                return (
                  <button
                    key={s.value}
                    onClick={() => onSelectDimension(dim, s.value)}
                    aria-label={`${dim}: ${s.value} — ${s.passed}/${s.total} tests passing${covRate !== undefined ? `, ${fmt(covRate)} coverage` : ''}. Click to view.`}
                    onMouseEnter={() => setHoveredRow(rowKey)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onFocus={() => setHoveredRow(rowKey)}
                    onBlur={() => setHoveredRow(null)}
                    style={{
                      display: 'grid', gridTemplateColumns: '10px 1fr 60px 52px 16px',
                      gap: 8, alignItems: 'center', width: '100%',
                      background: isActive ? C.surfaceHigh : 'none',
                      border: 'none',
                      outline: isActive ? `2px solid ${alpha(C.accent, 27)}` : 'none',
                      padding: '6px 4px 6px 0', borderRadius: 6,
                      cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
                    }}
                  >
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      display: 'inline-block', justifySelf: 'center',
                      background: dotColor,
                      boxShadow: `0 0 6px ${alpha(dotColor, 40)}`,
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
                      fontSize: 12, fontWeight: 700, textAlign: 'right',
                      color: dotColor, fontVariantNumeric: 'tabular-nums',
                    }}>{s.passed}/{s.total}</span>

                    <span style={{
                      fontSize: 12, textAlign: 'right',
                      color: covRate !== undefined ? C.coverage : C.dim,
                      fontVariantNumeric: 'tabular-nums',
                    }}>{covRate !== undefined ? fmt(covRate) : '—'}</span>

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
