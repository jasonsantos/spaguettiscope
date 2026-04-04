// Re-export the canonical DashboardData from the model layer.
// Vite bundles this relative import at build time.
export type { DashboardData } from '../../../../../model/dashboard.ts';
export type { AggregatedSlice, OverallSummary } from '../../../../../aggregator/index.ts';
export type { HistoryEntry } from '../../../../../model/history.ts';
