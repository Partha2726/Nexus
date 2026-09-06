/**
 * TypeScript contracts for NEXUS frontend.
 * 
 * Strictly mirrors the backend camelCase wire contract defined in:
 * - docs/api-contract.md
 * - docs/data-model.md
 * - ADR-021, ADR-022, ADR-023
 */

// ---------------------------------------------------------------------------
// Primitive Types & Enums
// ---------------------------------------------------------------------------

export type ActionClass =
  | 'READ'
  | 'PROPOSE'
  | 'LOW_IMPACT_WRITE'
  | 'HIGH_IMPACT_WRITE'
  | 'BULK_WRITE';

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export type RequirementType = 'functional' | 'non_functional';
export type RequirementPriority = 'must' | 'should' | 'may';
export type RequirementStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded';

export type ComponentStatus = 'proposed' | 'accepted' | 'rejected' | 'deprecated';
export type DecisionStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded';
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type TestType = 'unit' | 'integration' | 'security' | 'scenario';
export type TestStatus = 'proposed' | 'accepted' | 'rejected';

export type RiskCategory = 'technical' | 'security' | 'schedule' | 'operational' | 'compliance';
export type RiskLikelihood = 'low' | 'medium' | 'high';
export type RiskImpact = 'low' | 'medium' | 'high' | 'critical';
export type RiskStatus = 'open' | 'mitigated' | 'accepted' | 'closed';

export type SourceTargetType =
  | 'requirement'
  | 'component'
  | 'decision'
  | 'task'
  | 'test'
  | 'risk'
  | 'artifact';

export type RelationType =
  | 'IMPLEMENTS'
  | 'DECOMPOSES'
  | 'DEPENDS_ON'
  | 'GENERATES'
  | 'VALIDATES'
  | 'INFLUENCES'
  | 'AFFECTS'
  | 'MITIGATES'
  | 'CONFLICTS_WITH'
  | 'SUPERSEDES'
  | 'DOCUMENTED_BY';

// ---------------------------------------------------------------------------
// Core Domain Entities (Wire Format)
// ---------------------------------------------------------------------------

export interface Project {
  projectId: string;
  name: string;
  description: string;
  ownerUid: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Proposal {
  proposalId: string;
  projectId: string;
  runId: string;
  actionClass: ActionClass;
  entityType: string;
  entityPayload: Record<string, any>;
  affectedEntityIds: string[];
  confidence: 'low' | 'medium' | 'high';
  rationale: string | null;
  status: ProposalStatus;
  projectVersionAtCreation: number;
  createdAt: string;
}

export interface Requirement {
  requirementId: string;
  projectId: string;
  type: RequirementType;
  statement: string;
  rationale: string | null;
  priority: RequirementPriority;
  status: RequirementStatus;
  acceptanceCriteria: string[];
  sourceRefs: string[];
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Component {
  componentId: string;
  projectId: string;
  name: string;
  type: string;
  responsibilities: string[];
  interfaces: string[];
  technology: string | null;
  status: ComponentStatus;
  requirementRefs: string[];
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Decision {
  decisionId: string;
  projectId: string;
  title: string;
  context: string;
  decision: string;
  consequences: string[];
  status: DecisionStatus;
  componentRefs: string[];
  supersedesId: string | null;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Task {
  taskId: string;
  projectId: string;
  title: string;
  description: string | null;
  priority: RequirementPriority;
  status: TaskStatus;
  dependsOn: string[];
  requirementRefs: string[];
  componentRefs: string[];
  milestoneId: string | null;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TestCase {
  testId: string;
  projectId: string;
  type: TestType;
  title: string;
  procedure: string[];
  expectedResult: string;
  status: TestStatus;
  requirementRefs: string[];
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Risk {
  riskId: string;
  projectId: string;
  category: string;
  description: string;
  likelihood: RiskLikelihood;
  impact: RiskImpact;
  score: number;
  mitigationRefs: string[];
  status: RiskStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditEvent {
  eventId: string;
  projectId: string;
  actor: 'user' | 'system';
  actorUid: string | null;
  action: string;
  targetType: string;
  targetId: string;
  outcome: 'success' | 'failure';
  timestamp: string;
}

export interface ConversationMessage {
  messageId: string;
  conversationId: string;
  projectId: string;
  role: 'user' | 'assistant';
  content: string;
  proposalIds: string[];
  createdAt: string;
}

export interface Conversation {
  conversationId: string;
  projectId: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Graph & Impact Models (API Contract §12 & §13)
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  type: string;
  label: string;
  data: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  label: string;
}

export interface ProjectGraph {
  projectId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface AffectedEntity {
  entityType: string;
  entityId: string;
  relationPath: string[];
  label: string;
}

export interface ImpactRequest {
  entityType: string;
  entityId: string;
}

export interface ImpactResponse {
  projectId: string;
  changedEntityType: string;
  changedEntityId: string;
  affectedEntities: AffectedEntity[];
  explanation: string;
  runId: string;
}

// ---------------------------------------------------------------------------
// API Request / Response Payloads
// ---------------------------------------------------------------------------

export interface ProjectCreateRequest {
  name: string;
  description?: string;
}

export interface ProjectUpdateRequest {
  name?: string;
  description?: string;
}

export interface ListProjectsResponse {
  projects: Project[];
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
}

export interface ChatResponse {
  conversationId: string;
  messageId: string;
  response: string;
  agentType: string;
  proposals: Proposal[];
  unresolvedQuestions: string[];
  runId: string;
}

export interface ConversationHistoryResponse {
  conversationId: string;
  projectId: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ListProposalsResponse {
  proposals: Proposal[];
}

export interface ProposalApprovalResponse {
  proposalId: string;
  status: 'approved';
  entityType: string;
  entityId: string;
  projectVersion: number;
  auditEventId: string;
}

export interface RejectProposalRequest {
  reason?: string;
}

export interface ProposalRejectionResponse {
  proposalId: string;
  status: 'rejected';
  auditEventId: string;
}

export interface ListRequirementsResponse {
  requirements: Requirement[];
}

export interface ListDecisionsResponse {
  decisions: Decision[];
}

export interface ListAuditEventsResponse {
  events: AuditEvent[];
}

// ---------------------------------------------------------------------------
// Error Contract
// ---------------------------------------------------------------------------

export interface ErrorResponse {
  errorCode: string;
  message: string;
  requestId: string;
}
