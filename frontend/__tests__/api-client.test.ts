/**
 * Unit tests for NexusApiClient.
 * 
 * Verifies contract conformity, camelCase serialization, header injection, and structured error normalization.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NexusApiClient, ApiError } from '../lib/api-client';

describe('NexusApiClient', () => {
  let client: NexusApiClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    client = new NexusApiClient('http://localhost:8000');
    client.setAuthToken('test-bearer-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends correct Authorization header and content-type', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ projects: [] }),
    });

    await client.listProjects();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/projects',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-bearer-token',
        }),
      })
    );
  });

  it('handles POST /api/projects with correct request body', async () => {
    const mockProject = {
      projectId: 'proj-1',
      name: 'Test Project',
      description: 'Test Desc',
      ownerUid: 'user-1',
      version: 1,
      createdAt: '2026-09-06T10:00:00Z',
      updatedAt: '2026-09-06T10:00:00Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockProject,
    });

    const result = await client.createProject({
      name: 'Test Project',
      description: 'Test Desc',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/projects',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Test Project', description: 'Test Desc' }),
      })
    );
    expect(result.projectId).toBe('proj-1');
    expect(result.version).toBe(1);
  });

  it('handles POST /api/projects/{projectId}/chat', async () => {
    const mockChatResponse = {
      conversationId: 'conv-123',
      messageId: 'msg-456',
      response: 'Requirements formulated',
      agentType: 'requirements',
      proposals: [],
      unresolvedQuestions: ['Question 1?'],
      runId: 'run-789',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockChatResponse,
    });

    const res = await client.sendChatMessage('proj-1', {
      message: 'Add auth requirement',
      conversationId: 'conv-123',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/projects/proj-1/chat',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ message: 'Add auth requirement', conversationId: 'conv-123' }),
      })
    );
    expect(res.conversationId).toBe('conv-123');
    expect(res.agentType).toBe('requirements');
    expect(res.unresolvedQuestions).toEqual(['Question 1?']);
  });

  it('handles POST /api/projects/{projectId}/actions/{actionId}/approve where actionId == proposalId', async () => {
    const mockApproval = {
      proposalId: 'prop-101',
      status: 'approved',
      entityType: 'requirement',
      entityId: 'req-1',
      projectVersion: 2,
      auditEventId: 'evt-1',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockApproval,
    });

    const res = await client.approveProposal('proj-1', 'prop-101');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/projects/proj-1/actions/prop-101/approve',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(res.status).toBe('approved');
    expect(res.projectVersion).toBe(2);
  });

  it('normalizes 409 STALE_VERSION errors into structured ApiError', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: async () => ({
        errorCode: 'STALE_VERSION',
        message: 'Proposal created at version 1, but current project version is 2',
        requestId: 'req-stale-1',
      }),
    });

    try {
      await client.approveProposal('proj-1', 'prop-stale');
      expect.fail('Should have thrown ApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(409);
      expect(err.errorCode).toBe('STALE_VERSION');
      expect(err.isStaleVersion).toBe(true);
      expect(err.requestId).toBe('req-stale-1');
    }
  });

  it('handles GET /api/projects/{projectId}/graph for Account 4 graph API', async () => {
    const mockGraph = {
      projectId: 'proj-1',
      nodes: [{ id: 'req-1', type: 'requirement', label: 'Req 1', data: {} }],
      edges: [{ id: 'tl-1', source: 'comp-1', target: 'req-1', relation: 'IMPLEMENTS', label: 'IMPLEMENTS' }],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockGraph,
    });

    const graph = await client.getProjectGraph('proj-1');
    expect(graph.nodes.length).toBe(1);
    expect(graph.edges[0].relation).toBe('IMPLEMENTS');
  });

  it('handles POST /api/projects/{projectId}/impact-analysis', async () => {
    const mockImpact = {
      projectId: 'proj-1',
      changedEntityType: 'requirement',
      changedEntityId: 'req-1',
      affectedEntities: [
        {
          entityType: 'component',
          entityId: 'comp-auth',
          relationPath: ['IMPLEMENTS'],
          label: 'Component comp-auth',
        },
      ],
      explanation: 'Comp auth directly implements req 1',
      runId: 'impact-run-1',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockImpact,
    });

    const impact = await client.analyzeImpact('proj-1', {
      entityType: 'requirement',
      entityId: 'req-1',
    });

    expect(impact.affectedEntities.length).toBe(1);
    expect(impact.affectedEntities[0].entityId).toBe('comp-auth');
    expect(impact.affectedEntities[0].relationPath).toEqual(['IMPLEMENTS']);
  });

  it('handles GET /api/projects/{projectId}/audit for audit events', async () => {
    const mockAuditResponse = {
      events: [
        {
          eventId: 'evt-101',
          projectId: 'proj-1',
          actor: 'user',
          actorUid: 'user-1',
          action: 'proposal.approved',
          targetType: 'requirement',
          targetId: 'req-1',
          outcome: 'success',
          timestamp: '2026-09-06T10:00:00Z',
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockAuditResponse,
    });

    const res = await client.listAuditEvents('proj-1', 50);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/projects/proj-1/audit?limit=50',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-bearer-token',
        }),
      })
    );
    expect(res.events.length).toBe(1);
    expect(res.events[0].eventId).toBe('evt-101');
    expect(res.events[0].action).toBe('proposal.approved');
  });

  it('handles network failure by throwing ApiError with NETWORK_ERROR code', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    try {
      await client.listProjects();
      expect.fail('Should have thrown ApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(0);
      expect(err.errorCode).toBe('NETWORK_ERROR');
    }
  });
});
