# NEXUS Canonical Data Model — Phase 0

**Status:** Phase 0 integration contract  
**Authority:** SRS v1.0 Appendix B + Implementation Plan v2.0 §9.1, §9.2, §11  
**Owner:** Human Integration Owner  
**Last updated:** 2026-09-05

> This document is the canonical entity reference for all five development accounts.  
> Field names match SRS Appendix B exactly. Pydantic types in §9.1 of the implementation plan  
> are the authoritative implementation form; this document is the human-readable companion.  
> Any change to a frozen entity requires a written entry in `docs/decision-log.md` and human  
> integration owner approval (implementation plan §9.6).

---

## 0. State Semantics — The Approval Boundary

Every entity in this model exists in one of two states. This distinction is the central architectural principle of NEXUS and must be preserved throughout every layer:

| State | Meaning | Persisted where |
|---|---|---|
| **Proposed / Candidate** | AI-generated draft, not yet authoritative. Exists as a `Proposal` envelope. | `proposals/{proposalId}` in Firestore |
| **Accepted / Authoritative** | Explicitly approved by the human user via `/actions/{actionId}/approve`. | Entity's own Firestore subcollection (e.g. `requirements/{id}`) |

> **Identity Relationship:** `actionId == proposalId`. An "Action" exposed by the approval/rejection API refers directly to the underlying `Proposal`. There is no separate `Action` persistence entity; `proposals/{proposalId}` is the sole durable store.

AI agents **must not** write directly to entity repositories. Every agent output is a `Proposal`. Only `ApprovalService` (via the `/actions/{actionId}/approve` endpoint) may promote a candidate into authoritative state, and it does so inside a single atomic Firestore transaction.

```
Agent output (Candidate entity)
    |
    v
Proposal envelope (status: "pending", stored in proposals/{proposalId})
    |
    v
Human approval via POST /actions/{actionId}/approve (where actionId == proposalId)
    |
    v
Transactional persistence (ApprovalService)
    |-- Entity repository (create authoritative record)
    |-- TraceLink repository (create derived links)
    |-- Project version increment
    |-- AuditEvent creation
    `-- Proposal status -> "approved"
```

---

## 1. Firestore Collection Hierarchy

Specified by implementation plan §11. Every document under `projects/{projectId}` inherits authorization from `projects/{projectId}.ownerUid`. The backend (Admin SDK) is the only writer for every collection.

```
users/{uid}
  projects/{projectId}
    requirements/{requirementId}
    components/{componentId}
    decisions/{decisionId}
    tasks/{taskId}
    tests/{testId}
    risks/{riskId}
    artifacts/{artifactId}
    conversations/{conversationId}
      messages/{messageId}          <- subcollection (keeps conversation docs small)
    agentRuns/{runId}
    auditEvents/{eventId}
    traceLinks/{traceLinkId}
    proposals/{proposalId}          <- durable store backing the Proposal Envelope
