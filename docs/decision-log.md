# NEXUS Decision Log — Phase 0

**Status:** Phase 0 integration contract  
**Authority:** Implementation Plan v2.0 §5 + SRS v1.0  
**Owner:** Human Integration Owner  
**Last updated:** 2026-09-05

> This document records architectural decisions that are established and locked for P0.
> Every decision that changes a frozen contract after Gate 0.5 must be recorded here
> before implementation proceeds (implementation plan §5, §9.6).

---

## How to Use This Document

**For established decisions (Section 1):** these are locked. Changing them requires:
1. A new entry in this log explaining why.
2. Human integration owner approval.
3. A version bump comment in the affected file(s).
4. Running `scripts/find_contract_usages.py` to notify every account whose owned files import the affected model.

**For open decisions (Section 2):** these are unresolved ambiguities that will affect parallel development. They must not be silently decided by any individual account. Resolve them with the human integration owner before the relevant implementation begins.

---

## 1. Established Architectural Decisions

### ADR-001: Modular Monolith — Not Microservices

**Status:** LOCKED (implementation plan §5, decision 1)  
**Source:** Implementation plan §5 decision 1; SRS §5.4

**Decision:** NEXUS is implemented as one FastAPI application (`backend/`) and one Next.js application (`frontend/`). Internal modularity comes from Python package boundaries, not network boundaries.

**Rationale:** Competition timeline does not permit the operational overhead of microservices. Modular monolith provides internal separation of concerns (by package: `auth/`, `firestore/`, `agents/`, `graph_model/`, `api/`) without the complexity of distributed communication, service discovery, or inter-service contracts.

**Consequences:**
- All backend packages share a single process; a catastrophic failure in one affects all.
- Scaling the backend means scaling the entire process.
- This is a correct trade-off for P0/competition scope.
- Post-competition evolution path: the package boundaries already model service boundaries; extracting a package to a service later is a deployment change, not an interface change.

**Do not build:** separate microservices, Kubernetes, inter-service message queues, or any service-mesh configuration in P0.

---

### ADR-002: No Graph Database

**Status:** LOCKED (implementation plan §5, decision 2)  
**Source:** Implementation plan §5 decision 2; SRS §4.2

**Decision:** The knowledge graph is materialized from `traceLinks` Firestore documents assembled at read time by `graph_assembler.py`. React Flow renders whatever JSON shape the backend returns.

**Rationale:** A graph database (Neo4j, etc.) adds significant operational and development overhead with no P0 benefit. Firestore TraceLink documents provide sufficient graph traversal for the bounded-depth impact analysis required by P0. The JSON shape returned by `GET /api/projects/{id}/graph` is the integration contract between Account 4's graph assembler and Account 2's React Flow renderer — this shape is defined in `docs/api-contract.md`.

**Consequences:**
- Graph queries are bounded-depth Firestore reads, not native graph traversals.
- Deep multi-hop traversals beyond the P0 bounded depth would require rethinking.
- Post-competition: `graph_assembler.py` and `traversal.py` are the seam that could be backed by a graph DB without changing API shapes.

**Do not build:** Neo4j, ArangoDB, or any other graph database in P0.

---

### ADR-003: No LangChain / LangGraph in P0

**Status:** LOCKED (implementation plan §5, decision 3)  
**Source:** Implementation plan §5 decision 3

**Decision:** Agents are plain Python classes implementing a shared `BaseAgent` interface. The custom orchestrator routes to exactly one specialist agent per turn in P0.

**Rationale:** LangGraph adoption is justified only if workflow state, branching, persistence, retries, human approval, and execution resumption grow complex enough that maintaining the custom orchestrator becomes harder than adopting LangGraph — not merely because it is an agent framework. That threshold is not met in P0.

**Consequences:**
- The `BaseAgent.execute()` template-method shape is deliberately designed so a LangGraph node can wrap it later without changing the interface's public shape (evolution seam preserved).
- `Orchestrator.route()` signature maps onto a LangGraph conditional edge function (evolution seam preserved).
- P0 orchestrator is proven against the Requirements Agent alone before other agents are wired in.

**Do not build:** LangChain, LangGraph, or any agent orchestration framework in P0.

---

### ADR-004: No Vector Database / RAG

**Status:** LOCKED (implementation plan §5, decision 4)  
**Source:** Implementation plan §5 decision 4; SRS §4.2

