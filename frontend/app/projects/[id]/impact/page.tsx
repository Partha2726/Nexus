'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ImpactView } from '../../../../components/impact/ImpactView';

export default function ProjectImpactPage() {
  const params = useParams();
  const projectId = params?.id as string;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <ImpactView projectId={projectId} />
    </div>
  );
}
