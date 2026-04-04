import { z } from 'zod';

const ConnectorConfigSchema = z.object({
  id: z.string(),
  resultsDir: z.string(),
}).passthrough();

const CustomDimensionSchema = z.object({
  dimension: z.string(),
  patterns: z.record(z.string(), z.array(z.string())),
});

const DimensionOverridesSchema = z.object({
  overrides: z.record(z.string(), z.record(z.string(), z.array(z.string()))).optional(),
  custom: z.array(CustomDimensionSchema).optional(),
}).optional();

export const SpascoConfigSchema = z.object({
  name: z.string().optional(),
  plugin: z.string().optional(),
  dimensions: DimensionOverridesSchema,
  dashboard: z.object({
    connectors: z.array(ConnectorConfigSchema).default([]),
    outputDir: z.string().default('./reports'),
    historyFile: z.string().default('./reports/.spaguetti-history.jsonl'),
  }).default({ connectors: [], outputDir: './reports', historyFile: './reports/.spaguetti-history.jsonl' }),
});

export type SpascoConfig = z.infer<typeof SpascoConfigSchema>;
export type ConnectorConfig = z.infer<typeof ConnectorConfigSchema>;