**Decision:** Context retrieval for agents is deterministic Firestore reads filtered by `project_id` and entity type, not embedding search. The P0 change-impact explanation is a single Gemini call over already-known affected entities — not a retrieval system.

**Rationale:** RAG adds infrastructure complexity (embedding model, vector index, retrieval pipeline) with no demonstrated P0 benefit. Firestore filtering over a user's own project entities is sufficient for P0 context retrieval. The selective context requirement (NFR-008, NFR-019) is satisfied by each agent declaring its own entity needs as a static class attribute.

**Consequences:** `impact_explainer.py` (Account 3) never re-derives the affected entity set — it only explains the set handed to it by `traversal.py` (Account 4).

**Do not build:** vector databases, embeddings, RAG pipelines, or semantic search in P0.

---

### ADR-005: No Sandboxed Code Execution

**Status:** LOCKED (implementation plan §5, decision 5)  
**Source:** Implementation plan §5 decision 5

**Decision:** The Review Agent (P1) reads supplied text/diffs; it does not execute code.

**Rationale:** Sandboxed execution introduces significant security surface area. P0 review is text-analysis only.

---

### ADR-006: Single Model Provider — Gemini Only in P0

**Status:** LOCKED (implementation plan §5, decision 6)  
**Source:** Implementation plan §5 decision 6

**Decision:** P0 uses Gemini exclusively. All agents use `ModelClient` (never `GeminiProvider` or the Gemini SDK directly).

**Rationale:** `ModelClient` abstraction exists early — before the first agent is written — so P2 multi-model routing can be added without touching any agent's `run()` body.

**Consequences:**
- `GeminiProvider` is the only file in the codebase that imports the Gemini SDK directly.
- `ClaudeProvider` / `OpenAIProvider` / model routing are P2.

---

### ADR-007: Firebase Admin SDK from Backend Only

**Status:** LOCKED (implementation plan §5, decision 7)  
**Source:** Implementation plan §5 decision 7; SRS §5.4

**Decision:** The frontend uses the Firebase client SDK for authentication only (sign-in, ID token retrieval). All Firestore reads/writes go through the FastAPI backend using the Admin SDK. The frontend never performs a Firestore read or write directly.

**Rationale:** This centralizes all authorization enforcement in the backend where the Admin SDK bypasses Firestore Rules, making backend authorization dependencies (A-002, A-003) the only real security boundary. It also ensures Gemini credentials never reach the frontend.

**Consequences:**
- Frontend has no Firestore SDK dependency beyond Firebase Auth.
- All project data is served through the FastAPI API layer, which enforces ownership checks.

---

### ADR-008: Synchronous Request/Response for Agent Calls in P0

**Status:** LOCKED (implementation plan §5, decision 8)  
**Source:** Implementation plan §5 decision 8

**Decision:** An agent call is a single HTTP request that blocks until Gemini responds and validation completes. No background job queue in P0.

**Rationale:** Deliberate P0 simplification. The risk (Gemini latency causing UI timeout) is mitigated by the chat UI showing a "thinking" state immediately on request send, independent of backend latency (implementation plan §32).

**Consequences:** Very long Gemini responses may hit load balancer timeouts. This is an accepted P0 risk. Async job queue (Cloud Tasks or similar) is a post-competition evolution.

---

### ADR-009: Proposal/Approval Model — Human Approval for All Write Actions

**Status:** LOCKED (implementation plan §5, decision 10; §9.2)  
**Source:** Implementation plan §5 decision 10, §9.2; SRS §7, FR-028, FR-029

**Decision:** No agent writes directly to an authoritative entity repository. Every agent output is a `Proposal` envelope. In P0, all write-class actions (`LOW_IMPACT_WRITE`, `HIGH_IMPACT_WRITE`, `BULK_WRITE`) require explicit human confirmation before persistence. There is no automatic mutation of any kind in P0.

**Rationale:** This is the core safety invariant of NEXUS: the model may recommend an action, but it SHALL NOT be the authority that grants itself permission to execute that action. This boundary is enforced in application code (the approval transaction), not by the model.

**Consequences:**
- `LOW_IMPACT_WRITE` requires the same explicit-confirmation path as `HIGH_IMPACT_WRITE` in P0.
- Configurable auto-apply for `LOW_IMPACT_WRITE` is P1.
- The approval transaction (A-009/A-014) is scheduled early — as soon as `RepositoryBase` and the draft `Proposal` contract exist — and is developed against a hand-constructed fake `Proposal` before any real agent exists.

