import { resolve } from 'node:path'
import { loadConfig, readSkeleton, writeSkeleton, isDraft } from '@spaguettiscope/core'
import { printSuccess } from '../formatter/index.js'

export async function runAnnotateList(options: { projectRoot?: string } = {}): Promise<void> {
  const projectRoot = options.projectRoot ?? process.cwd()
  const config = await loadConfig(projectRoot)
  const skeletonPath = resolve(projectRoot, config.skeleton)
  const skeleton = readSkeleton(skeletonPath)

  const pending = skeleton.entries.filter(e => isDraft(e) && '?' in e.attributes)

  if (pending.length === 0) {
    console.log('No pending annotations. Skeleton is fully resolved.')
    return
  }

  console.log(`\n? entries requiring annotation (${pending.length}):\n`)
  for (let i = 0; i < pending.length; i++) {
    const entry = pending[i]
    const value = entry.attributes['?']
    const paths = entry.paths.join(', ')
    const src = (entry as any).source ? `  (${(entry as any).source})` : ''
    console.log(`  [${i + 1}] ? = "${value}"   ${paths}${src}`)
  }
  console.log()
}

export interface ResolveOptions {
  values: string[]
  all: boolean
  as: string
  add?: string
  projectRoot?: string
}

export async function runAnnotateResolve(options: ResolveOptions): Promise<void> {
  if (!options.as) {
    throw new Error('--as <dimension> is required for annotate resolve (e.g. --as domain)')
  }
  const projectRoot = options.projectRoot ?? process.cwd()
  const config = await loadConfig(projectRoot)
  const skeletonPath = resolve(projectRoot, config.skeleton)
  const skeleton = readSkeleton(skeletonPath)

  const extraAttrs: Record<string, string> = {}
  if (options.add) {
    for (const pair of options.add.split(',')) {
      const eqIdx = pair.indexOf('=')
      if (eqIdx === -1) continue
      const k = pair.slice(0, eqIdx).trim()
      const v = pair.slice(eqIdx + 1).trim()
      if (k && v) extraAttrs[k] = v
    }
  }

  let resolved = 0
  const entries = skeleton.entries.map(entry => {
    if (!isDraft(entry) || !('?' in entry.attributes)) return entry

    const uncertain = entry.attributes['?']
    const shouldResolve = options.all || options.values.includes(uncertain)
    if (!shouldResolve) return entry

    const newAttributes: Record<string, string> = { ...entry.attributes }
    delete newAttributes['?']
    newAttributes[options.as] = uncertain
    Object.assign(newAttributes, extraAttrs)

    resolved++
    // Remove draft flag — entry becomes resolved
    return { attributes: newAttributes, paths: entry.paths }
  })

  writeSkeleton(skeletonPath, { entries })
  printSuccess(`Resolved ${resolved} entr${resolved === 1 ? 'y' : 'ies'}`)
}
