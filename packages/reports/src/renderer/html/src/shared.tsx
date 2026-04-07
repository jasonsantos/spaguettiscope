// shared.tsx — design tokens, helpers, and small shared React components.
import React from 'react';

// ─── Color tokens (CSS custom properties — theme defined in index.html) ───────
export const C = {
  bg:          'var(--c-bg)',
  well:        'var(--c-well)',
  surface:     'var(--c-surface)',
  surfaceHigh: 'var(--c-surface-hi)',
  border:      'var(--c-border)',
  borderLight: 'var(--c-border-lt)',
  text:        'var(--c-text)',
  muted:       'var(--c-muted)',
  dim:         'var(--c-dim)',
  accent:      'var(--c-accent)',
  passed:      'var(--c-passed)',
  passedBg:    'var(--c-passed-bg)',
  failed:      'var(--c-failed)',
  failedBg:    'var(--c-failed-bg)',
  skipped:     'var(--c-skipped)',
  broken:      'var(--c-broken)',
  warning:     'var(--c-warning)',
  warningBg:   'var(--c-warning-bg)',
  info:        'var(--c-info)',
  infoBg:      'var(--c-info-bg)',
  coverage:    'var(--c-coverage)',
} as const;

/** Alpha-blend a CSS custom property value. Uses color-mix() — modern browsers only. */
export const alpha = (colorVar: string, pct: number) =>
  `color-mix(in oklch, ${colorVar} ${pct}%, transparent)`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const fmt     = (n: number) => `${(n * 100).toFixed(1)}%`;
export const hue     = (r: number) => r >= 0.98 ? C.passed : r >= 0.85 ? C.warning : C.failed;
export const covColor = (c: number) => c >= 0.80 ? C.passed : c >= 0.60 ? C.warning : C.failed;
export const dur     = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
export const totalF  = (f: { error: number; warning: number; info: number }) => f.error + f.warning + f.info;

export const STATUS_DOT: Record<string, string> = {
  passed:  C.passed,
  failed:  C.failed,
  skipped: C.skipped,
  broken:  C.broken,
  unknown: C.dim,
};

// ─── Donut gauge ──────────────────────────────────────────────────────────────
export function Donut({
  value, size = 80, color, label, sub,
}: {
  value: number; size?: number; color: string; label?: string; sub?: string;
}) {
  const r    = size / 2 - 7;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(1, Math.max(0, value));
  const gap  = circ - dash;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={6} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6}
            strokeDasharray={`${dash} ${gap}`} strokeLinecap="round" />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: size * 0.2, fontWeight: 700, color,
        }}>{fmt(value)}</div>
      </div>
      {label && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{label}</div>}
      {sub   && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Stacked status bar ───────────────────────────────────────────────────────
export function StatusBar({
  passed, failed, broken = 0, skipped = 0, total, height = 6,
}: {
  passed: number; failed: number; broken?: number; skipped?: number; total: number; height?: number;
}) {
  if (!total) return null;
  const segs = [
    { v: passed,  c: C.passed  },
    { v: failed,  c: C.failed  },
    { v: broken,  c: C.broken  },
    { v: skipped, c: C.skipped },
  ].filter(s => s.v > 0);
  return (
    <div style={{
      display: 'flex', height, borderRadius: height / 2,
      overflow: 'hidden', background: C.border, width: '100%',
    }} role="img" aria-label={`${passed} passed, ${failed} failed`}>
      {segs.map((s, i) => (
        <div key={i} style={{ width: `${(s.v / total) * 100}%`, background: s.c, minWidth: s.v ? 2 : 0 }} />
      ))}
    </div>
  );
}

// ─── Findings badge ───────────────────────────────────────────────────────────
export function FindingsBadge({ f }: { f: { error: number; warning: number; info: number } }) {
  if (totalF(f) === 0)
    return (
      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4,
        background: C.passedBg, color: C.passed, fontWeight: 600 }}>
        clean
      </span>
    );
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {f.error   > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: C.failedBg,  color: C.failed,  fontWeight: 600 }}>{f.error} err</span>}
      {f.warning > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: C.warningBg, color: C.warning, fontWeight: 600 }}>{f.warning} warn</span>}
      {f.info    > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: C.infoBg,    color: C.info,    fontWeight: 600 }}>{f.info} info</span>}
    </span>
  );
}