---

### ADR-010: Explicit File Ownership — One File, One Owner

**Status:** LOCKED (implementation plan §5, decision 11; §8)  
**Source:** Implementation plan §8

**Decision:** Every file is owned by exactly one account. No two accounts share write ownership of the same file.

**The one explicit exception in Account 1's domain:** `backend/firestore/trace_link_repo.py` is owned by Account 4 (not Account 1), despite being inside `backend/firestore/*`. Account 1 reviews it as a coordination point but never edits it.

**Frontend ownership boundary:**
- Account 2 owns all `frontend/app/*` files — all pages and page-level composition, including `architecture/page.tsx` and `impact/page.tsx`.
- Account 4 owns all `frontend/components/graph/*` files — reusable graph visualization components only. Account 4 never edits a `frontend/app/*` file.

---

### ADR-011: Firebase Token Verification — UID Always from Verified Token

**Status:** LOCKED (implementation plan §5, decision 12; §12)  
**Source:** Implementation plan §12; SRS §8

**Decision:** The authenticated UID is always derived from the verified Firebase ID token claims. Any UID supplied by the client in a request body is ignored. `require_authenticated_user()`, `require_project_access()`, and `require_resource_access()` always use the server-derived UID.

**Rationale:** Prevents forged-UID attacks (Threat T-01 in SRS §15.1). The security invariant "UID from token only" must hold everywhere.

---

### ADR-012: Google Cloud Secret Manager for Gemini Credential

**Status:** LOCKED (implementation plan §5, decision 13; §25)  
**Source:** Implementation plan §25; SRS §5, FR-006, FR-007

**Decision:** The Gemini API key is stored in Google Cloud Secret Manager under the naming convention `gemini-api-key-{env}`. The backend Cloud Run service account has `roles/secretmanager.secretAccessor` (scoped to this secret only). The key is never exposed to the frontend, never logged, and never stored in environment files committed to the repository.

**Consequences:** `backend/secrets/secret_manager.py` (Account 1, A-010) is the only file that retrieves the credential. An in-memory TTL cache is acceptable to avoid excessive Secret Manager calls.

---

### ADR-013: Cumulative CI — Full Suite on Every PR

**Status:** LOCKED (implementation plan §5, decision 14)  
**Source:** Implementation plan §5 decision 14, §27

**Decision:** Every PR runs the entire accumulated test suite, not just the tests introduced by that PR. A regression in cross-user isolation surfaces immediately even while work has moved on to later vertical slices.

---

### ADR-014: Static/Client-Rendered Next.js Frontend on Firebase Hosting

**Status:** LOCKED (implementation plan §5, decision 16; §26)  
**Source:** Implementation plan §5 decision 16, §26

**Decision:** The Next.js frontend is deployed as a static/client-rendered application to Firebase Hosting. FastAPI/Cloud Run is the only privileged backend. No Next.js server API routes, server-side privileged API handlers, or separate Next.js backend exist in P0.

**Rationale:** Prevents the anti-pattern of a second privileged backend inside Next.js that could inadvertently hold credentials or bypass the FastAPI authorization layer.

**Consequences:**
- Firebase Hosting serves static assets only. It never proxies to an application server.
- Firebase Hosting never holds the Gemini credential.
- Firebase Hosting never performs an Admin SDK write.
- All privileged operations go through Cloud Run/FastAPI.

---

### ADR-015: Five P0 Specialist Agents — Review Agent is P1

**Status:** LOCKED (implementation plan §6)  
**Source:** Implementation plan §6

**Decision:** P0 has exactly five specialist agents: Requirements, Architecture, Planning, Testing, Risk. The Review Agent is P1. It is speced, its interface exists as a stub (`review_agent.py` returning 501), but it is not implemented, not exercised in the demo path, and not a dependency of anything in P0.

**Rationale:** Implementation plan §6 corrects SRS ambiguity. The SRS §7 mentions a Review Agent; the implementation plan v2.0 explicitly makes it P1 to protect the competition demo timeline.

---

### ADR-016: P0 Change Impact Analysis — Both Deterministic Traversal AND Gemini Explanation

**Status:** LOCKED (implementation plan §18)  
**Source:** Implementation plan §4, §18, §9.7 item 10

**Decision:** P0 change impact analysis includes both (a) deterministic graph traversal (`traversal.py`, Account 4) that identifies what is connected, and (b) a lightweight Gemini semantic explanation (`impact_explainer.py`, Account 3) that explains why those connections matter. Both halves are P0. The `explanation: str` field in the `ImpactAnalysis` response is a P0 field, not a P1 addition.

