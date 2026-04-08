# @spaguettiscope/plugin-nextjs

Next.js scan and analysis plugin for SpaguettiScope.

Classifies Next.js files (pages, layouts, server actions, route handlers) into topology dimensions
and enforces architectural boundaries (no client-imports-server, no cross-domain pages, BFF layer
boundaries).

```json
{
  "plugins": ["@spaguettiscope/plugin-nextjs"],
  "analysisPlugins": ["@spaguettiscope/plugin-nextjs/analysis"]
}
```

See the [main repository](https://github.com/jasonsantos/spaguettiscope) for full documentation.
