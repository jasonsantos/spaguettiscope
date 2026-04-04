import type { InferenceEngine, ConnectorConfig } from '@spaguettiscope/core';
import type { NormalizedRunRecord } from '../model/normalized.js';

export type ConnectorCategory = 'testing' | 'coverage' | 'lint'

export interface Connector {
  /** Unique identifier matching the `id` in SpascoConfig.dashboard.connectors */
  readonly id: string;
  /** Display category — controls label in Overview ("passing" / "covered" / "clean") */
  readonly category: ConnectorCategory;
  /**
   * Read source files, normalize to NormalizedRunRecord[], and tag with dimensions.
   * @param config - The connector config entry from spaguettiscope.config.json
   * @param engine - InferenceEngine for assigning dimensions to test file paths
   */
  read(config: ConnectorConfig, engine: InferenceEngine): Promise<NormalizedRunRecord[]>;
}
