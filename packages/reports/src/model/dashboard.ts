import type { AggregatedSlice, ConnectorAggregation, OverallSummary } from '../aggregator/index.js'
import type { HistoryEntry } from './history.js'

export interface DashboardData {
  generatedAt: string
  projectName?: string
  projectRoot?: string
  connectors: string[]
  overall: OverallSummary
  dimensions: Record<string, AggregatedSlice[]>
  history: HistoryEntry[]
  byConnector: Record<string, ConnectorAggregation>
}
