# NEXUS Canonical API Contract — Phase 0

**Status:** Phase 0 integration contract  
**Authority:** SRS v1.0 Appendix C + Implementation Plan v2.0 §9, §11, §13, §14  
**Owner:** Human Integration Owner  
**Last updated:** 2026-09-05

> This document is the canonical API reference for all five development accounts.
> Field names and route paths are authoritative for code generation and frontend integration.
> Any change after Gate 0.5 requires a written entry in `docs/decision-log.md` and human
> integration owner approval (implementation plan §9.6).

---

## 0. Global Conventions

### 0.1 Base URL and Transport

All API calls are made over HTTPS to the FastAPI/Cloud Run backend. No privileged operations are handled by Next.js server routes or any other backend.

```
Base URL: https://<cloud-run-service-url>
Protocol: HTTPS only
```

### 0.2 Authentication

Every endpoint (except health checks) requires a valid Firebase ID token supplied as a Bearer token in the `Authorization` header.

```
Authorization: Bearer <Firebase ID token>
```

The backend verifies this token using the Firebase Admin SDK and derives the authenticated UID from the verified token claims. **The client must never supply a UID in the request body; any client-supplied UID field is ignored.** The UID always comes from the verified token.

### 0.3 Standard Error Response

All error responses use the following envelope (implementation plan §9.3, frozen):

```json
{
  "error_code": "<machine-readable code>",
  "message": "<safe, user-facing description — never raw exception text or secrets>",
  "request_id": "<uuid>"
}
```

Common error codes:

| HTTP status | `error_code` | Meaning |
|---|---|---|
| 401 | `AUTH_REQUIRED` | Missing or invalid Firebase ID token |
| 403 | `FORBIDDEN` | Authenticated but not authorized for this resource |
| 404 | `NOT_FOUND` | Resource does not exist or is not visible to this user |
| 409 | `STALE_VERSION` | Proposal's `project_version_at_creation` does not match current `project.version` |
| 422 | `VALIDATION_ERROR` | Request body failed schema validation |
| 500 | `INTERNAL_ERROR` | Server-side failure; no project state was modified |
| 503 | `AI_UNAVAILABLE` | Gemini call failed; no proposal was created; project state unchanged |

### 0.4 Request Correlation

Every backend request generates a `request_id` (UUID). This ID appears in:
- All error responses (`ErrorResponse.request_id`)
- Structured logs (`AgentRun.request_id`, NFR-010)
- Response headers where applicable

### 0.5 Ownership Notation

Each endpoint entry notes which development account owns the implementation. No two accounts share write ownership of an endpoint's implementation file.

### 0.6 Implementation Priority Classification

Every endpoint in this contract is tagged with an implementation priority:
- **P0 — Vertical Slice (6 endpoints)**: Core end-to-end user journey required for Phase 0 demonstration (Project Creation, Persistent Multi-turn Chat, Requirements Proposals, Proposal List, Approval/Rejection Transaction, Authoritative Requirements View).
- **P0 — Supporting (24 endpoints)**: Additional P0 domain endpoints, direct agent triggers, graph assembly, impact analysis, decision CRUD, audit logs, and temporary connectivity diagnostics that complete the Phase 0 platform.
- **Later (1 endpoint)**: Deferred endpoints stubbed or scheduled for P1/P2 (e.g., Review Agent 501 stub `POST /api/projects/{projectId}/review`, artifact upload, manual trace link editing).

| Priority Tier | Endpoint Count | Key Purpose |
|---|---|---|
| **P0 — Vertical Slice** | **6** | Core slice: Project CRUD, Chat, Requirements view, Proposal list, Approve/Reject |
| **P0 — Supporting** | **24** | Platform support: Project/Decision CRUD, History, Architecture/Tasks/Tests/Risks/Graph/Impact/Audit, Direct triggers, Smoke test |
| **Later (P1/P2)** | **1** | Review Agent stub (`POST /api/projects/{projectId}/review`, returns 501) |
| **Total Documented** | **31** | Complete contract inventory across all phases |

### 0.7 State Distinction

