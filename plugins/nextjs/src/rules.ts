import type { Rule } from '@spaguettiscope/core'

export const nextjsRules: Rule[] = [
  // ── Core routing files ────────────────────────────────────────────────────

  {
    id: 'nextjs:api-endpoint',
    selector: { path: 'app/api/($1)/**/route.ts' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'api-endpoint' },
      { kind: 'concrete', key: 'layer', value: 'bff' },
      { kind: 'extracted', key: 'domain', capture: 1 },
    ],
  },
  {
    // Broader catch-all for route handlers outside the api/ subtree.
    // The more specific nextjs:api-endpoint rule is listed first and will
    // take precedence for app/api/** paths when the runner groups by rule id.
    id: 'nextjs:route-handler',
    selector: { path: 'app/**/route.ts' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'route-handler' },
      { kind: 'concrete', key: 'layer', value: 'bff' },
    ],
  },
  {
    id: 'nextjs:page',
    selector: { path: 'app/($1)/**/page.tsx' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'page' },
      { kind: 'extracted', key: 'domain', capture: 1 },
    ],
  },
  {
    id: 'nextjs:layout',
    selector: { path: 'app/($1)/**/layout.tsx' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'layout' },
      { kind: 'extracted', key: 'domain', capture: 1 },
    ],
  },
  {
    // template.tsx re-renders on every navigation, unlike layout.tsx which
    // persists state. Marks files that intentionally reset state per nav.
    id: 'nextjs:template',
    selector: { path: 'app/**/template.tsx' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'template' },
      { kind: 'concrete', key: 'layer', value: 'routing' },
    ],
  },

  // ── Route lifecycle UI files ──────────────────────────────────────────────

  {
    // Shown as a Suspense fallback while a route segment and its children load.
    id: 'nextjs:loading-ui',
    selector: { path: 'app/**/loading.tsx' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'loading-ui' },
      { kind: 'concrete', key: 'layer', value: 'routing' },
    ],
  },
  {
    // Error boundary UI scoped to a route segment.
    id: 'nextjs:error-boundary',
    selector: { path: 'app/**/error.tsx' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'error-boundary' },
      { kind: 'concrete', key: 'layer', value: 'routing' },
    ],
  },
  {
    // Root-level error boundary that wraps the entire app, including the root layout.
    // Must be a Client Component because it replaces the root layout on error.
    id: 'nextjs:global-error',
    selector: { path: 'app/global-error.tsx' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'error-boundary' },
      { kind: 'concrete', key: 'layer', value: 'global' },
    ],
  },
  {
    // Rendered when notFound() is called or a URL has no matching segment.
    id: 'nextjs:not-found',
    selector: { path: 'app/**/not-found.tsx' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'not-found' },
      { kind: 'concrete', key: 'layer', value: 'routing' },
    ],
  },
  {
    // Rendered when the forbidden() function is called (Next.js 15+ auth conventions).
    id: 'nextjs:forbidden',
    selector: { path: 'app/**/forbidden.tsx' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'forbidden' },
      { kind: 'concrete', key: 'layer', value: 'routing' },
    ],
  },
  {
    // Rendered when the unauthorized() function is called (Next.js 15+ auth conventions).
    id: 'nextjs:unauthorized',
    selector: { path: 'app/**/unauthorized.tsx' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'unauthorized' },
      { kind: 'concrete', key: 'layer', value: 'routing' },
    ],
  },
  {
    // Fallback UI for parallel routes when a slot has no active match.
    id: 'nextjs:parallel-route-default',
    selector: { path: 'app/**/default.tsx' },
    yields: [
      { kind: 'concrete', key: 'role', value: 'parallel-route-default' },
      { kind: 'concrete', key: 'layer', value: 'routing' },
    ],
  },

  // ── Metadata files ────────────────────────────────────────────────────────

  {
    id: 'nextjs:opengraph-image',
    selector: { path: 'app/**/opengraph-image.tsx' },
    yields: [{ kind: 'concrete', key: 'role', value: 'og-image' }],
  },
  {
    id: 'nextjs:twitter-image',
    selector: { path: 'app/**/twitter-image.tsx' },
    yields: [{ kind: 'concrete', key: 'role', value: 'og-image' }],
  },
  {
    id: 'nextjs:sitemap',
    selector: { path: 'app/sitemap.ts' },
    yields: [{ kind: 'concrete', key: 'role', value: 'sitemap' }],
  },
  {
    id: 'nextjs:robots',
    selector: { path: 'app/robots.ts' },
    yields: [{ kind: 'concrete', key: 'role', value: 'robots' }],
  },
  {
    id: 'nextjs:manifest',
    selector: { path: 'app/manifest.ts' },
    yields: [{ kind: 'concrete', key: 'role', value: 'manifest' }],
  },
  {
    // app/icon.tsx or app/**/icon.tsx — generates favicon/icon via ImageResponse.
    id: 'nextjs:app-icon',
    selector: { path: 'app/**/icon.tsx' },
    yields: [{ kind: 'concrete', key: 'role', value: 'app-icon' }],
  },
  {
    id: 'nextjs:apple-icon',
    selector: { path: 'app/**/apple-icon.tsx' },
    yields: [{ kind: 'concrete', key: 'role', value: 'app-icon' }],
  },

  // ── Root-level special files ──────────────────────────────────────────────

  {
    id: 'nextjs:middleware',
    selector: { path: 'middleware.ts' },
    yields: [{ kind: 'concrete', key: 'role', value: 'middleware' }],
  },
  {
    // Server-side instrumentation hook (register() and onRequestError()).
    // Runs in the Node.js / Edge runtime before the app boots.
    id: 'nextjs:instrumentation',
    selector: { path: 'instrumentation.ts' },
    yields: [{ kind: 'concrete', key: 'role', value: 'instrumentation' }],
  },
  {
    // Client-side instrumentation — runs in the browser before hydration.
    id: 'nextjs:instrumentation-client',
    selector: { path: 'instrumentation-client.ts' },
    yields: [{ kind: 'concrete', key: 'role', value: 'instrumentation' }],
  },
  {
    // Required when using MDX with the @next/mdx package.
    id: 'nextjs:mdx-components',
    selector: { path: 'mdx-components.tsx' },
    yields: [{ kind: 'concrete', key: 'role', value: 'mdx-components' }],
  },

  // ── Rendering model ───────────────────────────────────────────────────────

  {
    id: 'nextjs:client-component',
    selector: {
      path: '**/*.tsx',
      content: "^['\"]use client['\"]",
    },
    yields: [{ kind: 'concrete', key: 'layer', value: 'client-component' }],
  },
  {
    id: 'nextjs:server-action',
    selector: {
      path: '**/*.ts',
      content: "^'use server'",
    },
    yields: [
      { kind: 'concrete', key: 'role', value: 'server-action' },
      { kind: 'concrete', key: 'layer', value: 'bff' },
    ],
  },
]
