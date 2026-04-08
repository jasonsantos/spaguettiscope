import type { AggregatedSlice, ConnectorAggregation, OverallSummary } from '../aggregator/index.js'
import type { HistoryEntry } from './history.js'
import type { EntropyResult } from '@spaguettiscope/core'

export interface DashboardData {
  generatedAt: string
  projectName?: string
  projectRoot?: string
  connectors: string[]
  overall: OverallSummary
  dimensions: Record<string, AggregatedSlice[]>
  history: HistoryEntry[]
  byConnector: Record<string, ConnectorAggregation>
  entropy?: {
    overall: EntropyResult
    byPackage: Record<string, EntropyResult>
  }
}