```

> **Authorization model:** every document under `projects/{projectId}` is owned by `ownerUid`. The backend derives UID exclusively from the verified Firebase ID token — never from a client-supplied field. The Admin SDK bypasses Firestore Security Rules; backend authorization dependencies (`require_project_access`) are the real enforcement boundary (implementation plan §12.2).

---

## 2. Core Entities

### 2.1 Project

**Purpose:** The top-level user-owned workspace. Every other entity belongs to a project. `version` is incremented by `ApprovalService` inside every approval transaction, enabling stale-proposal detection.

**Source:** SRS Appendix B; implementation plan §9.1.

| Field | Type | Required | Notes |
|---|---|---|---|
| `project_id` | `str` | YES | Stable unique identifier |
| `owner_uid` | `str` | YES | Firebase UID; derived from verified token, never client-supplied |
| `name` | `str` | YES | Human-readable project name |
| `description` | `str or None` | NO | Optional project description |
| `goal` | `str or None` | NO | Optional high-level project goal |
| `status` | `"active" or "archived"` | YES | Lifecycle state |
| `version` | `int` | YES | Monotonic counter; incremented on every accepted mutation; used for stale-proposal detection |
| `created_at` | `datetime` | YES | Creation timestamp |
| `updated_at` | `datetime` | YES | Last modification timestamp |

**Relationships:** owns all other entities in its subcollections.

**Versioning:** `version` is the concurrency control primitive. Every `Proposal` records `project_version_at_creation`; the approval transaction rejects the proposal if this value no longer matches the current `project.version`.

---

### 2.2 Requirement

**Purpose:** A structured software requirement with stable identity. Produced by the Requirements Agent as a candidate, promoted to authoritative via approval.

**Source:** SRS Appendix B, FR-009, FR-010; implementation plan §9.1.

| Field | Type | Required | Notes |
|---|---|---|---|
| `requirement_id` | `str` | YES | Stable unique identifier |
| `project_id` | `str` | YES | Owning project |
| `type` | `"functional" or "non_functional"` | YES | Requirement category |
| `statement` | `str` | YES | The requirement text |
| `rationale` | `str or None` | NO | Why this requirement exists |
| `priority` | `"must" or "should" or "may"` | YES | MoSCoW priority |
| `status` | `"proposed" or "accepted" or "rejected" or "superseded"` | YES | Lifecycle state |
| `acceptance_criteria` | `list[str]` | YES (default `[]`) | Validation criteria; >=1 required by P0 validation rule or flagged ambiguous |
| `source_refs` | `list[str]` | NO (default `[]`) | Source artifact or conversation references |
| `version` | `int` | YES | Entity-level version |

**Agent:** Requirements Agent — produces `list[Requirement]` candidate objects, wrapped in `Proposal[]`.

**P0 validation rule:** every requirement must have >=1 acceptance criterion, or be flagged as ambiguous in `AgentOutput.unresolved_questions`.

---

### 2.3 Component (ArchitectureComponent)

**Purpose:** A logical or physical part of the software system, proposed by the Architecture Agent. Forms the nodes of the traceability graph.

**Source:** SRS Appendix B, FR-012, FR-013; implementation plan §9.1.

| Field | Type | Required | Notes |
|---|---|---|---|
| `component_id` | `str` | YES | Stable unique identifier |
| `project_id` | `str` | YES | Owning project |
| `name` | `str` | YES | Component name |
| `type` | `str` | YES | Component category (e.g. "service", "library", "database", "api") |
| `responsibilities` | `list[str]` | NO (default `[]`) | What this component is responsible for |
| `interfaces` | `list[str]` | NO (default `[]`) | Exposed interfaces or contracts |
| `technology` | `str or None` | NO | Technology or runtime used |
| `status` | `"proposed" or "accepted" or "rejected"` | YES | Lifecycle state |

**Agent:** Architecture Agent — produces `list[Component]` + relationship hints, wrapped in `Proposal[]`.

**P0 validation rule:** each component must reference >=1 `requirement_id` via a `TraceLink` (IMPLEMENTS relation) at creation time.

---

### 2.4 Decision

**Purpose:** An engineering decision recorded in the Decision Ledger with rationale, alternatives, and consequences. Accepted decisions are authoritative project memory that Gemini agents may reference.

**Source:** SRS Appendix B, FR-017, FR-018; implementation plan §9.1.

| Field | Type | Required | Notes |
|---|---|---|---|
| `decision_id` | `str` | YES | Stable unique identifier |
| `project_id` | `str` | YES | Owning project |
| `title` | `str` | YES | Short title of the decision |
| `context` | `str or None` | NO | Problem context prompting the decision |
| `decision` | `str` | YES | The decision made |
| `alternatives` | `list[str]` | NO (default `[]`) | Alternatives considered |
| `rationale` | `str or None` | NO | Why this option was chosen |
| `consequences` | `list[str]` | NO (default `[]`) | Known trade-offs or follow-on effects |
| `status` | `"proposed" or "accepted" or "superseded"` | YES | Lifecycle state |
| `supersedes` | `list[str]` | NO (default `[]`) | IDs of decisions this supersedes |

**Ownership:** Account 1 owns Decision CRUD (`backend/api/decisions.py`). Decision proposals may originate from the Architecture Agent.

**P0 scope:** create + list + view. Supersession UI is P1 (schema exists in P0).

---

### 2.5 Task

**Purpose:** An implementation work item derived from approved requirements and/or architecture components. Produced by the Planning Agent.

**Source:** SRS Appendix B, FR-015, FR-016; implementation plan §9.1.

| Field | Type | Required | Notes |
|---|---|---|---|
| `task_id` | `str` | YES | Stable unique identifier |
| `project_id` | `str` | YES | Owning project |
| `title` | `str` | YES | Task title |
| `description` | `str or None` | NO | Detailed description |
| `status` | `"todo" or "in_progress" or "done" or "blocked"` | YES | Lifecycle state |
| `priority` | `"must" or "should" or "may"` | YES | Priority |
| `depends_on` | `list[str]` | NO (default `[]`) | IDs of tasks this depends on |
| `requirement_refs` | `list[str]` | NO (default `[]`) | IDs of requirements this task implements |
| `component_refs` | `list[str]` | NO (default `[]`) | IDs of components this task concerns |
| `milestone_id` | `str or None` | NO | Optional milestone grouping (Milestone entity is P1) |

**Agent:** Planning Agent — produces `list[Task]`, wrapped in `Proposal[]`.

**P0 validation rule:** every task must have >=1 `requirement_ref` or >=1 `component_ref`.

---

### 2.6 TestCase

**Purpose:** A test case generated from accepted requirements and acceptance criteria by the Testing Agent. Named `TestCase` (not `Test`) to avoid pytest collection collisions.

**Source:** SRS Appendix B, FR-022, FR-023; implementation plan §9.1.

| Field | Type | Required | Notes |
|---|---|---|---|
| `test_id` | `str` | YES | Stable unique identifier |
| `project_id` | `str` | YES | Owning project |
| `type` | `"unit" or "integration" or "security" or "scenario"` | YES | Test category |
| `title` | `str` | YES | Test title |
| `procedure` | `list[str]` | NO (default `[]`) | Test steps |
| `expected_result` | `str` | YES | What a passing test produces |
| `requirement_refs` | `list[str]` | NO (default `[]`) | Requirements this test validates |
| `status` | `"proposed" or "accepted" or "passing" or "failing"` | YES | Lifecycle state |

**Agent:** Testing Agent — produces `list[TestCase]`, wrapped in `Proposal[]`.

**P0 validation rule:** every test must reference >=1 requirement ID.

---

### 2.7 Risk

**Purpose:** An identified project risk with likelihood and impact scored by the Risk Agent. `score` is computed server-side — never trusted from the client or model output.

**Source:** SRS Appendix B, FR-024, FR-025; implementation plan §9.1.

| Field | Type | Required | Notes |
|---|---|---|---|
| `risk_id` | `str` | YES | Stable unique identifier |
| `project_id` | `str` | YES | Owning project |
| `category` | `str` | YES | Risk category (e.g. "security", "technical", "schedule") |
| `description` | `str` | YES | Risk description |
| `likelihood` | `"low" or "medium" or "high"` | YES | Probability level |
| `impact` | `"low" or "medium" or "high" or "critical"` | YES | Severity level |
| `score` | `int` | YES | **Server-side computed only** — derived from likelihood x impact; never trust client-supplied value |
| `mitigation_refs` | `list[str]` | NO (default `[]`) | IDs of tasks that mitigate this risk |
| `status` | `"open" or "mitigated" or "accepted_risk"` | YES | Lifecycle state |

**Agent:** Risk Agent — produces `list[Risk]`, wrapped in `Proposal[]`.

---

### 2.8 TraceLink

**Purpose:** An explicit typed directed relationship between two project entities. Together, `TraceLink` documents form the in-Firestore knowledge graph assembled by `graph_assembler.py`. They are never stored as adjacency lists inside entity documents.

**Source:** SRS §13.1, Appendix B; implementation plan §9.1.

| Field | Type | Required | Notes |
|---|---|---|---|
| `trace_link_id` | `str` | YES | Stable unique identifier |
| `project_id` | `str` | YES | Owning project |
| `source_type` | enum (see below) | YES | Type of source entity |
| `source_id` | `str` | YES | ID of the source entity |
| `relation` | enum (see below) | YES | Typed relationship |
| `target_type` | enum (see below) | YES | Type of target entity |
| `target_id` | `str` | YES | ID of the target entity |
| `created_by` | `"system" or "agent" or "user"` | YES | Who created this link |
| `created_at` | `datetime` | YES | Creation timestamp |

**Allowed `source_type` / `target_type` values:**
`"requirement"`, `"component"`, `"decision"`, `"task"`, `"test"`, `"risk"`, `"artifact"`

**Allowed `relation` values (from SRS §13.1 and implementation plan §9.1):**

| Relation | Meaning |
|---|---|
| `IMPLEMENTS` | Component implements requirement |
| `DECOMPOSES` | Requirement decomposes into child requirement |
| `DEPENDS_ON` | Entity depends on another entity |
| `GENERATES` | Requirement/analysis generates task or test |
| `VALIDATES` | Test validates requirement/component |
| `INFLUENCES` | Decision influences component/requirement |
| `AFFECTS` | Change or risk affects entity |
| `MITIGATES` | Task/control mitigates risk |
| `CONFLICTS_WITH` | Entity conflicts with another entity |
| `SUPERSEDES` | New decision supersedes old decision |
| `DOCUMENTED_BY` | Entity is supported by an artifact |

**File ownership:** `backend/firestore/trace_link_repo.py` is owned exclusively by Account 4. Account 1 reviews it as a coordination point but never edits it.

**Creation:** TraceLinks are written inside the `ApprovalService` transaction — derived from agent proposals, never created in isolation outside the transaction.

---

### 2.9 Proposal

**Purpose:** The envelope that carries every AI-generated candidate action. This is the most important shared contract — it is the boundary between AI proposal state and authoritative state. All five specialist agents return `Proposal[]`. Nothing persists to an entity repository except through `ApprovalService` acting on an approved `Proposal`.

**Identity Mapping:** `proposal_id` is exposed as `actionId` in the API layer (`/api/projects/{projectId}/actions/{actionId}/approve` and `/reject`). `actionId == proposal_id`. There is no separate `Action` database entity; `proposals/{proposalId}` is the single backing collection.

**Source:** Implementation plan §9.2 — frozen first, before other entity contracts.

| Field | Type | Required | Notes |
|---|---|---|---|
| `proposal_id` | `str` | YES | Stable unique identifier (matches `actionId` in API routes) |
| `project_id` | `str` | YES | Owning project |
| `run_id` | `str` | YES | ID of the `AgentRun` that produced this proposal |
| `action_class` | `ActionClass` enum | YES | See table below |
| `entity_type` | `str` | YES | Domain type name (e.g. `"requirement"`, `"component"`) |
| `entity_payload` | `dict` | YES | The serialized candidate entity (`candidate.model_dump()`) |
| `affected_entity_ids` | `list[str]` | NO (default `[]`) | IDs of entities affected by this proposal |
| `confidence` | `"low" or "medium" or "high"` | YES | Agent confidence in this proposal |
| `rationale` | `str or None` | NO | Human-readable rationale |
| `status` | `"pending" or "approved" or "rejected" or "expired"` | YES | Approval lifecycle state |
| `project_version_at_creation` | `int` | YES | `project.version` at proposal creation; used for stale-check in `ApprovalService` |
| `created_at` | `datetime` | YES | Creation timestamp |

**ActionClass enum and P0 behavior:**

| `ActionClass` | P0 behavior |
|---|---|
| `READ` | Immediate execution — no proposal, no approval needed |
| `PROPOSE` | Generates a proposal for review; no persistence until approved |
| `LOW_IMPACT_WRITE` | Proposal + explicit user confirmation required. No automatic application in P0 |
| `HIGH_IMPACT_WRITE` | Proposal + explicit user confirmation via `POST /api/projects/{id}/actions/{actionId}/approve` |
| `BULK_WRITE` | Proposal + explicit user confirmation via `POST /api/projects/{id}/actions/{actionId}/approve` |

> **Critical P0 rule:** In P0, `LOW_IMPACT_WRITE` requires the same explicit-confirmation path as `HIGH_IMPACT_WRITE` and `BULK_WRITE`. Configurable auto-apply for `LOW_IMPACT_WRITE` is a P1 feature and does not exist in P0 under any configuration (implementation plan §9.2).

**Concurrency invariant:** `ApprovalService` validates `proposal.project_version_at_creation == project.version` inside the Firestore transaction. If they differ, the transaction aborts with a conflict error; nothing is written. A mandatory test covers two concurrent approval attempts against the same stale-version proposal: exactly one must succeed, the other must fail.

---

### 2.10 Conversation

**Purpose:** A persisted multi-turn conversation thread scoped to a project. Messages are stored in a subcollection to keep conversation documents small.

**Source:** Implementation plan §8.1 (A-008b), §11, §16.3; ADR-021.

| Field | Type | Required | Notes |
|---|---|---|---|
| `conversation_id` | `str` | YES | Stable unique identifier |
| `project_id` | `str` | YES | Owning project |
| `title` | `str or None` | NO (default `None`) | Optional conversation title / summary for UI thread listing |
| `created_at` | `datetime` | YES | Creation timestamp |
| `updated_at` | `datetime` | YES | Last message timestamp |

**Firestore path:** `users/{uid}/projects/{projectId}/conversations/{conversationId}`

**Ownership:** Account 1 owns `backend/firestore/conversation_repo.py`. Account 3 (chat endpoint) calls into this repository but does not own it.

---

### 2.11 Message

**Purpose:** A single turn within a `Conversation`. Stored as a subcollection of the conversation document.

**Source:** Implementation plan §8.1 (A-008b), §11; ADR-021.

| Field | Type | Required | Notes |
|---|---|---|---|
| `message_id` | `str` | YES | Stable unique identifier |
| `conversation_id` | `str` | YES | Parent conversation |
| `project_id` | `str` | YES | Owning project |
| `role` | `"user" or "assistant"` | YES | Message author role |
| `content` | `str` | YES | Message text |
| `proposal_ids` | `list[str]` | NO (default `[]`) | IDs of `Proposal` envelopes generated during this turn |
| `created_at` | `datetime` | YES | Ordered by this field for conversation history retrieval |

**Firestore path:** `users/{uid}/projects/{projectId}/conversations/{conversationId}/messages/{messageId}`

> **Disambiguation:** The `Message` type inside `ModelClient.generate()` (the provider-facing list of messages for Gemini) is a separate type defined in `backend/agents/model_client.py`. The entity documented here is the persisted Firestore conversation record only.

---

### 2.12 AgentRun

**Purpose:** An immutable audit record of a single agent execution. Records which agent ran, at what project version, with what outcome and latency. Explicitly excludes raw chain-of-thought or hidden reasoning text.

**Source:** Implementation plan §9.1.

| Field | Type | Required | Notes |
|---|---|---|---|
| `run_id` | `str` | YES | Stable unique identifier |
| `project_id` | `str` | YES | Owning project |
| `request_id` | `str` | YES | Correlates with HTTP request log (NFR-010) |
| `agent_type` | enum | YES | `"requirements"`, `"architecture"`, `"planning"`, `"testing"`, `"risk"`, `"review"`, `"orchestrator"` |
| `project_version` | `int` | YES | `project.version` at the time of execution |
| `input_refs` | `list[str]` | NO (default `[]`) | IDs of input entities used |
| `output_status` | enum | YES | `"success"`, `"invalid_schema"`, `"failed"`, `"rejected_by_policy"` |
| `latency_ms` | `int` | YES | End-to-end latency in milliseconds |
| `created_at` | `datetime` | YES | Creation timestamp |

> **Explicitly excluded:** raw chain-of-thought or hidden reasoning text from the model.

---

### 2.13 AuditEvent

**Purpose:** An immutable record of every consequential action — approved mutations, rejections, and failures. Required by FR-030 and NFR-009. Written for both approval and rejection outcomes.

**Source:** Implementation plan §9.1; SRS FR-030, NFR-009.

| Field | Type | Required | Notes |
|---|---|---|---|
| `event_id` | `str` | YES | Stable unique identifier |
| `project_id` | `str` | YES | Owning project |
| `actor` | `"user" or "system"` | YES | Who caused the event |
| `actor_uid` | `str or None` | NO | Firebase UID if actor is a user |
| `action` | `str` | YES | Descriptive action name (e.g. `"proposal_approved"`, `"proposal_rejected"`) |
| `target_type` | `str` | YES | Type of entity targeted |
| `target_id` | `str` | YES | ID of the entity targeted |
| `outcome` | `"success" or "failure"` | YES | Result of the action |
| `timestamp` | `datetime` | YES | When the event occurred |

**Creation:** `AuditEvent` records for approvals are written inside the `ApprovalService` transaction. Records for rejections are written as standalone writes after the proposal is marked rejected.

---

## 3. The Agent Pipeline — Domain Types vs. Proposal Envelope

The implementation plan (§14.1.1) defines a two-stage pipeline that every agent implementation follows. Both stages are mandatory:

```
Stage 1 — Agent internal validation (inside run())
    Requirements Agent  -> list[Requirement]   (validated against Requirement schema)
    Architecture Agent  -> list[Component]     (validated against Component schema)
    Planning Agent      -> list[Task]          (validated against Task schema)
    Testing Agent       -> list[TestCase]      (validated against TestCase schema)
    Risk Agent          -> list[Risk]          (validated against Risk schema)

