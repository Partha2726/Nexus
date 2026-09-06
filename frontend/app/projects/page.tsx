'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Project } from '../../lib/contracts';
import { apiClient, ApiError } from '../../lib/api-client';
import { EmptyState, ErrorAlert, LoadingSpinner, Modal } from '../../components/ui';
import { Navbar } from '../../components/dashboard/Navigation';

export default function ProjectsListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  // New Project Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<ApiError | null>(null);

  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.listProjects();
      setProjects(response.projects || []);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError(0, 'LIST_PROJECTS_ERROR', err?.message || 'Failed to list projects'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setCreateError(null);
    try {
      const newProj = await apiClient.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setIsModalOpen(false);
      setName('');
      setDescription('');
      setProjects((prev) => [newProj, ...prev]);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setCreateError(err);
      } else {
        setCreateError(new ApiError(0, 'CREATE_PROJECT_ERROR', err?.message || 'Failed to create project'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main className="container" style={{ padding: '40px 24px', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
              Engineering Workspaces
            </h1>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              Select an existing workspace or initialize a new deterministic software project.
            </p>
          </div>

          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            + New Project
          </button>
        </div>

        {error && (
          <ErrorAlert
            title="Projects Error"
            message={error.message}
            errorCode={error.errorCode}
            requestId={error.requestId}
            onRetry={fetchProjects}
          />
        )}

        {isLoading ? (
          <LoadingSpinner size="lg" label="Loading engineering projects..." />
        ) : projects.length === 0 ? (
          <EmptyState
            icon="📁"
            title="No Projects Found"
            description="Create your first engineering project workspace to start collaborating with AI specialist agents."
            action={
              <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                + Create Project
              </button>
            }
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
            {projects.map((proj) => (
              <Link
                key={proj.projectId}
                href={`/projects/${proj.projectId}`}
                style={{ textDecoration: 'none' }}
              >
                <div
                  className="card card-hover"
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {proj.name}
                      </h2>
                      <span className="badge badge-blue">v{proj.version}</span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, minHeight: 42 }}>
                      {proj.description || 'No description provided.'}
                    </p>
                  </div>

                  <div
                    style={{
                      borderTop: '1px solid var(--border-color)',
                      paddingTop: 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span>ID: {proj.projectId.slice(0, 8)}...</span>
                    <span>Updated {new Date(proj.updatedAt || proj.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Create Project Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Initialize Engineering Project"
        >
          <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {createError && (
              <ErrorAlert
                message={createError.message}
                errorCode={createError.errorCode}
                requestId={createError.requestId}
              />
            )}

            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                Project Name *
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Core Banking Platform, Auth Microservice..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                Description
              </label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="High-level architectural goals and scope..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!name.trim() || isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Initialize Project ➔'}
              </button>
            </div>
          </form>
        </Modal>
      </main>
    </div>
  );
}
