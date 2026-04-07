import type { ImportGraph } from './index.js'
import type { LayerPolicyEdge } from '../skeleton/types.js'

/**
 * Analyze import directions between first-level directories under `src/`
 * within a single package, and propose a layer policy.
 */
export function analyzeLayerDirections(
  graph: ImportGraph,
  pkgRel: string,
  files: string[]
): LayerPolicyEdge[] {
  const srcPrefix = pkgRel === '.' ? 'src/' : `${pkgRel}/src/`

  function getLayer(file: string): string | null {
    if (!file.startsWith(srcPrefix)) return null
    const rest = file.slice(srcPrefix.length)
    const slashIdx = rest.indexOf('/')
    if (slashIdx === -1) return null
    return rest.slice(0, slashIdx)
  }

  interface DirFlow {
    concrete: number
    typeOnly: number
  }

  const flows = new Map<string, DirFlow>()

  for (const file of files) {
    const fromDir = getLayer(file)
    if (!fromDir) continue

    const targets = graph.imports.get(file)
    if (!targets) continue

    const typeOnlyTargets = graph.typeOnlyImports.get(file)

    for (const target of targets) {
      const toDir = getLayer(target)
      if (!toDir || toDir === fromDir) continue

      const key = `${fromDir}\0${toDir}`
      const flow = flows.get(key) ?? { concrete: 0, typeOnly: 0 }

      if (typeOnlyTargets?.has(target)) {
        flow.typeOnly++
      } else {
        flow.concrete++
      }

      flows.set(key, flow)
    }
  }

  const edges: LayerPolicyEdge[] = []
  const processed = new Set<string>()

  for (const [key, flow] of flows) {
    const [fromDir, toDir] = key.split('\0')
    const pairKey = [fromDir, toDir].sort().join('\0')
    if (processed.has(pairKey)) continue
    processed.add(pairKey)

    const reverseKey = `${toDir}\0${fromDir}`
    const reverseFlow = flows.get(reverseKey) ?? { concrete: 0, typeOnly: 0 }

    const forwardTotal = flow.concrete + flow.typeOnly
    const reverseTotal = reverseFlow.concrete + reverseFlow.typeOnly
    const total = forwardTotal + reverseTotal

    if (total < 2) continue
    if (flow.concrete > 0 && reverseFlow.concrete > 0) continue

    if (forwardTotal > 0 && reverseFlow.concrete === 0) {
      if (flow.concrete > 0) {
        edges.push({ from: fromDir, to: toDir, kind: 'concrete' })
      } else {
        edges.push({ from: fromDir, to: toDir, kind: 'typeOnly' })
      }
      if (reverseFlow.typeOnly > 0) {
        edges.push({ from: toDir, to: fromDir, kind: 'typeOnly' })
      }
    }

    if (reverseTotal > 0 && flow.concrete === 0 && forwardTotal === 0) {
      if (reverseFlow.concrete > 0) {
        edges.push({ from: toDir, to: fromDir, kind: 'concrete' })
      } else {
        edges.push({ from: toDir, to: fromDir, kind: 'typeOnly' })
      }
    }
  }

  return edges
}
