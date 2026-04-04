import type { AggregatedSlice, OverallSummary } from '../aggregator/index.js';
import type { HistoryEntry } from './history.js';

export interface DashboardData {
  generatedAt: string;
  projectName?: string;
  connectors: string[];
  overall: OverallSummary;
  dimensions: Record<string, AggregatedSlice[]>;
  history: HistoryEntry[];
}