Endpoints are tagged with:
- **READ** — returns authoritative or proposal state, no mutation
- **PROPOSE** — creates a Proposal; no entity is mutated
- **MUTATE** — modifies authoritative state (only via the approval transaction)
- **ADMIN** — project-level CRUD not mediated by the proposal workflow

### 0.8 Wire Format and Casing Convention

- **Over-the-wire JSON payloads:** All request and response JSON keys use `camelCase` (e.g. `projectId`, `ownerUid`, `proposalId`, `createdAt`, `entityPayload`).
- **Backend implementation:** Python models in `backend/domain/models/` use `snake_case` field names with Pydantic `alias_generator = to_camel` (`populate_by_name = True`, `serialize_by_alias = True`).
- **Frontend TypeScript contracts:** `frontend/lib/contracts/*.ts` mirror these models in `camelCase`.
- **Action / Proposal Identity:** `actionId == proposalId`. An "Action" in `/api/projects/{projectId}/actions/{actionId}/approve` refers directly to the underlying `Proposal`. There is no distinct `Action` persistence table.

---

## 1. Authentication Context

### Firebase Token Verification

The backend performs Firebase ID token verification on every authenticated request. This verification chain is the primary authorization boundary (implementation plan §12):

```
Client request + Bearer token
    |
    v
FastAPI dependency: require_authenticated_user()
    |
    v
Firebase Admin SDK: verify_id_token()
    |
    v
Verified UID extracted from token claims
    |
    v
require_project_access(project_id, uid)
    |
    v
Firestore project ownership check (project.owner_uid == uid)
    |
    v
Handler proceeds
```

**Security note:** Firestore Security Rules exist as defense-in-depth and future-proofing, but they do not protect Admin SDK access. The backend authorization dependencies are the real security boundary.

---

## 2. Projects

**File owner:** Account 1 — `backend/api/projects.py`

### 2.1 Create Project

```
POST /api/projects
```

**Priority:** P0 — Vertical Slice  
**State:** ADMIN — creates authoritative project state directly (not via Proposal workflow).

**Auth:** Firebase ID token required. Project is created under the authenticated user's UID.

