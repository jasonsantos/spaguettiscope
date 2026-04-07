// FindingsView.tsx — flat list of all findings, grouped by severity with filter tabs.
import React, { useState } from 'react';
import { C, alpha } from '../shared.tsx';
import type { RawFinding } from '../derive.ts';

const SEVERITY_COLOR = { error: C.failed,  warning: C.warning, info: C.info    } as const;
const SEVERITY_BG    = { error: C.failedBg, warning: C.warningBg, info: C.infoBg } as const;
const SEVERITY_ICON  = { error: '✕', warning: '⚠', info: 'ℹ' } as const;

type Severity = 'error' | 'warning' | 'info';
type Filter   = 'all' | Severity;

function renderSubject(f: RawFinding): string {
  if (f.subject.type === 'file')  return f.subject.path ?? '';
  if (f.subject.type === 'edge')  return `${f.subject.from} → ${f.subject.to}`;
  if (f.subject.type === 'slice') {
    return Object.entries(f.subject.dimensions ?? {}).map(([k, v]) => `${k}: ${v}`).join(' · ');
  }
  return '';
}

interface FindingsViewProps {
  findings: RawFinding[];
}

export function FindingsView({ findings }: FindingsViewProps) {
  const [filter, setFilter] = useState<Filter>('all');

  const counts = {
    error:   findings.filter(f => f.severity === 'error').length,
    warning: findings.filter(f => f.severity === 'warning').length,
    info:    findings.filter(f => f.severity === 'info').length,
  };

  const visible = filter === 'all' ? findings : findings.filter(f => f.severity === filter);

  // Hero accent based on worst severity present
  const heroColor = counts.error > 0 ? C.failed : counts.warning > 0 ? C.warning : counts.info > 0 ? C.info : C.passed;
  const heroBg    = counts.error > 0 ? C.failedBg : counts.warning > 0 ? C.warningBg : counts.info > 0 ? C.infoBg : C.passedBg;

  return (
    <div>
      {/* ── Hero stats ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28,
        flexWrap: 'wrap', padding: '20px 24px', borderRadius: 14,
        background: C.surface, border: `1px solid ${C.border}`,
        borderLeft: `4px solid ${heroColor}`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, width: 120, height: 120,
          background: `radial-gradient(circle at top left, ${alpha(heroColor, 7)}, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <span style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>
          Findings
        </span>

        <div style={{ width: 1, height: 36, background: C.border, flexShrink: 0 }} />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {counts.error > 0 && (
            <span style={{
              fontSize: 13, padding: '4px 12px', borderRadius: 6,
              background: C.failedBg, color: C.failed, fontWeight: 700,
              border: `1px solid ${alpha(C.failed, 20)}`,
            }}>{counts.error} error{counts.error !== 1 ? 's' : ''}</span>
          )}
          {counts.warning > 0 && (
            <span style={{
              fontSize: 13, padding: '4px 12px', borderRadius: 6,
              background: C.warningBg, color: C.warning, fontWeight: 700,
              border: `1px solid ${alpha(C.warning, 20)}`,
            }}>{counts.warning} warning{counts.warning !== 1 ? 's' : ''}</span>
          )}
          {counts.info > 0 && (
            <span style={{
              fontSize: 13, padding: '4px 12px', borderRadius: 6,
              background: C.infoBg, color: C.info, fontWeight: 700,
              border: `1px solid ${alpha(C.info, 20)}`,
            }}>{counts.info} info</span>
          )}
          {findings.length === 0 && (
            <span style={{
              fontSize: 13, padding: '4px 12px', borderRadius: 6,
              background: C.passedBg, color: C.passed, fontWeight: 700,
              border: `1px solid ${alpha(C.passed, 20)}`,
            }}>✓ No findings</span>
          )}
        </div>

        {findings.length > 0 && (
          <span style={{
            marginLeft: 'auto', fontSize: 12, color: C.dim,
            background: heroBg, padding: '2px 10px', borderRadius: 99,
            border: `1px solid ${alpha(heroColor, 20)}`, fontWeight: 600,
          }}>{findings.length} total</span>
        )}
      </div>

      {/* ── Filter tabs ── */}
      {findings.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {(['all', 'error', 'warning', 'info'] as const).map(s => {
            const count = s === 'all' ? findings.length : counts[s];
            if (count === 0 && s !== 'all') return null;
            const isActive = filter === s;
            const col = s === 'all' ? C.accent : SEVERITY_COLOR[s];
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                aria-pressed={isActive}
                style={{
                  fontSize: 12, padding: '5px 14px', borderRadius: 6,
                  cursor: 'pointer', fontWeight: 600,
                  background: isActive ? alpha(col, 13) : C.surface,
                  color:      isActive ? col       : C.muted,
                  border:     `1px solid ${isActive ? col : C.border}`,
                  transition: 'all 0.12s',
                  textTransform: 'capitalize' as const,
                }}
              >
                {s === 'all' ? 'All' : s}
                <span style={{ opacity: 0.7, marginLeft: 5 }}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Findings list ── */}
      {visible.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 14, padding: '40px 0', textAlign: 'center' }}>
          No findings for the selected filter.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map((f, i) => {
            const sev = f.severity as Severity;
            const col = SEVERITY_COLOR[sev];
            const bg  = SEVERITY_BG[sev];
            const ico = SEVERITY_ICON[sev];
            const pkg = f.dimensions['package'];
            const sub = renderSubject(f);

            return (
              <div key={i} style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderLeft: `4px solid ${col}`,
                borderRadius: 10, padding: '14px 18px',
                display: 'flex', flexDirection: 'column', gap: 6,
                position: 'relative', overflow: 'hidden',
              }}>
                {/* Corner glow */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, width: 80, height: 80,
                  background: `radial-gradient(circle at top left, ${alpha(col, 6)}, transparent 70%)`,
                  pointerEvents: 'none',
                }} />

                {/* Badges row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4,
                    background: bg, color: col, fontWeight: 700,
                    border: `1px solid ${alpha(col, 20)}`, flexShrink: 0,
                  }}>{ico} {sev}</span>

                  <code style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4,
                    background: C.surfaceHigh, color: C.accent,
                    border: `1px solid ${C.border}`, fontFamily: 'monospace', flexShrink: 0,
                  }}>{f.ruleId}</code>

                  {pkg && (
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 4,
                      background: C.surfaceHigh, color: C.muted,
                      border: `1px solid ${C.border}`, flexShrink: 0,
                    }}>{pkg.split('/').pop() ?? pkg}</span>
                  )}
                </div>

                {/* Message */}
                <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                  {f.message}
                </div>

                {/* Subject path / edge */}
                {sub && (
                  <div style={{
                    fontFamily: 'monospace', fontSize: 11, color: C.dim,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{sub}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
