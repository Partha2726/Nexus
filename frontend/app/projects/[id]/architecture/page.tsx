'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { GraphCanvas } from '../../../../components/graph/GraphCanvas';

export default function ArchitectureGraphPage() {
  const params = useParams();
  const projectId = params?.id as string;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Architecture & Knowledge Graph
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
          Live visual representation of all project components, specifications, and TraceLinks assembled at read time.
        </p>
      </div>

      <GraphCanvas projectId={projectId} />
    </div>
  );
}