// ─── Package type icons ───────────────────────────────────────────────────────
// Stroke-based SVGs, viewBox 0 0 24 24. Color and opacity set by the caller.
// Plugins contribute via ScanPlugin.packageType() → the type key routes here.
const _ICON_PATHS: Record<string, React.ReactNode> = {
  library: (
    <>
      <path d="M12 3L3 7.5V16.5L12 21L21 16.5V7.5L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="3,7.5 12,12 21,7.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="12" x2="12" y2="21" strokeLinecap="round" />
    </>
  ),
  webapp: (
    <>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <circle cx="6.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
      <line x1="7" y1="21" x2="17" y2="21" strokeLinecap="round" />
      <line x1="12" y1="18" x2="12" y2="21" strokeLinecap="round" />
    </>
  ),
  cli: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <polyline points="7,9.5 11.5,12.5 7,15.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="13.5" y1="15.5" x2="17" y2="15.5" strokeLinecap="round" />
    </>
  ),
  api: (
    <>
      <rect x="3" y="4"  width="18" height="4.5" rx="1" />
      <rect x="3" y="10" width="18" height="4.5" rx="1" />
      <rect x="3" y="16" width="18" height="4.5" rx="1" />
      <circle cx="7" cy="6.25"  r="0.8" fill="currentColor" stroke="none" />
      <circle cx="7" cy="12.25" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="7" cy="18.25" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v5c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
      <path d="M4 11v5c0 1.66 3.58 3 8 3s8-1.34 8-3v-5" />
    </>
  ),
  // Plugin-provided ────────────────────────────────────────────────────────────
  react: (
    <>
      <ellipse cx="12" cy="12" rx="2.2" ry="9.5" strokeLinecap="round" />
      <ellipse cx="12" cy="12" rx="2.2" ry="9.5" transform="rotate(60 12 12)" strokeLinecap="round" />
      <ellipse cx="12" cy="12" rx="2.2" ry="9.5" transform="rotate(-60 12 12)" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    </>
  ),
  nextjs: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M8.5 8V16.5L15.5 8V16.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  electron: (
    <>
      <ellipse cx="12" cy="12" rx="10" ry="3.5" />
      <ellipse cx="12" cy="12" rx="10" ry="3.5" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="3.5" transform="rotate(-60 12 12)" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="20.6" cy="9.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  storybook: (
    <>
      <rect x="4" y="2" width="13" height="20" rx="1.5" />
      <line x1="4" y1="16" x2="17" y2="16" strokeLinecap="round" />
      <path d="M9 7.5C9 6.7 9.6 6.2 10.5 6.2s2 .5 2 1.5-1 1.4-2 1.5-1.5.7-1.5 1.6.6 1.5 1.5 1.5 2-.6 2-1.5"
        strokeLinecap="round" />
    </>
  ),
  playwright: (
    <>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M7 4v14M17 4v14" strokeLinecap="round" />
      <path d="M7 11 C8 8.5 9.5 7 12 7 C14.5 7 16 8.5 17 11" strokeLinecap="round" fill="none" />
    </>
  ),
};
// Aliases
_ICON_PATHS['drizzle'] = _ICON_PATHS['database'];
_ICON_PATHS['prisma']  = _ICON_PATHS['database'];

export function PackageIcon({
  type = 'library', size = 44,
}: {
  type?: string; size?: number;
}) {
  const paths = _ICON_PATHS[type] ?? _ICON_PATHS['library'];
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {paths}
    </svg>
  );
}

// ─── Unified health / status helpers ─────────────────────────────────────────
// Single source of truth for pass-rate → color/chip mapping, used by all views.
export interface HealthInfo {
  /** Border, glow, and icon color */
  accent: string;
  /** Chip / overlay background */
  bg: string;
  /** Status chip label — empty string means no chip */
  chip: string;
  /** Large value text color (equals accent except for the neutral state) */
  text: string;
}

export const neutralHealth: HealthInfo = {
  accent: C.border, bg: 'transparent', chip: '', text: C.text,
};

export function passRateHealth(r: number): HealthInfo {
  if (r >= 1.0) return { accent: C.passed,  bg: C.passedBg,  chip: '✓ All passing',   text: C.passed  };
  if (r >= 0.9) return { accent: C.warning, bg: C.warningBg, chip: '⚠ Some failures', text: C.warning };
  return               { accent: C.failed,  bg: C.failedBg,  chip: '✕ Failures',      text: C.failed  };
}

export function coverageHealth(c: number): HealthInfo {
  if (c >= 0.8) return { accent: C.passed,  bg: C.passedBg,  chip: '✓ Good coverage', text: C.passed  };
  if (c >= 0.6) return { accent: C.warning, bg: C.warningBg, chip: '⚠ Low coverage',  text: C.warning };
  return               { accent: C.failed,  bg: C.failedBg,  chip: '✕ No coverage',   text: C.failed  };
}

export function findingsHealth(f: { error: number; warning: number; info: number }): HealthInfo {
  if (f.error   > 0) return { accent: C.failed,  bg: C.failedBg,  chip: '✕ Errors',   text: C.failed  };
  if (f.warning > 0) return { accent: C.warning, bg: C.warningBg, chip: '⚠ Warnings', text: C.warning };
  if (f.info    > 0) return { accent: C.info,    bg: C.infoBg,    chip: 'ℹ Info',      text: C.info    };
  return                    { accent: C.passed,  bg: C.passedBg,  chip: '✓ Clean',     text: C.passed  };
}

// ─── BDD step source renderer ─────────────────────────────────────────────────
export function BddSource({ text }: { text: string }) {
  const KW = ['Given', 'When', 'Then', 'And', 'But'];
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 2 }}>
      {text.split('\n').map((line, i) => {
        const trimmed = line.trimStart();
        const indent  = line.length - trimmed.length;
        const kw      = KW.find(k => trimmed.startsWith(k));
        return (
          <div key={i}>
            <span>{'\u00a0'.repeat(indent)}</span>
            {kw
              ? <>
                  <span style={{ color: C.accent, fontWeight: 700 }}>{kw}</span>
                  <span style={{ color: C.text }}>{trimmed.slice(kw.length)}</span>
                </>
              : <span style={{ color: C.text }}>{trimmed}</span>}
          </div>
        );
      })}
    </div>
  );
}