Stage 2 — Proposal wrapping (before leaving agent boundary, inside execute())
    Each validated candidate is wrapped:
    Proposal(
        entity_type  = <type string>,
        entity_payload = candidate.model_dump(),
        action_class   = PROPOSE (or LOW/HIGH_IMPACT_WRITE as appropriate),
        ...
    )

    AgentOutput.proposals: list[Proposal]  <- the only thing the API layer sees

Stage 3 — Human approval -> ApprovalService -> authoritative entity in repository
```

Agents never call a repository directly. The domain type is an internal validation contract. The `Proposal` envelope is the only thing that crosses the agent boundary.

---

## 4. Knowledge Graph — TraceLink Topology

The NEXUS knowledge graph has no separate graph database. It is assembled at read time from `traceLinks` Firestore documents by `graph_assembler.py`. The expected P0 traceability chain (SRS §13.2):

```
Requirement
    | IMPLEMENTS
    v
Architecture Component
    | INFLUENCES / DOCUMENTED_BY
    v
Decision
    | GENERATES
    v
Task
    | GENERATES / VALIDATES
    v
Test

Risk --MITIGATES--> Mitigation Task
```

---

## 5. Firestore Indexes

Initial set specified by the implementation plan §11. Subject to revision after Account 3's real context-retrieval query patterns exist (task A-012):

| Collection | Fields | Order |
|---|---|---|
| `requirements` | `status`, `priority` | ASC, ASC |
| `tasks` | `status`, `milestoneId` | ASC, ASC |
| `traceLinks` | `sourceId`, `relation` | ASC, ASC |
| `auditEvents` | `timestamp` | DESC |

---

## 6. Entities NOT in P0

The following are referenced by the SRS but explicitly deferred:

| Entity | Deferred to | Notes |
|---|---|---|
| `Artifact` | P1/P2 | SRS references artifact upload; implementation plan §3 explicitly defers it |
| `Milestone` | P1 | `Task.milestone_id` exists as a schema placeholder only; Milestone entities and management UI are not P0 |

> **Rule:** these entities must not be implemented in P0. The `milestone_id` field on `Task` is a schema placeholder for future use only.

---

## 7. Consistency Rules with API Contract

- Entity ID field names follow `{entity_type}_id` convention: `project_id`, `requirement_id`, `component_id`, `decision_id`, `task_id`, `test_id`, `risk_id`, `trace_link_id`, `proposal_id`, `run_id`, `event_id`, `conversation_id`, `message_id`.
- `actionId == proposalId`: The Action resource referenced in API routes (`/api/projects/{projectId}/actions/{actionId}/approve` and `/reject`) corresponds directly to the `Proposal` document in `proposals/{proposalId}`. No separate `actions` collection exists.
- All timestamps are `datetime` (ISO 8601 with timezone).
- Entity `status` lifecycle: `"proposed" -> "accepted" or "rejected"`. `Proposal.status` lifecycle: `"pending" -> "approved" or "rejected" or "expired"`.
- `project.version` is the cross-entity concurrency control primitive. Individual `Requirement.version` is an entity-level counter; it is not the same as `project.version`.
- `score` on `Risk` is always server-side computed (`likelihood * impact`). Any client-supplied value is ignored.
- `owner_uid` on `Project` is always set from the verified Firebase token; any client-supplied value is ignored.
- Over-the-wire serialization: Python models and Firestore storage use `snake_case`; API request/response JSON payloads use `camelCase` generated via Pydantic `alias_generator` (`to_camel`). Frontend TypeScript contracts in `frontend/lib/contracts/*.ts` mirror these models in `camelCase`.
