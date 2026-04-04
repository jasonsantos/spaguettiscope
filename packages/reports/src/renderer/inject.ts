import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DashboardData } from '../model/dashboard.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getRendererAssetsDir(): string {
  return join(__dirname, '../../dist/renderer/assets');
}

export function buildDashboardHtml(data: DashboardData): string {
  // In production, this reads from the pre-built Vite output in dist/renderer/
  // In development (no dist), falls back to a minimal HTML for debugging
  let template: string;

  try {
    template = readFileSync(
      join(__dirname, '../../dist/renderer/index.html'),
      'utf-8'
    );
  } catch {
    throw new Error(
      'Dashboard renderer not built. Run `pnpm build` in packages/reports first.'
    );
  }

  return template.replace(
    'window.__SPASCO_DATA__ = {};',
    `window.__SPASCO_DATA__ = ${JSON.stringify(data)};`
  );
}
