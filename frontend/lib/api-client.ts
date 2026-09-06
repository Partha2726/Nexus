/**
 * Centralized, typed API client for NEXUS backend.
 * 
 * Strictly contract-driven: consumes only frozen endpoints and schemas.
 * Normalizes HTTP errors into structured ApiError instances.
 */

import {
  ChatRequest,
  ChatResponse,
  ConversationHistoryResponse,
  ErrorResponse,
  ImpactRequest,
  ImpactResponse,
  ListAuditEventsResponse,
  ListDecisionsResponse,
  ListProjectsResponse,
  ListProposalsResponse,
  ListRequirementsResponse,
  Project,
  ProjectCreateRequest,
  ProjectGraph,
  ProjectUpdateRequest,
  Proposal,
  ProposalApprovalResponse,
  ProposalRejectionResponse,
  RejectProposalRequest,
  Requirement,
} from './contracts';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly requestId?: string;

  constructor(statusCode: number, errorCode: string, message: string, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.requestId = requestId;
  }

  get isStaleVersion(): boolean {
    return this.statusCode === 409 || this.errorCode === 'STALE_VERSION';
  }

  get isUnauthorized(): boolean {
    return this.statusCode === 401 || this.errorCode === 'AUTH_REQUIRED';
  }

  get isForbidden(): boolean {
    return this.statusCode === 403 || this.errorCode === 'FORBIDDEN';
  }

  get isNotFound(): boolean {
    return this.statusCode === 404 || this.errorCode === 'NOT_FOUND';
  }
}

export class NexusApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
  }

  public setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  public getAuthToken(): string | null {
    return this.authToken;
  }

  private getHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.getHeaders(options.headers as Record<string, string>);

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (networkError: any) {
      throw new ApiError(
        0,
        'NETWORK_ERROR',
        `Unable to reach NEXUS backend service: ${networkError?.message || 'Network error'}`
      );
    }

    if (!response.ok) {
      let errorBody: ErrorResponse | null = null;
      try {
        errorBody = await response.json();
      } catch {
        // Non-JSON response
      }

      const errorCode = errorBody?.errorCode || `HTTP_${response.status}`;
      const message = errorBody?.message || response.statusText || 'An unexpected error occurred';
      const requestId = errorBody?.requestId;

      throw new ApiError(response.status, errorCode, message, requestId);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return (await response.json()) as T;
  }

  // -------------------------------------------------------------------------
  // Projects API (§1)
  // -------------------------------------------------------------------------

  public async listProjects(): Promise<ListProjectsResponse> {
    return this.request<ListProjectsResponse>('/api/projects');
  }

  public async getProject(projectId: string): Promise<Project> {
    return this.request<Project>(`/api/projects/${projectId}`);
  }

  public async createProject(payload: ProjectCreateRequest): Promise<Project> {
    return this.request<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateProject(projectId: string, payload: ProjectUpdateRequest): Promise<Project> {
    return this.request<Project>(`/api/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  public async deleteProject(projectId: string): Promise<void> {
    return this.request<void>(`/api/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  // -------------------------------------------------------------------------
  // Chat & Conversations API (§3)
  // -------------------------------------------------------------------------

  public async sendChatMessage(projectId: string, payload: ChatRequest): Promise<ChatResponse> {
    return this.request<ChatResponse>(`/api/projects/${projectId}/chat`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getConversationHistory(
    projectId: string,
    conversationId: string
  ): Promise<ConversationHistoryResponse> {
    return this.request<ConversationHistoryResponse>(
      `/api/projects/${projectId}/conversations/${conversationId}`
    );
  }

  // -------------------------------------------------------------------------
  // Proposals & Actions API (§10, §11) — actionId == proposalId
  // -------------------------------------------------------------------------

  public async listProposals(
    projectId: string,
    status?: string
  ): Promise<ListProposalsResponse> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<ListProposalsResponse>(`/api/projects/${projectId}/proposals${query}`);
  }

  public async getProposal(projectId: string, proposalId: string): Promise<Proposal> {
    return this.request<Proposal>(`/api/projects/${projectId}/proposals/${proposalId}`);
  }

  public async approveProposal(
    projectId: string,
    actionId: string
  ): Promise<ProposalApprovalResponse> {
    return this.request<ProposalApprovalResponse>(
      `/api/projects/${projectId}/actions/${actionId}/approve`,
      {
        method: 'POST',
      }
    );
  }

  public async rejectProposal(
    projectId: string,
    actionId: string,
    payload?: RejectProposalRequest
  ): Promise<ProposalRejectionResponse> {
    return this.request<ProposalRejectionResponse>(
      `/api/projects/${projectId}/actions/${actionId}/reject`,
      {
        method: 'POST',
        body: payload ? JSON.stringify(payload) : undefined,
      }
    );
  }

  // -------------------------------------------------------------------------
  // Requirements API (§4)
  // -------------------------------------------------------------------------

  public async listRequirements(
    projectId: string,
    filters?: { status?: string; priority?: string }
  ): Promise<ListRequirementsResponse> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<ListRequirementsResponse>(`/api/projects/${projectId}/requirements${qs}`);
  }

  public async getRequirement(projectId: string, requirementId: string): Promise<Requirement> {
    return this.request<Requirement>(`/api/projects/${projectId}/requirements/${requirementId}`);
  }

  // -------------------------------------------------------------------------
  // Decisions API (§6)
  // -------------------------------------------------------------------------

  public async listDecisions(projectId: string): Promise<ListDecisionsResponse> {
    return this.request<ListDecisionsResponse>(`/api/projects/${projectId}/decisions`);
  }

  // -------------------------------------------------------------------------
  // Audit Events API (§14)
  // -------------------------------------------------------------------------

  public async listAuditEvents(
    projectId: string,
    limit?: number
  ): Promise<ListAuditEventsResponse> {
    const query = limit ? `?limit=${limit}` : '';
    return this.request<ListAuditEventsResponse>(`/api/projects/${projectId}/audit${query}`);
  }

  // -------------------------------------------------------------------------
  // Knowledge Graph API (§12)
  // -------------------------------------------------------------------------

  public async getProjectGraph(projectId: string): Promise<ProjectGraph> {
    return this.request<ProjectGraph>(`/api/projects/${projectId}/graph`);
  }

  // -------------------------------------------------------------------------
  // Change Impact Analysis API (§13)
  // -------------------------------------------------------------------------

  public async analyzeImpact(
    projectId: string,
    payload: ImpactRequest
  ): Promise<ImpactResponse> {
    return this.request<ImpactResponse>(`/api/projects/${projectId}/impact-analysis`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export const apiClient = new NexusApiClient();
