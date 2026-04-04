import React from 'react';
import type { AggregatedSlice } from '../types.ts';

interface LayerHealthProps {
  dimensions: Record<string, AggregatedSlice[]>;
}

export function LayerHealth({ dimensions }: LayerHealthProps) {
  return (
    <div className="layer-health">
      <p>Layer Health view loading…</p>
    </div>
  );
}
