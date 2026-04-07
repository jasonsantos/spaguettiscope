// SuiteTree.tsx — expandable suite + test tree, shared by PackageView and DimensionView.
import React, { useState } from 'react';
import { C, alpha, fmt, dur, STATUS_DOT, BddSource, coverageHealth } from '../shared.tsx';
import type { SuiteInfo } from '../derive.ts';

interface SuiteTreeProps {
  suites: SuiteInfo[];
  /** Highlight a specific dimension tag on every suite card */
  activeDim?: { dim: string; val: string };
  pageSize?: number;
}

export function SuiteTree({ suites, activeDim, pageSize = 10 }: SuiteTreeProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState<string | null>(null);
  const [page, setPage]         = useState(0);

  const pages   = Math.max(1, Math.ceil(suites.length / pageSize));
  const visible = suites.slice(page * pageSize, (page + 1) * pageSize);

  function goToPage(p: number) {
    setPage(p);
    setExpanded(null);
    setTestOpen(null);
  }

  return (
    <div>
      {visible.map(suite => {
        const open    = expanded === suite.file;
        const passed  = suite.tests.filter(t => t.status === 'passed').length;
        const failed  = suite.tests.filter(t => t.status === 'failed').length;
        const sRate   = suite.tests.length > 0 ? passed / suite.tests.length : 1;

        const dimTags: Array<{ key: string; val: string }> = [
          { key: 'role',   val: suite.role   },
          { key: 'domain', val: suite.domain },
          { key: 'layer',  val: suite.layer  },
        ].filter(d => d.val && d.val !== 'unknown');

        const accentColor = failed > 0 ? C.failed : C.passed;

        return (
          <div key={suite.file} style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderLeft: `4px solid ${accentColor}`,
            borderRadius: 12, marginBottom: 10, overflow: 'hidden',
            transition: 'box-shadow 0.15s',
          }}>
            {/* Suite header — full-width button */}
            <button
              onClick={() => { setExpanded(open ? null : suite.file); setTestOpen(null); }}
              aria-expanded={open}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px 13px 14px',
                cursor: 'pointer', width: '100%', background: open ? C.surfaceHigh : 'transparent',
                border: 'none', textAlign: 'left', transition: 'background 0.12s', color: C.text,
              }}
            >
              {/* Expand chevron */}
              <span style={{
                color: C.muted, fontSize: 10, width: 14, flexShrink: 0,
                display: 'inline-block', textAlign: 'center',
                transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s',
              }}>▶</span>

              {/* Status dot — removed in favour of left border, keep for screen readers */}
              <span style={{ display: 'none' }} aria-hidden="true" />

              {/* Suite name */}
              <span style={{
                fontSize: 14, fontWeight: 600, flex: 1, overflow: 'hidden',
                whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              }}>{suite.name}</span>

              {/* Dimension tags */}
              {dimTags.map(({ key, val }) => {
                const isActive = activeDim?.dim === key && activeDim?.val === val;
                return (
                  <span key={key} style={{
                    fontSize: 11, padding: '2px 7px', borderRadius: 4, flexShrink: 0,
                    background: isActive ? alpha(C.accent, 13) : C.border,
                    color:      isActive ? C.accent       : C.muted,
                    border:     isActive ? `1px solid ${alpha(C.accent, 27)}` : '1px solid transparent',
                    fontWeight: isActive ? 700 : 400,
                  }}>{val}</span>
                );
              })}

              {/* Passing count */}
              <span style={{
                fontSize: 12, flexShrink: 0, fontVariantNumeric: 'tabular-nums',
                color: failed > 0 ? C.failed : C.passed, fontWeight: 600,
              }}>
                {passed}/{suite.tests.length}
              </span>

              {/* Coverage */}
              {suite.coverage !== null && (() => {
                const ch = coverageHealth(suite.coverage);
                return (
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 4, flexShrink: 0,
                    fontWeight: 600,
                    background: ch.bg,
                    color:      ch.accent,
                    border:     `1px solid ${alpha(ch.accent, 20)}`,
                  }}>{fmt(suite.coverage)}</span>
                );
              })()}
            </button>

            {/* Suite body */}
            {open && (
              <div style={{ padding: '4px 18px 14px', borderTop: `1px solid ${C.border}` }}>
                <div style={{
                  fontFamily: 'monospace', fontSize: 12, color: C.muted,
                  padding: '8px 0 12px', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{suite.file}</div>

                {suite.tests.map(test => {
                  const key       = test.id;
                  const tOpen     = testOpen === key;
                  const hasDetail = Boolean(test.bddSource || test.errorMessage);

                  return (
                    <div key={key}>
                      <button
                        onClick={() => hasDetail && setTestOpen(tOpen ? null : key)}
                        aria-expanded={hasDetail ? tOpen : undefined}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '7px 10px', borderRadius: 8,
                          cursor: hasDetail ? 'pointer' : 'default',
                          width: '100%', border: 'none', textAlign: 'left',
                          background: tOpen ? C.surfaceHigh : 'transparent',
                          color: C.text, transition: 'background 0.1s',
                        }}
                      >
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                          background: STATUS_DOT[test.status] ?? C.muted,
                        }} />
                        <span style={{
                          flex: 1, fontSize: 13,
                          color: test.status === 'failed' ? C.failed : C.text,
                        }}>{test.name}</span>

                        <span style={{
                          fontSize: 11, padding: '1px 6px', borderRadius: 4,
                          background: C.border, color: C.muted, flexShrink: 0,
                        }}>{test.connectorId}</span>

                        {hasDetail && (
                          <span style={{ fontSize: 10, color: C.dim, flexShrink: 0 }} aria-hidden="true">
                            {tOpen ? '▲' : '▼'}
                          </span>
                        )}

                        <span style={{
                          fontSize: 12, color: C.muted, fontFamily: 'monospace',
                          flexShrink: 0, width: 50, textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}>{dur(test.duration)}</span>
                      </button>

                      {/* Test detail panel */}
                      {tOpen && (
                        <div style={{
                          margin: '4px 10px 8px', background: C.well,
                          borderRadius: 8, padding: 16, border: `1px solid ${C.borderLight}`,
                        }}>
                          {test.bddSource && (
                            <div>
                              <div style={{
                                fontSize: 11, color: C.muted, textTransform: 'uppercase',
                                letterSpacing: '0.06em', marginBottom: 10,
                              }}>BDD Scenario</div>
                              <BddSource text={test.bddSource} />
                            </div>
                          )}
                          {test.errorMessage && (
                            <div style={{ marginTop: test.bddSource ? 16 : 0 }}>
                              <div style={{
                                fontSize: 11, color: C.failed, textTransform: 'uppercase',
                                letterSpacing: '0.06em', marginBottom: 10,
                              }}>Error</div>
                              <pre style={{
                                fontFamily: 'monospace', fontSize: 12, color: C.failed,
                                background: alpha(C.failedBg, 53), borderRadius: 6,
                                padding: 12, margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6,
                              }}>{test.errorMessage}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Pagination */}
      {pages > 1 && (
        <nav aria-label="Suite pages" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginTop: 20, justifyContent: 'center',
        }}>
          <button onClick={() => goToPage(page - 1)} disabled={page === 0}
            style={{
              padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border}`,
              background: page === 0 ? C.surface : C.surfaceHigh,
              color: page === 0 ? C.muted : C.text,
              cursor: page === 0 ? 'default' : 'pointer', fontSize: 13,
            }}>← Prev</button>

          {Array.from({ length: pages }, (_, i) => (
            <button key={i} onClick={() => goToPage(i)}
              aria-current={i === page ? 'page' : undefined}
              style={{
                width: 32, height: 32, borderRadius: 6,
                border: `1px solid ${i === page ? C.accent : C.border}`,
                background: i === page ? alpha(C.accent, 13) : 'none',
                color: i === page ? C.accent : C.muted,
                fontWeight: i === page ? 700 : 400, cursor: 'pointer', fontSize: 13,
              }}>{i + 1}</button>
          ))}

          <button onClick={() => goToPage(page + 1)} disabled={page === pages - 1}
            style={{
              padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border}`,
              background: page === pages - 1 ? C.surface : C.surfaceHigh,
              color: page === pages - 1 ? C.muted : C.text,
              cursor: page === pages - 1 ? 'default' : 'pointer', fontSize: 13,
            }}>Next →</button>
        </nav>
      )}
    </div>
  );
}