**Request body:**
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "goal": "string (optional)"
}
```

**Response `201 Created`:**
```json
{
  "project_id": "string",
  "owner_uid": "string",
  "name": "string",
  "description": "string or null",
  "goal": "string or null",
  "status": "active",
  "version": 1,
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

**Error responses:** 401, 422.

**Ownership:** `owner_uid` is set from the verified token; any `owner_uid` in the request body is ignored.

---

### 2.2 List Projects

```
GET /api/projects
```

**Priority:** P0 — Supporting  
**State:** READ.

**Auth:** Firebase ID token required. Returns only projects owned by the authenticated user.

**Response `200 OK`:**
```json
{
  "projects": [
    { "project_id": "...", "name": "...", "status": "...", "version": 1, ... }
  ]
}
```

**Error responses:** 401.

---

### 2.3 Get Project

```
GET /api/projects/{projectId}
```

**Priority:** P0 — Supporting  
**State:** READ.

**Auth:** Firebase ID token + project ownership required.

**Path parameters:** `projectId` — the project's `project_id`.

**Response `200 OK`:** full `Project` object (see §2.1 response shape).

**Error responses:** 401, 403, 404.

---

### 2.4 Update Project

```
PATCH /api/projects/{projectId}
```

**Priority:** P0 — Supporting  
**State:** ADMIN — updates project metadata directly (name, description, goal, status).

**Auth:** Firebase ID token + project ownership required.

**Path parameters:** `projectId`.

**Request body (all fields optional; at least one must be present):**
```json
{
  "name": "string",
  "description": "string or null",
  "goal": "string or null",
  "status": "active or archived"
}
```

**Response `200 OK`:** updated `Project` object.

**Error responses:** 401, 403, 404, 422.

**Note:** `version` is not incremented by PATCH — only by the approval transaction. `owner_uid` cannot be changed.

---

### 2.5 Get Project Dashboard (Aggregation)

```
GET /api/projects/{projectId}/dashboard
```

**Priority:** P0 — Supporting  
**State:** READ.

**Auth:** Firebase ID token + project ownership required.

**Path parameters:** `projectId`.

**Response `200 OK`:**
```json
{
  "project_id": "string",
  "requirements_count": 0,
  "accepted_requirements_count": 0,
  "components_count": 0,
  "tasks_count": 0,
  "tests_count": 0,
  "risks_open_count": 0,
  "pending_proposals_count": 0,
  "version": 1
}
```

**Error responses:** 401, 403, 404.

**Implementation task:** A-013.

---

## 3. Conversations and Multi-turn Chat

**File owners:** Account 3 — `backend/api/chat.py`; Account 1 — `backend/firestore/conversation_repo.py`

> The chat endpoint (C-013) is the P0 persistent, project-aware multi-turn AI interface. It is NOT the Gemini smoke-test endpoint (C-002b), which is a temporary connectivity check with no persistence, no conversation state, and no project awareness. The smoke-test endpoint is retired once C-013 lands.

### 3.1 Start / Continue Conversation (Chat)

```
POST /api/projects/{projectId}/chat
```

**Priority:** P0 — Vertical Slice  
**State:** PROPOSE — may produce Proposals as part of the response; conversation history is persisted.

**Auth:** Firebase ID token + project ownership required.

**Path parameters:** `projectId`.

**Request body:**
```json
{
  "conversation_id": "string (optional — omit to start a new conversation)",
  "message": "string (required — the user's message)"
}
```

**Response `200 OK`:**
```json
{
  "conversation_id": "string",
  "message_id": "string",
  "response": "string (assistant's text response)",
  "agent_type": "requirements or architecture or planning or testing or risk or orchestrator",
  "proposals": [
    {
      "proposal_id": "string",
      "action_class": "PROPOSE or LOW_IMPACT_WRITE or HIGH_IMPACT_WRITE or BULK_WRITE",
      "entity_type": "string",
      "entity_payload": {},
      "affected_entity_ids": ["string"],
      "confidence": "low or medium or high",
      "rationale": "string or null",
      "status": "pending",
      "project_version_at_creation": 0,
      "created_at": "datetime"
    }
  ],
  "unresolved_questions": ["string"],
  "run_id": "string"
}
```

**Error responses:** 401, 403, 404, 422, 503.

**Persistence contract:** every user message and every assistant response is persisted to Firestore via `conversation_repo.py` (Account 1's A-008b) before the response is returned. `C-013` is not considered complete until it is wired to `conversation_repo.py`.

**Idempotency:** not idempotent — each call appends messages to conversation history.

**Orchestration:** the Orchestrator routes the message to exactly one specialist agent in P0 (single-agent routing). Multi-agent fan-out in a single turn is P1.

---

### 3.2 Get Conversation History

```
GET /api/projects/{projectId}/conversations/{conversationId}
```

**Priority:** P0 — Supporting  
**State:** READ.

**Auth:** Firebase ID token + project ownership required.

**Path parameters:** `projectId`, `conversationId`.

**Response `200 OK`:**
```json
{
  "conversation_id": "string",
  "project_id": "string",
  "title": "string or null",
  "messages": [
    {
      "message_id": "string",
      "conversation_id": "string",
      "project_id": "string",
      "role": "user or assistant",
      "content": "string",
      "proposal_ids": ["string"],
      "created_at": "datetime"
    }
  ],
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

**Error responses:** 401, 403, 404.

---

## 4. Requirements

**File owners:** Account 3 — `backend/api/requirements.py` (agent-trigger portion); Account 1 — CRUD portion

### 4.1 List Requirements

```
GET /api/projects/{projectId}/requirements
```

**Priority:** P0 — Vertical Slice  
**State:** READ — returns authoritative (accepted) requirements only.

**Auth:** Firebase ID token + project ownership required.

**Path parameters:** `projectId`.

**Query parameters:**
- `status` (optional): filter by `"proposed" | "accepted" | "rejected" | "superseded"`
- `priority` (optional): filter by `"must" | "should" | "may"`

**Response `200 OK`:**
```json
{
  "requirements": [
    {
      "requirement_id": "string",
      "project_id": "string",
      "type": "functional or non_functional",
      "statement": "string",
      "rationale": "string or null",
      "priority": "must or should or may",
      "status": "proposed or accepted or rejected or superseded",
      "acceptance_criteria": ["string"],
      "source_refs": ["string"],
      "version": 1
    }
  ]
}
```

**Error responses:** 401, 403, 404.

---

### 4.2 Get Requirement

```
GET /api/projects/{projectId}/requirements/{requirementId}
```

**Priority:** P0 — Supporting  
**State:** READ.

**Auth:** Firebase ID token + project ownership required.

**Response `200 OK`:** single `Requirement` object (same shape as list item above).

**Error responses:** 401, 403, 404.

---

## 5. Architecture Components

**File owner:** Account 3 — `backend/api/architecture.py`

### 5.1 List Components

```
GET /api/projects/{projectId}/components
```

**Priority:** P0 — Supporting  
**State:** READ — returns authoritative (accepted) components only.

**Auth:** Firebase ID token + project ownership required.

**Response `200 OK`:**
```json
{
  "components": [
    {
      "component_id": "string",
      "project_id": "string",
      "name": "string",
      "type": "string",
      "responsibilities": ["string"],
      "interfaces": ["string"],
      "technology": "string or null",
      "status": "proposed or accepted or rejected"
    }
  ]
}
```

**Error responses:** 401, 403, 404.

---

### 5.2 Get Component

```
GET /api/projects/{projectId}/components/{componentId}
```

**Priority:** P0 — Supporting  
**State:** READ.

**Auth:** Firebase ID token + project ownership required.

**Response `200 OK`:** single `Component` object.

**Error responses:** 401, 403, 404.

---

## 6. Planning (Tasks)

**File owner:** Account 3 — `backend/api/planning.py`

### 6.1 List Tasks

```
GET /api/projects/{projectId}/tasks
```

**Priority:** P0 — Supporting  
**State:** READ — returns authoritative (accepted) tasks only.

**Auth:** Firebase ID token + project ownership required.

**Query parameters:**
- `status` (optional): filter by `"todo" | "in_progress" | "done" | "blocked"`

**Response `200 OK`:**
```json
{
  "tasks": [
    {
      "task_id": "string",
      "project_id": "string",
      "title": "string",
      "description": "string or null",
      "status": "todo or in_progress or done or blocked",
      "priority": "must or should or may",
      "depends_on": ["string"],
      "requirement_refs": ["string"],
      "component_refs": ["string"],
      "milestone_id": "string or null"
    }
  ]
}
```

**Error responses:** 401, 403, 404.

---

## 7. Decision Ledger

**File owner:** Account 1 — `backend/api/decisions.py`

### 7.1 Create Decision (direct CRUD, not agent-mediated)

```
POST /api/projects/{projectId}/decisions
```

**Priority:** P0 — Supporting  
**State:** ADMIN — creates an accepted decision directly. This is the CRUD path for user-authored decisions, not the agent-proposal path.

**Auth:** Firebase ID token + project ownership required.

**Request body:**
```json
{
  "title": "string (required)",
  "context": "string (optional)",
  "decision": "string (required)",
  "alternatives": ["string"],
  "rationale": "string (optional)",
  "consequences": ["string"],
  "status": "accepted (default)",
  "supersedes": ["string"]
}
```

**Response `201 Created`:** full `Decision` object.

**Error responses:** 401, 403, 422.

---

### 7.2 List Decisions

```
GET /api/projects/{projectId}/decisions
```

**Priority:** P0 — Supporting  
**State:** READ.

**Auth:** Firebase ID token + project ownership required.

**Response `200 OK`:**
```json
{
  "decisions": [
    {
      "decision_id": "string",
      "project_id": "string",
      "title": "string",
      "context": "string or null",
      "decision": "string",
      "alternatives": ["string"],
      "rationale": "string or null",
      "consequences": ["string"],
      "status": "proposed or accepted or superseded",
      "supersedes": ["string"]
    }
  ]
}
```

**Error responses:** 401, 403, 404.

---

### 7.3 Get Decision

```
GET /api/projects/{projectId}/decisions/{decisionId}
```

**Priority:** P0 — Supporting  
**State:** READ.

**Auth:** Firebase ID token + project ownership required.

**Response `200 OK`:** single `Decision` object.

**Error responses:** 401, 403, 404.

---

## 8. Testing

**File owner:** Account 3 — `backend/api/testing.py`

### 8.1 List Test Cases

```
GET /api/projects/{projectId}/tests
```

**Priority:** P0 — Supporting  
**State:** READ — returns authoritative (accepted) test cases only.

**Auth:** Firebase ID token + project ownership required.

**Response `200 OK`:**
```json
{
  "tests": [
    {
      "test_id": "string",
      "project_id": "string",
      "type": "unit or integration or security or scenario",
      "title": "string",
      "procedure": ["string"],
      "expected_result": "string",
      "requirement_refs": ["string"],
      "status": "proposed or accepted or passing or failing"
    }
  ]
}
```

**Error responses:** 401, 403, 404.

---

## 9. Risk Analysis

**File owner:** Account 3 — `backend/api/risks.py`

### 9.1 List Risks

```
GET /api/projects/{projectId}/risks
```

**Priority:** P0 — Supporting  
**State:** READ — returns authoritative (accepted) risks only.

**Auth:** Firebase ID token + project ownership required.

**Query parameters:**
- `status` (optional): filter by `"open" | "mitigated" | "accepted_risk"`

**Response `200 OK`:**
```json
{
  "risks": [
    {
      "risk_id": "string",
      "project_id": "string",
      "category": "string",
      "description": "string",
      "likelihood": "low or medium or high",
      "impact": "low or medium or high or critical",
      "score": 0,
      "mitigation_refs": ["string"],
      "status": "open or mitigated or accepted_risk"
    }
  ]
}
```

**Error responses:** 401, 403, 404.

---

## 10. Proposals

**File owner:** Account 1 — `backend/api/actions.py`

### 10.1 List Pending Proposals

```
GET /api/projects/{projectId}/proposals
```

**Priority:** P0 — Vertical Slice  
**State:** READ.

**Auth:** Firebase ID token + project ownership required.

**Query parameters:**
- `status` (optional, default `"pending"`): filter by `"pending" | "approved" | "rejected" | "expired"`

**Response `200 OK`:**
```json
{
  "proposals": [
    {
      "proposal_id": "string",
      "project_id": "string",
      "run_id": "string",
      "action_class": "READ or PROPOSE or LOW_IMPACT_WRITE or HIGH_IMPACT_WRITE or BULK_WRITE",
      "entity_type": "string",
      "entity_payload": {},
      "affected_entity_ids": ["string"],
      "confidence": "low or medium or high",
      "rationale": "string or null",
      "status": "pending or approved or rejected or expired",
      "project_version_at_creation": 0,
      "created_at": "datetime"
    }
  ]
}
```

**Error responses:** 401, 403, 404.

---

### 10.2 Get Proposal

```
GET /api/projects/{projectId}/proposals/{proposalId}
```

**Priority:** P0 — Supporting  
**State:** READ.

**Auth:** Firebase ID token + project ownership required.

**Response `200 OK`:** single `Proposal` object (same shape as list item above).

**Error responses:** 401, 403, 404.

---

## 11. Proposal Approval / Rejection

**File owner:** Account 1 — `backend/api/actions.py`, `backend/services/approval_service.py`

This is the most critical endpoint pair in the system. It is the sole mechanism by which AI proposals become authoritative project state.

> **Identity Relationship:** `actionId == proposalId`. The path parameter `actionId` in `/actions/{actionId}/approve` and `/reject` refers directly to the `proposal_id` of the target `Proposal`. There is no separate `Action` entity in persistence; `proposals/{proposalId}` in Firestore is the backing collection.

### 11.1 Approve Proposal

```
POST /api/projects/{projectId}/actions/{actionId}/approve
```

**Priority:** P0 — Vertical Slice  
**State:** MUTATE — the only mutation path for AI-proposed entities.

**Auth:** Firebase ID token + project ownership required.

**Path parameters:**
- `projectId` — the owning project
- `actionId` — the `proposal_id` of the proposal to approve (`actionId == proposalId`)

**Request body:** empty (no body required).

**Response `200 OK`:**
```json
{
  "proposal_id": "string",
  "status": "approved",
  "entity_type": "string",
  "entity_id": "string",
  "project_version": 0,
  "audit_event_id": "string"
}
```

**Error responses:** 401, 403, 404, 409 (stale version), 500.

**The approval transaction (ApprovalService — implementation plan §13.5):**

All of the following succeed together or none of them are written (Firestore transaction atomicity):

1. Read current `Proposal` and `Project.version` inside the transaction.
2. Validate `proposal.project_version_at_creation == project.version` — if mismatch, abort with `409 STALE_VERSION`.
3. Write authoritative entity to its repository (`requirement_repo`, `component_repo`, `task_repo`, `test_repo`, `risk_repo`, or `decision_repo` based on `entity_type`).
4. Write derived `TraceLink` documents to `trace_link_repo`.
5. Increment `project.version` in `project_repo`.
6. Write `AuditEvent` to `audit_repo`.
7. Update `proposal.status = "approved"` in proposals collection.
8. Commit transaction.

**Concurrency invariant:** two concurrent approval attempts against the same proposal where both read the same stale `project.version` — exactly one must succeed; the other must return `409 STALE_VERSION`. This test is a mandatory precondition for considering A-009/A-014 done.

**Idempotency:** not idempotent — attempting to approve an already-approved or rejected proposal returns 409.

---

### 11.2 Reject Proposal

```
POST /api/projects/{projectId}/actions/{actionId}/reject
```

**Priority:** P0 — Vertical Slice  
**State:** MUTATE — marks proposal as rejected; writes AuditEvent; does not modify any entity.

**Auth:** Firebase ID token + project ownership required.

**Path parameters:** `projectId`, `actionId` (= `proposal_id`).

**Request body (optional):**
```json
{
  "reason": "string (optional rejection reason)"
}
```

**Response `200 OK`:**
```json
{
  "proposal_id": "string",
  "status": "rejected",
  "audit_event_id": "string"
}
```

**Error responses:** 401, 403, 404.

**On rejection:** `proposal.status = "rejected"`, `AuditEvent` written. `project.version` is NOT incremented. No entity is modified.

---

## 12. Knowledge Graph

**File owner:** Account 4 — `backend/api/graph.py`

### 12.1 Get Project Graph

```
GET /api/projects/{projectId}/graph
```

**Priority:** P0 — Supporting  
**State:** READ — assembles the knowledge graph from Firestore TraceLinks at read time.

**Auth:** Firebase ID token + project ownership required.

**Path parameters:** `projectId`.

**Response `200 OK`:**
```json
{
  "project_id": "string",
  "nodes": [
    {
      "id": "string",
      "type": "requirement or component or decision or task or test or risk",
      "label": "string",
      "data": {}
    }
  ],
  "edges": [
    {
      "id": "string",
      "source": "string (node id)",
      "target": "string (node id)",
      "relation": "IMPLEMENTS or GENERATES etc.",
      "label": "string"
    }
  ]
}
```

**Error responses:** 401, 403, 404.

**Implementation note:** The graph is assembled by `graph_assembler.assemble_graph(project_id)` from accepted components and `traceLinks` documents. No graph database is used. React Flow renders the nodes/edges shape returned here.

---

## 13. Change Impact Analysis

**File owner:** Account 4 — `backend/api/impact.py`

### 13.1 Analyze Impact

```
POST /api/projects/{projectId}/impact-analysis
```

**Priority:** P0 — Supporting  
**State:** READ (returns analysis; does not create proposals automatically; proposals may be created as a downstream user action).

**Auth:** Firebase ID token + project ownership required.

**Path parameters:** `projectId`.

**Request body:**
```json
{
  "entity_type": "requirement or component or decision or task or test or risk",
  "entity_id": "string"
}
```

**Response `200 OK`:**
```json
{
  "project_id": "string",
  "changed_entity_type": "string",
  "changed_entity_id": "string",
  "affected_entities": [
    {
      "entity_type": "string",
      "entity_id": "string",
      "relation_path": ["string"],
      "label": "string"
    }
  ],
  "explanation": "string (Gemini-generated semantic explanation of why these entities are affected — P0 field, not P1)",
  "run_id": "string"
}
```

**Error responses:** 401, 403, 404, 422, 503.

**Pipeline (implementation plan §18):**
1. Deterministic graph traversal (bounded depth) — `traversal.py` (Account 4) identifies affected entity set.
2. Gemini semantic explanation — `impact_explainer.py` (Account 3) explains why the entities are affected.
3. Both steps are P0. The `explanation` field is populated in P0, not deferred to P1.

**Important separation:** `traversal.py` never calls Gemini. `impact_explainer.py` never re-derives the affected set — it only explains a set it is handed.

---

## 14. Audit Events

**File owner:** Account 1 — `backend/api/audit.py`

### 14.1 List Audit Events

```
GET /api/projects/{projectId}/audit
```

**Priority:** P0 — Supporting  
**State:** READ.

**Auth:** Firebase ID token + project ownership required.

**Path parameters:** `projectId`.

**Query parameters:**
- `limit` (optional, default 50): maximum number of events to return
- `before` (optional): return events before this timestamp (for pagination)

**Response `200 OK`:**
```json
{
  "events": [
    {
      "event_id": "string",
      "project_id": "string",
      "actor": "user or system",
      "actor_uid": "string or null",
      "action": "string",
      "target_type": "string",
      "target_id": "string",
      "outcome": "success or failure",
      "timestamp": "datetime"
    }
  ]
}
```

**Error responses:** 401, 403, 404.

**Ordering:** events returned in reverse chronological order (newest first).

---

## 15. Trace Links

**File owner:** Account 4 — (no direct trace link CRUD endpoint; links are read via the graph endpoint)

> TraceLinks are created atomically inside the `ApprovalService` transaction and are not directly user-creatable in P0. They are read via `GET /api/projects/{projectId}/graph`.
>
> A manual link editor is P1.

---

## 16. Temporary Endpoints (P0 Lifecycle-Limited)

### 16.1 Gemini Smoke Test

```
POST /api/smoke-test
```

**Priority:** P0 — Supporting (Temporary diagnostic)  
**Owner:** Account 3 — `backend/api/smoke_test.py`  
**State:** READ.

**Lifecycle:** **Temporary.** This endpoint exists only until `POST /api/projects/{projectId}/chat` (C-013) lands. It is deleted — not deprecated — once C-013 is complete.

**Purpose:** Proves frontend → Firebase auth → FastAPI → `ModelClient` → Gemini → response connectivity. No persistence. No conversation history. No project awareness.

**Auth:** Firebase ID token required.

**Request body:**
```json
{
  "message": "string"
}
```

**Response `200 OK`:**
```json
{
  "response": "string"
}
```

**Constraint:** this endpoint must never accumulate conversation state, history, or project awareness. If it does, it becomes a second undocumented chat architecture running alongside the real one. Any scope creep here is a critical architectural violation.

---

## 17. Agent-Trigger Endpoints (Specialist Agents)

These endpoints trigger specialist agents directly (outside the chat flow). They are owned by Account 3.

> **Invocation Hierarchy (ADR-022):** In the primary P0 demo flow, agents are triggered via `POST /api/projects/{projectId}/chat`. These direct agent endpoints are secondary supporting access paths (e.g. for dedicated page "Re-analyze" actions and integration testing) but share the identical underlying agent execution and proposal wrapping pipeline.

### 17.1 Analyze Requirements

```
POST /api/projects/{projectId}/requirements/analyze
```

**Priority:** P0 — Supporting  
**File owner:** Account 3 — `backend/api/requirements.py`  
**State:** PROPOSE.

**Auth:** Firebase ID token + project ownership required.

**Request body:**
```json
{
  "conversation_id": "string (optional)",
  "focus_entity_ids": ["string (optional)"]
}
```

**Response `200 OK`:** same `proposals[]` shape as chat response.

**Error responses:** 401, 403, 404, 503.

---

### 17.2 Analyze Architecture

```
POST /api/projects/{projectId}/architecture/analyze
```

**Priority:** P0 — Supporting  
**File owner:** Account 3 — `backend/api/architecture.py`  
**State:** PROPOSE. Requires accepted requirements to exist.

**Auth:** Firebase ID token + project ownership required.

**Response `200 OK`:** same `proposals[]` shape.

**Error responses:** 401, 403, 404, 503.

---

### 17.3 Generate Planning (Tasks)

```
POST /api/projects/{projectId}/planning/analyze
```

**Priority:** P0 — Supporting  
**File owner:** Account 3 — `backend/api/planning.py`  
**State:** PROPOSE. Requires accepted requirements and/or components.

**Auth:** Firebase ID token + project ownership required.

**Response `200 OK`:** same `proposals[]` shape.

**Error responses:** 401, 403, 404, 503.

---

### 17.4 Generate Tests

```
POST /api/projects/{projectId}/tests/generate
```

**Priority:** P0 — Supporting  
**File owner:** Account 3 — `backend/api/testing.py`  
**State:** PROPOSE. Requires accepted requirements.

**Auth:** Firebase ID token + project ownership required.

**Response `200 OK`:** same `proposals[]` shape.

**Error responses:** 401, 403, 404, 503.

---

### 17.5 Analyze Risks

```
POST /api/projects/{projectId}/risks/analyze
```

**Priority:** P0 — Supporting  
**File owner:** Account 3 — `backend/api/risks.py`  
**State:** PROPOSE.

**Auth:** Firebase ID token + project ownership required.

**Response `200 OK`:** same `proposals[]` shape.

**Error responses:** 401, 403, 404, 503.

---

## 18. Out of Scope for P0

The following operations are referenced in the SRS but explicitly deferred:

### 18.1 Code / Architecture Review

```
POST /api/projects/{projectId}/review
```

**Priority:** Later (P1)  
**Owner:** Account 3 — `backend/api/review.py`  
**State:** PROPOSE (returns 501 Not Implemented in P0).

---

### 18.2 Other Deferred Operations

| Operation | Deferred to | Notes |
|---|---|---|
| Artifact upload | P1/P2 | SRS FR-031; implementation plan §3 explicitly defers |
| Repository import | P2 | SRS FR-032 |
| Manual TraceLink creation | P1 | Auto-created from agent outputs in P0 |

---

## 19. Authorization Matrix

| Operation | Auth required | Ownership check |
|---|---|---|
| Create project | Firebase ID token | N/A (creates new) |
| All project-scoped operations | Firebase ID token | `project.owner_uid == verified_uid` |
| Approve/reject proposal | Firebase ID token | `project.owner_uid == verified_uid` |
| List audit events | Firebase ID token | `project.owner_uid == verified_uid` |
| Smoke test | Firebase ID token | None (no project context) |

**Cross-project resource access:** a valid token for user A cannot access resources in a project owned by user B, even if the resource ID is known. The backend always re-validates project ownership before serving any subcollection resource.

---

## 20. Non-Functional Constraints

These apply to all API endpoints:

| NFR | Requirement | Source |
|---|---|---|
| NFR-001 | Non-AI project reads: ≤500 ms at p95 | SRS |
| NFR-002 | AI interactions: first visible progress within 2 seconds | SRS |
| NFR-003 | Typical AI requests complete within 15 seconds | SRS |
| NFR-004 | Failed Gemini call does not corrupt accepted project state | SRS |
| NFR-005 | Failed Firestore write not reported as successful mutation | SRS |
| NFR-006 | No secret appears in any response, log, or repository | SRS |
| NFR-007 | All project reads/writes are authorization checked | SRS |
| NFR-008 | Minimize project data sent to Gemini per request | SRS |
| NFR-009 | Every accepted AI mutation has a unique audit identifier | SRS |
| NFR-010 | Backend AI runs emit structured logs correlated by request/run ID | SRS |
