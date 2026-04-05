import type { Rule } from '@spaguettiscope/core'

export const reactRules: Rule[] = [
  // ── Hooks ─────────────────────────────────────────────────────────────────

  {
    id: 'react:hook',
    selector: { path: '**/use[A-Z]*.ts' },
    yields: [{ kind: 'concrete', key: 'role', value: 'hook' }],
  },
  {
    id: 'react:hook-tsx',
    selector: { path: '**/use[A-Z]*.tsx' },
    yields: [{ kind: 'concrete', key: 'role', value: 'hook' }],
  },

  // ── Contexts ───────────────────────────────────────────────────────────────

  {
    id: 'react:context-ts',
    selector: {
      path: '**/*.ts',
      content: 'createContext\\(',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'context' },
      { kind: 'concrete', key: 'layer', value: 'ui' },
    ],
  },
  {
    id: 'react:context-tsx',
    selector: {
      path: '**/*.tsx',
      content: 'createContext\\(',
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'context' },
      { kind: 'concrete', key: 'layer', value: 'ui' },
    ],
  },

  // ── Providers ──────────────────────────────────────────────────────────────
  //
  // Provider components wrap children with context or external state. They are
  // distinct from context definitions: a context file holds the createContext()
  // call and its type, while a provider file renders <Context.Provider value=…>
  // (or wraps a third-party Provider such as QueryClientProvider).
  //
  // The filename suffix *Provider.tsx is the most assertive signal — confirmed
  // in both real-world projects (QueryProvider, BasketValidationProvider,
  // PWAProvider, OrganizacaoContextProvider). Files that match createContext()
  // are already handled by react:context-tsx and will receive role:context;
  // standalone provider wrapper files (e.g. query-provider.tsx) should get
  // role:provider.

  {
    id: 'react:provider',
    selector: { path: '**/*Provider.tsx' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'provider' },
      { kind: 'concrete', key: 'layer', value: 'ui' },
    ],
  },

  // ── Higher-Order Components ────────────────────────────────────────────────
  //
  // HOCs follow the with[A-Z] prefix convention (withAuth, withTheme, etc.) by
  // long-standing community agreement. Both .ts and .tsx are valid: .ts when
  // the HOC wraps and returns a component type without any JSX in the HOC
  // itself; .tsx when JSX appears in the wrapper.

  {
    id: 'react:hoc',
    selector: { path: '**/with[A-Z]*.ts' },
    yields: [{ kind: 'concrete', key: 'role', value: 'hoc' }],
  },
  {
    id: 'react:hoc-tsx',
    selector: { path: '**/with[A-Z]*.tsx' },
    yields: [{ kind: 'concrete', key: 'role', value: 'hoc' }],
  },

  // ── Error Boundaries ──────────────────────────────────────────────────────
  //
  // React error boundaries must be class components implementing
  // componentDidCatch or getDerivedStateFromError. These are distinct from the
  // Next.js error.tsx convention (which the nextjs plugin handles via path).
  // Content matching on componentDidCatch( is precise: only class-based error
  // boundary implementations contain this method.

  {
    id: 'react:error-boundary-ts',
    selector: {
      path: '**/*.ts',
      content: 'componentDidCatch\\(',
    },
    yields: [{ kind: 'concrete', key: 'role', value: 'error-boundary' }],
  },
  {
    id: 'react:error-boundary-tsx',
    selector: {
      path: '**/*.tsx',
      content: 'componentDidCatch\\(',
    },
    yields: [{ kind: 'concrete', key: 'role', value: 'error-boundary' }],
  },
]