**Rationale:** "Deterministic-now, AI-later" was the v1.0 plan. v2.0 makes the Gemini explanation P0 because it is a core competition demo differentiator.

**Separation of concerns:** `traversal.py` never calls Gemini. `impact_explainer.py` never re-derives the affected set — it only explains a set it is handed.

---

### ADR-017: Approval Transaction Atomicity Invariant

**Status:** LOCKED (implementation plan §13.5)  
**Source:** Implementation plan §13.5

**Decision:** The approval operation is atomic with respect to (a) proposal approval state, (b) entity persistence, (c) trace links, (d) project version increment, and (e) audit event creation. All five succeed together or none are persisted. This is enforced by executing all five writes inside a single Firestore transaction in `ApprovalService`.

**Consequences:**
- `RepositoryBase` exposes transaction-aware `create()` and `update()` methods that accept an optional `transaction` parameter.
- No repository implements a second, transaction-unaware write path.
- A mandatory concurrency test (two concurrent approvals against the same stale-version proposal) is a precondition for considering A-009/A-014 done.

---

### ADR-018: Conversation Persistence is Account 1's Repository

**Status:** LOCKED (implementation plan §8.1, A-008b)  
**Source:** Implementation plan §8.1

**Decision:** `backend/firestore/conversation_repo.py` (creating conversations, appending messages, retrieving history, user/project-isolated queries) is owned and implemented by Account 1. Account 3 (chat endpoint C-013) calls into this repository but does not own it. C-013 is not considered complete until it is wired to `conversation_repo.py`.

**Rationale:** Preserves the one-file-one-owner rule and keeps persistence concerns inside Account 1's ownership boundary.

---

### ADR-019: Gemini Smoke Test is Not a Temporary Chat Architecture

**Status:** LOCKED (implementation plan §16.3)  
**Source:** Implementation plan §16.3

**Decision:** `backend/api/smoke_test.py` (C-002b) is a temporary connectivity check that is deleted — not deprecated — once C-013 lands. It must never accumulate conversation state, history, or project awareness.

**Rationale:** If the smoke-test endpoint accumulates state or project context, it becomes a second, undocumented chat architecture running alongside the real one — a critical architectural violation.

---

### ADR-020: Action Identity and Proposal Collection Alignment (`actionId == proposalId`)

**Status:** LOCKED (implementation plan §9.2, §11, §13.5; SRS §7)  
**Source:** Implementation plan §9.2, §11, §13.5; SRS §7

**Decision:** `actionId` in API routes (`/api/projects/{projectId}/actions/{actionId}/approve` and `/reject`) corresponds 1:1 with `proposal_id`. An Action in the API is the resource representation of an unapproved or pending `Proposal`. There is no separate `actions` collection or persistence entity; `proposals/{proposalId}` in Firestore is the sole backing store.

**Rationale:** Eliminates redundant data structures and synchronization bugs while preserving intuitive user-facing REST semantics.

**Consequences:**
- Backend approval routes lookup directly in `proposals/{actionId}`.
- No separate `actions` database collection is created.
- Frontend calls `/actions/{proposal.proposal_id}/approve`.

---

### ADR-021: Conversation and Message Model Fields

**Status:** LOCKED (implementation plan §8.1, §11, §16.3; SRS Appendix B)  
**Source:** Implementation plan §8.1 (A-008b), §11, §16.3; SRS Appendix B

**Decision:**
- `Conversation` document carries `conversation_id: str`, `project_id: str`, `title: str | None = None` (optional thread summary for UI listings), `created_at: datetime`, and `updated_at: datetime`. Denormalized counters (`message_count`) are excluded in P0.
- `Message` document carries `message_id: str`, `conversation_id: str`, `project_id: str`, `role: Literal["user", "assistant"]`, `content: str`, `proposal_ids: list[str] = []` (IDs of `Proposal` envelopes generated during this turn), and `created_at: datetime`.

**Rationale:** Provides the minimal schema necessary for Account 2 (UI thread view) and Account 3 (context retrieval and proposal backreferences) without requiring complex atomic counter maintenance on message append.

---

### ADR-022: Agent Invocation Hierarchy — Multi-turn Chat as Primary Interface with Supporting Direct Endpoints

