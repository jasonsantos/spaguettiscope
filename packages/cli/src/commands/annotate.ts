import { resolve } from 'node:path'
import { loadConfig, readSkeleton, writeSkeleton, isDraft } from '@spaguettiscope/core'
import { printSuccess, printCommandHeader } from '../formatter/index.js'
import { annotateListGuidance, annotateResolveGuidance } from '../formatter/guidance.js'

export async function runAnnotateList(options: { projectRoot?: string } = {}): Promise<void> {
  printCommandHeader('annotate list')
  const projectRoot = options.projectRoot ?? process.cwd()
  const config = await loadConfig(projectRoot)
  const skeletonPath = resolve(projectRoot, config.skeleton)
  const skeleton = readSkeleton(skeletonPath)

  const pending = skeleton.entries.filter(
    e => isDraft(e) && Object.keys(e.attributes).some(k => k.endsWith('?'))
  )

  if (pending.length > 0) {
    console.log(`\n? entries requiring annotation (${pending.length}):\n`)
    for (let i = 0; i < pending.length; i++) {
      const entry = pending[i]
      const paths = entry.paths.join(', ')
      const src = (entry as any).source ? `  (${(entry as any).source})` : ''

      const proposedKeys = Object.keys(entry.attributes).filter(k => k.endsWith('?') && k !== '?')
      if (proposedKeys.length > 0) {
        const proposals = proposedKeys
          .map(k => `${k.slice(0, -1)} = "${entry.attributes[k]}"`)
          .join(', ')
        console.log(`  [${i + 1}] ${proposals}   ${paths}${src}`)
      } else {
        const value = entry.attributes['?']
        console.log(`  [${i + 1}] ? = "${value}"   ${paths}${src}`)
      }
    }
    console.log()
  }

  const pendingDimensions = [
    ...new Set(
      pending.flatMap(e =>
        Object.keys(e.attributes)
          .filter(k => k.endsWith('?'))
          .map(k => k.slice(0, -1))
      )
    ),
  ]
  console.log(
    annotateListGuidance({
      pendingCount: pending.length,
      dimensions: pendingDimensions,
    })
  )
}

export interface ResolveOptions {
  values: string[]
  all: boolean
  as: string
  add?: string
  projectRoot?: string
}

export async function runAnnotateResolve(options: ResolveOptions): Promise<void> {
  printCommandHeader('annotate resolve')
  // --as is required for bare ? resolution, but not for key? confirmation with --all
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
    if (!isDraft(entry)) return entry

    const proposedKeys = Object.keys(entry.attributes).filter(k => k.endsWith('?') && k !== '?')

    // Handle key? proposed entries: confirm only the targeted dimension
    if (proposedKeys.length > 0 && options.all) {
      const targetKey = options.as + '?'
      if (!proposedKeys.includes(targetKey)) return entry

      const newAttributes: Record<string, string> = {}
      for (const [k, v] of Object.entries(entry.attributes)) {
        if (k === targetKey) {
          newAttributes[options.as] = v // domain? → domain
        } else {
          newAttributes[k] = v // keep other keys as-is (including other key? entries)
        }
      }
      Object.assign(newAttributes, extraAttrs)
      resolved++

      // Stay draft if any key? attributes remain
      const stillHasProposed = Object.keys(newAttributes).some(k => k.endsWith('?') && k !== '?')
      if (stillHasProposed) {
        return { attributes: newAttributes, paths: entry.paths, draft: true, source: (entry as any).source }
      }
      return { attributes: newAttributes, paths: entry.paths, ...((entry as any).source ? { source: (entry as any).source } : {}) }
    }

    // Handle bare ? entries (existing behavior)
    if (!('?' in entry.attributes) || !options.as) return entry

    const uncertain = entry.attributes['?']
    const shouldResolve = options.all || options.values.includes(uncertain)
    if (!shouldResolve) return entry

    const newAttributes: Record<string, string> = { ...entry.attributes }
    delete newAttributes['?']
    newAttributes[options.as] = uncertain
    Object.assign(newAttributes, extraAttrs)

    resolved++
    return { attributes: newAttributes, paths: entry.paths }
  })

  writeSkeleton(skeletonPath, { ...skeleton, entries })
  printSuccess(`Resolved ${resolved} entr${resolved === 1 ? 'y' : 'ies'}`)

  const updatedSkeleton = readSkeleton(skeletonPath)
  const stillPending = updatedSkeleton.entries.filter(
    e => isDraft(e) && Object.keys(e.attributes).some(k => k.endsWith('?'))
  )
  const remainingDimensions = [
    ...new Set(
      stillPending.flatMap(e =>
        Object.keys(e.attributes)
          .filter(k => k.endsWith('?'))
          .map(k => k.slice(0, -1))
      )
    ),
  ]

  console.log(
    annotateResolveGuidance({
      resolved,
      remainingDimensions,
    })
  )
}
