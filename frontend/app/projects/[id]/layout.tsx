'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Project } from '../../../lib/contracts';
import { apiClient, ApiError } from '../../../lib/api-client';
import { Navbar, Sidebar } from '../../../components/dashboard/Navigation';
import { ErrorAlert, LoadingSpinner } from '../../../components/ui';

export default function ProjectWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const projectId = params?.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchProject = async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.getProject(projectId);
      setProject(data);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError(0, 'FETCH_PROJECT_ERROR', err?.message || 'Failed to load project'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar project={project} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar projectId={projectId} />

        <main style={{ flex: 1, padding: 24, overflowY: 'auto', background: 'var(--bg-primary)' }}>
          {error && (
            <div style={{ maxWidth: 800, margin: '0 auto 20px auto' }}>
              <ErrorAlert
                title="Project Access Error"
                message={error.message}
                errorCode={error.errorCode}
                requestId={error.requestId}
                onRetry={fetchProject}
              />
            </div>
          )}

          {isLoading ? (
            <LoadingSpinner size="lg" label="Loading project workspace..." />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