**Status:** LOCKED (implementation plan §6, §16.3; SRS §7, Appendix C)  
**Source:** Implementation plan §6, §16.3; SRS §7, Appendix C

**Decision:**
- Multi-turn Chat (`POST /api/projects/{projectId}/chat`) is the primary P0 user-facing interaction flow, routed dynamically by the Orchestrator to the appropriate specialist agent.
- Direct agent-trigger endpoints (`POST /api/projects/{projectId}/requirements/analyze`, `/architecture/analyze`, `/planning/analyze`, `/tests/generate`, `/risks/analyze`) are `P0 — Supporting` endpoints used for dedicated single-domain UI triggers (e.g. "Re-analyze" buttons) and direct integration testing.
- Both invocation mechanisms use the exact same underlying specialist agent execution pipeline and return the standard Proposal envelope (`proposals[]`).

**Rationale:** Clarifies the integration boundary for Account 2 (frontend) and Account 3 (agent routes), allowing parallel development of the primary conversational flow and individual feature pages.

---

### ADR-023: Wire Format Serialization (camelCase) and TypeScript Contract Mirroring

**Status:** LOCKED (implementation plan §9.1, §9.5)  
**Source:** Implementation plan §9.1, §9.5

**Decision:**
- Backend models in Python use canonical `snake_case` field names and Pydantic V2 `model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, serialize_by_alias=True)`.
- All JSON request and response payloads at the API wire boundary use `camelCase` exclusively.
- Frontend TypeScript contracts in `frontend/lib/contracts/*.ts` mirror the models field-for-field in `camelCase`.

**Rationale:** Eliminates contract drift between Python backend and TypeScript frontend while adhering to Pythonic and idiomatic JavaScript/TypeScript conventions.

---

### ADR-024: Risk Score Computation Formula

**Status:** LOCKED (implementation plan §9.1; SRS §9.2, FR-024, FR-025)  
**Source:** Implementation plan §9.1; SRS §9.2, FR-024, FR-025

**Decision:** `Risk.score` is computed server-side in Python as the integer product `likelihood_value * impact_value`, where:
- `likelihood`: `low` = 1, `medium` = 2, `high` = 3
- `impact`: `low` = 1, `medium` = 2, `high` = 3, `critical` = 4
Resulting in an integer score from 1 to 12. Client-supplied scores are unconditionally ignored.

**Rationale:** Unblocks evaluation fixtures (E-001) and Risk Agent prompt validation with a deterministic, standardized formula.

---

### ADR-025: Proposal Expiry and Stale Version Policy in P0

**Status:** LOCKED (implementation plan §9.2, §13.5)  
**Source:** Implementation plan §9.2, §13.5

**Decision:** In P0, proposal validity is governed lazily at approval time by optimistic concurrency control (`proposal.project_version_at_creation == project.version`). If the project version has advanced, `ApprovalService` aborts the transaction with `409 STALE_VERSION`. There is no asynchronous background TTL expiration worker in P0. The `"expired"` status value remains reserved in the enum for P1.

**Rationale:** Avoids unnecessary infrastructure (background workers/schedulers) while providing 100% safety against applying stale proposals.

---

## 2. Open Decisions / Unresolved Ambiguities

**Status:** ALL INTEGRATION-BLOCKING DECISIONS RESOLVED.

There are no remaining open decisions blocking Phase 0 implementation. All core models, endpoint contracts, invocation paths, serialization standards, and approval transaction invariants are locked in Section 1 (ADR-001 through ADR-025).

---

## 3. Change History

| Date | Change | Author |
|---|---|---|
| 2026-09-05 | Initial population from SRS v1.0 and Implementation Plan v2.0 | Human Integration Owner |
| 2026-09-05 | Phase 0 contract finalization: Resolved OPEN-001 through OPEN-006 into ADR-020 through ADR-025; locked wire format, conversation schema, agent invocation hierarchy, and actionId == proposalId identity. | Human Integration Owner |

---

## 4. Process — Adding a New Entry

When a new architectural decision is made after this document's initial population:

1. Add an entry to Section 1 (if decided) or Section 2 (if still open).
2. Use the `ADR-NNN` or `OPEN-NNN` numbering scheme.
3. Include: Status, Source document reference, Decision text, Rationale, Consequences, and Date.
4. If the decision changes a frozen contract, follow the §9.6 process in the implementation plan: written note here → human integration owner approval → version bump in the changed file → run `scripts/find_contract_usages.py`.
