import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DashboardData } from '../model/dashboard.js'
import type { NormalizedRunRecord } from '../model/normalized.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function getRendererAssetsDir(): string {
  return join(__dirname, '../../dist/renderer/assets')
}

export function buildDashboardHtml(): string {
  try {
    return readFileSync(join(__dirname, '../../dist/renderer/index.html'), 'utf-8')
  } catch {
    throw new Error('Dashboard renderer not built. Run `pnpm build` in packages/reports first.')
  }
}

export function writeDashboardData(
  outputDir: string,
  data: DashboardData,
  records: NormalizedRunRecord[]
): void {
  const dataDir = join(outputDir, 'data')
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(join(dataDir, 'summary.json'), JSON.stringify(data), 'utf-8')
  writeFileSync(join(dataDir, 'records.json'), JSON.stringify(records), 'utf-8')
}
