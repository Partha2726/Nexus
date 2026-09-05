# NEXUS Implementation Plan v2.0
### From SRS v1.0 to a Parallelized, Competition-Ready Vertical Slice — Corrected for Fast Parallel Implementation

---

## 1. Executive Summary

This plan converts NEXUS SRS v1.0 into an executable, parallel-friendly implementation plan for a team of **5 Claude coding accounts plus one human integration owner**. It does not change the product: Next.js/TypeScript frontend, Python/FastAPI backend, Firebase Auth, Firestore, Gemini API, Google Cloud Secret Manager, Cloud Run, React Flow, Pydantic, and a custom agent orchestration layer are all treated as fixed and correct.

This is v2.0 of the plan. It is a correction pass over v1.0, not a redesign — the product scope, SRS intent, architecture, and terminology are preserved wherever they were already right. Ten specific defects were found in v1.0 during an engineering audit and are fixed here. The most important, because it changes the actual execution strategy rather than just wording, is this: **v1.0 organized work around phases that gated each other; v2.0 organizes work around vertical slices that each produce a demoable, end-to-end NEXUS.** Phases still exist as a documentation view (Section 30), but they no longer define when a workstream is allowed to start.

Four structural decisions carry the rest of the plan:

1. **Contracts before merge, not contracts before code.** Pydantic models, TypeScript interfaces, Firestore schemas, and API request/response shapes are drafted in Phase 0 by the human integration owner before parallel work starts. But "drafted and versioned" is enough to start independent development against mocks — "frozen and merged" is only required before code merges into the integration branch. v1.0's stricter reading ("nothing starts until Phase 0 is completely finished") is corrected here (Section 2, Section 9).
2. **P0 is a real vertical slice with exactly five specialist agents, not six.** v1.0 contained contradictory language claiming "all 6 agents" are P0 while its own task tables only ever specified five P0 agents (Requirements, Architecture, Planning, Testing, Risk) plus a stubbed, explicitly-P1 Review Agent. v2.0 makes this consistent everywhere: **P0 = five specialist agents. Review is P1.** (Section 6).
3. **Five coding accounts, one human integration owner — not six coding workstreams.** The human is not a sixth pair of hands writing application code. The human owns architecture decisions, canonical contracts, cross-account conflict resolution, merge review, integration testing, demo acceptance, and scope control (Section 7).
4. **The proposal/approval transaction and the P0 semantic impact explanation are core P0 primitives, built early, not appended late.** The approve/reject transaction is scheduled against a hand-built fake proposal as early as the repository foundation allows (Section 13), and deterministic change-impact traversal is paired with a lightweight Gemini explanation as a single P0 feature from the start (Section 18) — not a "deterministic now, AI later" split.

---

## 2. Implementation Philosophy

**Vertical slices, not phase gates.** The real execution strategy is four vertical slices (Sections 19–22), each of which is independently demoable end-to-end. Phases (Section 30) remain useful as a documentation/scheduling view and for gate tracking, but no task in this plan waits for "Phase N to fully complete" — it waits for the specific upstream task(s) it actually needs, which is almost always much earlier than an entire phase.

**Mock-first, contract-disciplined.** The rule that governs everything in this plan is:

> Canonical contracts must be respected before integration/merge. Independent development may proceed against explicitly versioned mock/provisional contracts at any time. No work may merge into the integration branch unless it conforms to the current canonical contracts.

This is a strictly better version of v1.0's Phase 0 gate: it keeps contract-first architecture (nobody merges against a contract that later changes underneath them) while removing the artificial idle time v1.0 created by blocking *all* development, even mocked development, until every contract was perfect.

**Runtime dependencies are not the same as implementation parallelism.** It is entirely correct for five Claude accounts to build five agents in parallel as files. It is not correct to claim the *running system* has no dependency order between them. This plan states the real runtime chain explicitly (Section 16) so nobody designs against a false assumption of total independence.

**One file, one owner.** Every task below names the exact file(s) it creates or edits and the account that owns them. Two accounts are never assigned write ownership of the same file. Where two accounts both need to *read* a contract, that contract is drafted first (Sections 9–10) so reading it never causes conflicts.

**Simplicity is a P0 requirement, not a P0 shortcut.** No graph database, no vector database, no RAG, no LangGraph, no microservices, no multi-model routing, no sandboxed execution, and no autonomous multi-agent loops appear in P0. Every one of these is preserved as an explicit, seam-based post-competition evolution path (Section 34), not deleted from the plan's ambition — just kept out of the demo-critical path.

---

## 3. Scope and Non-Goals

### In scope for P0 (see Section 33 for the full table)
Firebase Auth, user-isolated Firestore, Secret Manager credential retrieval, multi-turn Gemini interaction, five specialist agents behind a `ModelClient` abstraction, a custom lightweight orchestrator, the proposal/approval transaction, audit trail, deterministic change-impact traversal **plus** a lightweight Gemini semantic explanation of that impact, traceability graph visualization, and the full security/CI/deployment/demo apparatus.

### Explicitly out of scope for P0 (do not build, do not stub with real logic)
- Review Agent (real implementation) — P1, stub only.
- Artifact upload / repository import — P1/P2.
- Graph database, vector database, RAG, LangGraph, MCP, sandboxed code execution, multi-model routing, microservices, Kubernetes, autonomous multi-agent coding loops — all P2 or later, and all explicitly *not* required by anything in this plan's P0 path.
- Multi-agent fan-out (a single chat message triggering more than one agent in one turn) — P1.

### Non-goals forever (not just "later")
NEXUS P0 is a single-tenant-per-user tool. Team roles, multi-user project collaboration, and cross-organization sharing are P2 ambitions this plan does not design toward beyond noting the contract seam that would make them possible (Section 34).

---

## 4. Architecture Overview

```
User/project intent
    ↓
Requirements  →  Architecture  →  Implementation planning  →  Testing  →  Risk/security analysis  →  Code review (P1)
    ↕                ↕                    ↕                     ↕              ↕                          ↕
                          Traceability Graph (Firestore TraceLinks)
```

Product behavior, unchanged from SRS intent:

```
A project artifact changes
    ↓
NEXUS identifies affected entities (deterministic graph traversal)
    ↓
NEXUS explains why they are affected (lightweight Gemini semantic call — P0)
    ↓
NEXUS proposes what should be reviewed/changed
    ↓
Human approves/rejects the proposal
    ↓
Approved changes are persisted and audited
```

Core artifact chain, unchanged:

```
SRS → Architecture Blueprint → Implementation Plan → Code → Evaluation → Demo
```

System shape:

```
Next.js frontend (Firebase client SDK: auth only)
        ↓ HTTPS + Firebase ID token
FastAPI backend (modular monolith)
   ├── auth/            verified UID, project ownership
   ├── firestore/        repositories, one per entity
   ├── secrets/           Secret Manager credential retrieval
   ├── agents/            ModelClient → GeminiProvider → BaseAgent → 5 specialist agents → Orchestrator
   ├── graph_model/       TraceLinks, deterministic traversal, impact service (+ Gemini explanation)
   ├── api/               route handlers, one module per domain
   └── observability/     structured logging, request IDs
        ↓ Admin SDK
Firestore (per-user, per-project isolated documents)
        ↕
Google Cloud Secret Manager (Gemini API key, Cloud Run service account only)
```

**Deployment lock (see Section 5, decision 16, and Section 26):** the Next.js frontend above is deployed as a static/client-rendered application to Firebase Hosting. All privileged server-side operations occur in FastAPI/Cloud Run. No Next.js server API routes, server-side privileged API handlers, or separate Next.js backend are used in P0.

---

## 5. Core Architectural Decisions

Locked for the competition build. Changing any of these after the contracts are frozen requires a written entry in `docs/decision-log.md` and human integration owner approval.

1. **Modular monolith, not microservices.** One FastAPI app (`backend/`), one Next.js app (`frontend/`). Internal modularity comes from Python package boundaries, not network boundaries.
2. **No graph database.** The knowledge graph is materialized from `traceLinks` documents in Firestore and assembled into a graph shape in the API response layer (`GET /api/projects/{id}/graph`). React Flow renders whatever JSON shape the backend returns.
3. **No LangChain/LangGraph in P0.** Agents are plain Python classes implementing a shared `BaseAgent` interface (Section 14). The interface is deliberately shaped so a LangGraph node can wrap it later without changing the interface's public shape (Section 34). LangGraph is adopted later only if workflow state, branching, persistence, retries, human approval, and execution resumption grow complex enough that maintaining the custom orchestrator becomes harder than adopting LangGraph — not merely because it is an agent framework.
4. **No vector database / RAG.** Context retrieval for agents is deterministic Firestore reads filtered by project ID and entity type, not embedding search. The P0 change-impact "why" explanation (Section 18) is a single Gemini call over already-known affected entities and their metadata — not a retrieval system.
5. **No sandboxed code execution.** The Review Agent (P1) reads supplied text/diffs; it does not execute code.
6. **Single model provider: Gemini only in P0.** Behind a small `ModelClient` abstraction (Section 15) so agents never call the Gemini SDK directly.
7. **Firebase Admin SDK from backend only.** The frontend uses the Firebase client SDK for auth *only* (sign-in, ID token retrieval). All Firestore reads/writes in the demo path go through the FastAPI backend using the Admin SDK.
8. **Synchronous request/response for agent calls in P0.** No background job queue. An agent call is a single HTTP request that blocks until Gemini responds and validation completes — a deliberate P0 simplification (latency mitigation in Section 32).
9. **Contract-first architecture, mock-first development.** Canonical contracts are drafted early and frozen at merge time; independent development proceeds against versioned mocks in the meantime (Section 2, Section 9).
10. **Proposal/approval model with human approval for consequential changes.** No agent writes directly to authoritative project state (Section 13).
11. **Explicit file ownership.** No two accounts share write ownership of a file (Section 8).
12. **Security-first Firebase token verification; backend authorization is the real Admin SDK security boundary** (Section 12).
13. **Google Cloud Secret Manager** for the Gemini credential, never exposed to the frontend (Section 25).
14. **Cumulative CI.** Every PR runs the full test suite accumulated so far, not just its own new tests (Section 27).
15. **Demo-driven acceptance gates** (Section 27).
16. **Static/client-rendered Next.js frontend on Firebase Hosting, FastAPI/Cloud Run is the only privileged backend.** The Next.js frontend is deployed as a static/client-rendered application to Firebase Hosting. All privileged server-side operations occur in FastAPI/Cloud Run. No Next.js server API routes, server-side privileged API handlers, or separate Next.js backend are used in P0 (Section 26).

**Do not add to P0**, regardless of how tempting it looks mid-implementation: microservices, Kubernetes, a graph database, a vector database, RAG, LangGraph, MCP, sandboxed code execution, additional model providers, complex autonomous coding loops, or a second backend inside Next.js (server API routes or server-side privileged handlers — decision 16 above). All remain valid future evolution items (Section 34).

---

## 6. Five-Agent P0 Model

**P0 has exactly five specialist agents. There is no sixth P0 agent.**

1. Requirements Agent
2. Architecture Agent
3. Planning Agent
4. Testing Agent
5. Risk Agent

**The Review Agent is P1.** It is speced, its interface exists as a stub (`review_agent.py` returning a `501` from its endpoint), but it is not implemented, not exercised in the demo path, and not a dependency of anything in P0.

This corrects v1.0, which stated in its Executive Summary that "P0 includes all 6 agents" while its own Workstream C task table (now Account 3, Section 8.3) only ever specified five real P0 agent tasks plus one explicit P1 stub task. The five-agent table below is the single source of truth; every other section of this document that mentions agent count must match it.

| Agent | Priority | Input | Output | Mutation class |
|---|---|---|---|---|
| Requirements | P0 | user message / conversation | `list[Requirement]` (status=proposed) + unresolved questions | PROPOSE |
| Architecture | P0 | approved requirements | `list[Component]` + relationship hints | PROPOSE |
| Planning | P0 | approved requirements/components | `list[Task]` | PROPOSE |
| Testing | P0 | approved requirements | `list[TestCase]` | PROPOSE |
| Risk | P0 | project state snapshot | `list[Risk]` | PROPOSE |
| Review | **P1** | supplied artifact/diff | findings list | READ |

Standard phrasing used consistently throughout this document and in all account-facing task descriptions: *"Five P0 specialist agents: Requirements, Architecture, Planning, Testing, and Risk. Review is a P1 extension."*

---

## 7. Human Integration Owner

There is one human integration owner and five Claude coding accounts. This is not a six-way split of coding work — the human does not own a normal coding workstream at all.

```
Human Integration Owner
    ↓
Architecture decisions · canonical contracts · cross-account conflict resolution · merge review ·
integration testing · final acceptance · demo flow · scope control
```

Responsibilities:

- **Draft and freeze canonical contracts** (Section 9) — Pydantic models, TypeScript mirrors, API envelope, Firestore schema shape.
- **Resolve cross-account conflicts** — schema disagreements, API shape disputes, ambiguous file ownership.
- **Review every merge** — specifically for (a) did this PR touch only files it owns, and (b) does it match the frozen contract shapes it depends on. Domain correctness (is the Requirements Agent's prompt good) is each account's own responsibility — the human cannot deeply review five agents' worth of domain logic without becoming the bottleneck the parallel structure exists to avoid.
- **Integration testing** — runs the cumulative test suite across account boundaries, catches contract drift.
- **Demo flow and acceptance** — owns `docs/demo-script.md`, rehearses the demo, decides when a gate is truly met.
- **Scope control** — is the single person authorized to say "that's P1, not P0" when an account is tempted to over-build.

The human integration owner does **not**: write application feature code inside `backend/agents/`, `backend/graph_model/`, or any `frontend/app/` page; own a P0 feature deliverable the way Accounts 1–5 do; or act as a sixth parallel implementer.

---

## 8. Parallel Workstreams (5 Claude Accounts)

Five Claude coding accounts, each with non-overlapping file ownership (this document keeps the original per-file `A-`/`B-`/`C-`/`D-`/`E-` task-ID prefixes from v1.0 for traceability — they map one-to-one onto Accounts 1–5 below).

```
Account 1 — Backend + Firebase           (was Workstream A)
Account 2 — Frontend                     (was Workstream B)
Account 3 — AI / Gemini / Agents         (was Workstream C)
Account 4 — Knowledge Model / Traceability (was Workstream D)
Account 5 — Security + Infrastructure + QA (was Workstream E)
```

### 8.1 Account 1 — Backend + Firebase

**Owns:** `backend/auth/`, `backend/firestore/*` **EXCEPT `backend/firestore/trace_link_repo.py`** (including `repository_base.py` and `conversation_repo.py`), `backend/services/approval_service.py`, `backend/secrets/`, `backend/config.py`, `backend/api/projects.py`, `backend/api/decisions.py` (CRUD only), `backend/api/actions.py`, `backend/api/audit.py`, `firestore/*`.

**Explicit exception:** `backend/firestore/trace_link_repo.py` is the sole exception inside `backend/firestore/`. Account 4 is its sole writer (Section 8.4); Account 1 reviews it as a coordination point but never edits it. This is the one-file-one-owner boundary for the trace-link repository — Account 1's ownership of `backend/firestore/*` stops at this one file.

**Does not own:** anything under `backend/agents/`, `backend/graph_model/`, `backend/domain/models/` (contracts — human integration owner owns), any frontend file.

**Depends on:** draft contracts (Section 9) — may start against a provisional/mock version before freeze; must reconcile before merge.

**Must expose:** `auth.dependencies.get_current_user`, `auth.dependencies.require_project_access`, `firestore.repository_base.RepositoryBase`, `secrets.secret_manager.get_gemini_credential()`.

| Task ID | Description | Deps | Complexity | Files | Mock-first note |
|---|---|---|---|---|---|
| A-001 | Firebase Admin SDK init | draft contracts | S | `backend/auth/firebase.py` | Can stub against a fake service account locally |
| A-002 | Verify Firebase ID token, derive UID server-side, reject client-supplied UID | A-001 | M | `backend/auth/firebase.py`, `dependencies.py` | Not mockable — this is the real security boundary; build against real emulator early |
| A-003 | `require_authenticated_user()` / `require_project_access()` / `require_resource_access()` — derive UID exclusively from verified token claims | A-002, A-005 | M | `backend/auth/dependencies.py` | — |
| A-004 | Config/env loading | — | S | `backend/config.py` | Yes |
| A-005 | `RepositoryBase` generic CRUD + ownership-scoped queries | draft contracts | M | `backend/firestore/repository_base.py` | Can build against Firestore emulator immediately |
| A-006 | `project_repo.py` + project CRUD endpoints | A-005 | M | `backend/firestore/project_repo.py`, `backend/api/projects.py` | — |
| A-007 | `decision_repo.py` + Decision Ledger CRUD | A-005 | S | `backend/firestore/decision_repo.py`, `backend/api/decisions.py` | — |
| A-008 | `audit_repo.py` + audit list endpoint | A-005 | S | `backend/firestore/audit_repo.py`, `backend/api/audit.py` | — |
| **A-008b** | **Conversation/message repository + conversation persistence** — creating conversations, retrieving conversations, appending messages, retrieving conversation history, user/project-isolated queries, authorization-compatible repository access (calls through `require_project_access`), ordered timestamps, Firestore-safe document structure for `conversations/{conversationId}/messages/{messageId}` | A-005 | M | `backend/firestore/conversation_repo.py` | Can build against the Firestore emulator with fixture conversations before C-013 (chat API) exists; Account 3 calls this repository, Account 1 owns it |
| **A-009** | **Approve/reject transaction — moved to the earliest possible point in the critical path (Section 13)** | A-005, draft Proposal contract | L | `backend/api/actions.py`, `backend/services/approval_service.py`, `backend/firestore/repository_base.py`, `backend/firestore/*_repo.py` (transaction-aware `create()`/`update()` calls) | **Start against a hand-constructed fake `Proposal` before any real agent exists.** See Section 13.4 for the transaction-aware repository pattern and `ApprovalService`. |
| A-010 | Secret Manager client, in-memory credential cache with TTL | A-004 | M | `backend/secrets/secret_manager.py` | Real GCP project needed; stub credential acceptable for pure unit tests |
| A-011 | Firestore Security Rules | draft contracts | M | `firestore/firestore.rules` | — |
| A-012 | Firestore indexes (revisit once Account 3's query patterns exist) | A-006+ | S | `firestore/firestore.indexes.json` | — |
| A-013 | Dashboard aggregation endpoint | A-006, all repos | M | `backend/api/projects.py` or `dashboard.py` | — |
| A-014 | Optimistic concurrency — `project.version` bump inside the A-009 transaction | A-009 | M | `backend/firestore/project_repo.py` | — |
| A-015 | Ensure no logging path ever serializes the Gemini credential or full project payloads | A-010, E-008 | S | `backend/secrets/secret_manager.py`, all `api/*.py` | — |

**Merge order:** A-001→A-004 first, then A-005 (blocks A-006–A-009), **A-009 scheduled early against a fake proposal — not last, not gated on all agents existing.**

### 8.2 Account 2 — Frontend

**Owns:** all frontend pages and page-level composition — the entirety of `frontend/app/*`, and `frontend/components/*` **except** `frontend/components/graph/*`. This includes routing, layouts, application-level UI integration, the chat UI, the dashboard UI, and composition of every domain page, including the architecture page and the impact page. Account 2 integrates Account 4's reusable graph components (e.g. `GraphCanvas`, `ImpactGraph`) into those pages; Account 2 does not own graph-rendering logic itself.

**Unambiguous rule (supersedes any other phrasing of frontend ownership elsewhere in this document):** Account 2 owns all frontend pages and page-level composition. Account 4 owns only `frontend/components/graph/*`, for reusable graph visualization components. Account 4 does not modify `frontend/app/*`, including `frontend/app/.../architecture/page.tsx` and `frontend/app/.../impact/page.tsx`.

**Does not own:** any backend file, `frontend/components/graph/*` (Account 4 owns), `frontend/lib/contracts/` (human integration owner owns, mirrors backend contracts).

**Must expose:** `lib/api-client.ts`, `components/proposals/ProposalCard.tsx`.

| Task ID | Description | Deps | Complexity | Files | Mock-first note |
|---|---|---|---|---|---|
| B-001 | Firebase client SDK init, Google sign-in | real Firebase project exists | S | `frontend/lib/firebase-client.ts` | — |
| B-002 | Login page + auth state provider + protected-route middleware | B-001 | M | `app/(auth)/login/page.tsx`, `middleware.ts` | Can build against mocked auth state before B-001 lands |
| B-003 | `api-client.ts` typed fetch wrapper | draft API contract, error contract | M | `lib/api-client.ts` | **Build against provisional contract + static JSON immediately — do not wait for backend endpoints to exist** |
| B-004 | Dashboard layout, "active project" indicator | B-002 | S | `app/(dashboard)/layout.tsx` | — |
| B-005 | Project list + create project UI | B-003 | S | `app/(dashboard)/projects/page.tsx` | Mock API responses |
| B-006 | Project dashboard page — counts widgets | B-003, A-013 | M | `app/(dashboard)/projects/[id]/page.tsx` | Mock counts |
| B-007 | AI Command Center chat UI — multi-turn | B-003 | L | `app/(dashboard)/projects/[id]/chat/page.tsx`, `components/chat/*` | Mock chat endpoint against static JSON |
| B-008 | `ProposalCard` — shared "AI proposal" visual component | draft Proposal contract | M | `components/proposals/ProposalCard.tsx` | Mock proposal objects |
| B-009 | High-impact-change preview/confirmation modal | B-008 | M | `components/proposals/ConfirmMutationModal.tsx` | — |
| B-010 | Requirements page — list, ambiguity flags, approve/reject | B-003, B-008 | M | `.../requirements/page.tsx` | — |
| B-011 | Planning page | B-003, B-008 | M | `.../planning/page.tsx` | — |
| B-012 | Decision Ledger page | B-003 | S | `.../decisions/page.tsx` | — |
| B-013 | Testing page | B-003, B-008 | M | `.../testing/page.tsx` | — |
| B-014 | Risk Center page | B-003, B-008 | M | `.../risks/page.tsx` | — |
| B-015 | Activity/Audit page | B-003, A-008 | S | `.../audit/page.tsx` | — |
| B-016 | Confidence/rationale explanation component | B-008 | S | `components/proposals/ConfidenceExplain.tsx` | — |
| B-018 | Architecture page composition — page shell, layout, and data wiring; integrates Account 4's `GraphCanvas`/reusable graph components | B-003, D-004 (component) | M | `app/.../architecture/page.tsx` | Coordinate the component interface with Account 4; scaffold against a fixture-driven stub of the component before D-004 lands |
| B-019 | Impact page composition — page shell, layout, and data wiring; integrates Account 4's `ImpactGraph` component and B-009's confirmation modal | B-003, B-009, D-008 (component) | M | `app/.../impact/page.tsx` | Coordinate the component interface with Account 4; scaffold against a fixture-driven stub of the component before D-008 lands |
| B-017 (P1) | Tablet responsive pass | all above | S | Tailwind review | — |

**Merge order:** B-001→B-003 land before any page is fully wired, but pages may be scaffolded against a mocked `api-client.ts` in parallel — this is Account 2's main internal parallelization lever and the concrete instance of the mock-first rule (Section 2). **B-018 and B-019 own their page files outright; Account 4 supplies only the reusable graph components those pages import (Section 8.4) — this is the one-file-one-owner boundary for the graph feature.**

### 8.3 Account 3 — AI / Gemini / Agents / Orchestration

**Owns:** `backend/agents/`, `backend/validation/`, `backend/api/chat.py`, `backend/api/requirements.py` (agent-trigger portion), `backend/api/architecture.py`, `backend/api/planning.py`, `backend/api/testing.py`, `backend/api/risks.py`.

**Does not own:** `backend/firestore/*_repo.py`, including `conversation_repo.py` (Account 3 calls into these; Account 1 owns and implements them — Section 13.4), `backend/domain/models/` (contracts).

**Must expose:** `agents.model_client.ModelClient`, `agents.base.BaseAgent`, `agents.orchestrator.Orchestrator.route()`, one route handler per agent-triggering endpoint.

| Task ID | Description | Deps | Complexity | Files | Mock-first note |
|---|---|---|---|---|---|
| C-001 | `ModelClient` abstraction (Section 15) — small interface agents depend on | draft contracts | S | `backend/agents/model_client.py` | **Built early, before any agent, per Section 15** |
| C-002 | `GeminiProvider` implementing `ModelClient` — wraps Gemini API, retry policy | C-001, A-010 (real) | M | `backend/agents/providers/gemini_provider.py` | Can build/test against a stubbed provider implementing the same interface before A-010 lands |
| **C-002b** | **Gemini smoke-test endpoint — a single, throwaway diagnostic route that proves frontend → Firebase auth → FastAPI → `ModelClient` → Gemini → response connectivity end-to-end. Not the chat API, not multi-turn, not project-aware. Exists only until C-013 lands, then is deleted.** | C-001, C-002, A-002 | S | `backend/api/smoke_test.py` (temporary; removed once C-013 lands) | **Build and validate this before the Requirements Agent exists — see Section 16.3.** No persistence, no conversation history, no Requirements Agent involvement. |
| C-003 | `BaseAgent` template method (`execute()`), `AgentInput`/`AgentOutput` | draft contracts, C-001 | M | `backend/agents/base.py` | — |
| C-004 | Context retrieval + minimization, per-agent declared entity needs | Account 1 repos (read-only) | M | `backend/agents/context.py` | Fixture project context usable before real repos exist |
| C-005 | Typed tool base + authorization-outside-Gemini enforcement decorator | draft contracts | M | `backend/agents/tools/base_tool.py` | — |
| C-006 | Concrete tools: RequirementCreate, ArchitectureUpdate, TaskCreate, TestCreate, RiskCreate, DecisionCreate, ProjectRead | C-005 | M | `backend/agents/tools/*.py` | — |
| **C-007** | **Requirements Agent — the one real agent the first runtime slice depends on (Section 16)** | C-002, C-003, C-004, C-006 | L | `backend/agents/requirements_agent.py` | Fixture-based Gemini responses during iteration |
| C-008 | Architecture Agent | C-002, C-003, C-004, C-006 | L | `backend/agents/architecture_agent.py` | — |
| C-009 | Planning Agent | C-002, C-003, C-004, C-006 | M | `backend/agents/planning_agent.py` | — |
| C-010 | Testing Agent | C-002, C-003, C-004, C-006 | M | `backend/agents/testing_agent.py` | — |
| C-011 | Risk Agent | C-002, C-003, C-004, C-006 | M | `backend/agents/risk_agent.py` | — |
| C-012 | Orchestrator — P0 single-agent routing, built to work with Requirements Agent alone first (Section 16) | C-003, C-007 | M | `backend/agents/orchestrator.py` | — |
| C-013 | `POST /chat` — multi-turn conversation endpoint. Orchestrates the Requirements Agent (and later specialists) via C-012, builds Gemini context from conversation history, and calls Account 1's `conversation_repo.py` (A-008b) to persist and retrieve messages. Account 3 owns chat orchestration and the Gemini interaction; Account 1 owns the persistence the orchestration calls into. | C-012, A-008b | L | `backend/api/chat.py` | — |
| C-014 | `schema_validator.py` — wraps Pydantic validation, classifies failure type | draft contracts | S | `backend/validation/schema_validator.py` | — |
| C-015 | Route handlers wiring each agent to its endpoint | C-007–C-011 | M | `backend/api/requirements.py`, `architecture.py`, `planning.py`, `testing.py`, `risks.py` | Per-endpoint as each agent completes |
| C-016 | **Lightweight Gemini semantic impact explanation (P0)** — one call over affected-entity context from Account 4's traversal | C-002, D-005 | M | `backend/agents/impact_explainer.py` | See Section 18 |
| C-017 (P1) | Review Agent — stub only, returns 501 | — | S | `backend/agents/review_agent.py` | Explicitly out of P0 critical path |

**Merge order:** C-001→C-006 are the shared foundation, with **C-002b (Gemini smoke test) validated as soon as C-001/C-002 land — before C-007 exists, and independently of it.** **C-007 (Requirements Agent) must exist before C-012 (Orchestrator) is meaningfully testable, and C-012 — together with A-008b (Account 1's conversation persistence, owned outside this table) — must exist before C-013 (chat endpoint) is complete; this is a real runtime chain, not an artifact of file ownership (Section 16).** C-002b's smoke-test route is retired once C-013 lands; it is never allowed to grow into a second, parallel chat implementation. Once C-001–C-006 land, C-008–C-011 are fully parallelizable across separate accounts/sessions since each touches only its own file — but note this is implementation parallelism, not a claim that the running system treats them as independent (Section 16).

### 8.4 Account 4 — Knowledge Model / Traceability / Graph UI

**Owns:** `backend/graph_model/*`, `backend/api/graph.py`, `backend/api/impact.py`, `backend/firestore/trace_link_repo.py` (the sole exception carved out of Account 1's `backend/firestore/*` ownership — Section 8.1), `frontend/components/graph/*` — and nothing else on the frontend. Account 4 builds reusable graph UI components such as `GraphCanvas`, `GraphNode`, `GraphEdge`, `ImpactGraph`, and `ImpactNode`.

**Does not own, and must not modify:** `frontend/app/*` in any form, including `frontend/app/.../architecture/page.tsx` and `frontend/app/.../impact/page.tsx` (Account 2 owns these — Section 8.2). Account 4 delivers components; Account 2 integrates them into pages. Every other file under `backend/firestore/*` (Account 1 owns these — `trace_link_repo.py` is the only one Account 4 writes). Account 1 reviews `trace_link_repo.py` as a coordination point but never edits it — this is a review relationship, not shared write ownership.

**Must expose:** `graph_model.graph_assembler.assemble_graph(project_id) -> dict`, `graph_model.impact_service.analyze_impact(project_id, entity_id) -> ImpactResult` (now includes the Gemini explanation, Section 18).

| Task ID | Description | Deps | Complexity | Files | Mock-first note |
|---|---|---|---|---|---|
| D-001 | `trace_link_repo.py` | A-005 | S | `backend/firestore/trace_link_repo.py` | Can build against fixture nodes/edges |
| D-002 | `graph_assembler.py` — nodes/edges JSON from components + traceLinks | D-001 | M | `backend/graph_model/graph_assembler.py` | — |
| D-003 | `GET /api/projects/{id}/graph` | D-002 | S | `backend/api/graph.py` | — |
| D-004 | `GraphCanvas`/`GraphNode`/`GraphEdge` — reusable React Flow graph components (component only, no page) | D-003 (mockable) | L | `frontend/components/graph/GraphCanvas.tsx`, `GraphNode.tsx`, `GraphEdge.tsx` | **Build against hand-authored fixture JSON before D-003 exists.** Account 2's B-018 imports this component into the architecture page. |
| D-005 | Deterministic traversal — bounded-depth dependency/implementation walk | D-001 | L | `backend/graph_model/traversal.py` | This is the metric-bearing task for impact precision/recall |
| D-006 | `impact_service.py` — orchestrates deterministic traversal **and** invokes C-016's Gemini explanation (P0, both halves) | D-005, C-016 | M | `backend/graph_model/impact_service.py` | See Section 18 — this replaces v1.0's "deterministic only in P0" cut |
| D-007 | `POST /api/projects/{id}/impact-analysis` | D-006 | S | `backend/api/impact.py` | — |
| D-008 | `ImpactGraph`/`ImpactNode` — reusable impact-visualization components (component only, no page) | D-007, B-009 | M | `frontend/components/graph/ImpactGraph.tsx`, `ImpactNode.tsx` | Coordinate the component's props/interface with Account 2; Account 2's B-019 imports this into the impact page and wires it to B-009's confirmation modal |
| D-009 (P1) | Richer invalidated-decision detection during impact analysis | D-006 | L | `impact_service.py` (extends) | Explicitly deferred — the P0 explanation (D-006) already covers "why," this adds structured supersession detection |

**Merge order:** D-001 before D-002; D-002/D-005 can run in parallel with each other. D-004 and D-008 (both reusable components, not pages) can be scaffolded against fixture JSON before D-003/D-007 land, then wired into Account 2's pages (B-018, B-019). Account 4 never owns or edits a `frontend/app/*` file.

### 8.5 Account 5 — Security + Infrastructure + QA

Reclassified from v1.0's "Testing/Deployment" label. This gives Account 5 meaningful, continuous work throughout the project instead of leaving it mostly dependent on completed application features.

**Owns:** `tests/`, `backend/observability/`, `backend/security/prompt_injection.py`, `scripts/`, `.github/workflows/`, deployment configuration.

**Does not own:** application logic in any other account's files — Account 5 provides the harness and gates, not the feature code.

**Must expose:** `tests/evaluation/fixtures/*.json`, `scripts/seed_evaluation_fixtures.py`, the CI pipeline every account's PRs run against.

| Task ID | Description | Deps | Complexity | Files | Category |
|---|---|---|---|---|---|
| E-001 | Fixed synthetic evaluation project fixtures (happy path, ambiguity, conflict, adversarial, impact) | draft contracts | M | `tests/evaluation/fixtures/*.json` | QA |
| E-002 | Test harness skeleton — pytest, Firestore emulator, Playwright config | draft contracts | M | `tests/`, `pytest.ini`, `playwright.config.ts` | QA |
| E-003 | CI pipeline — cumulative unit+integration suite on every PR | E-002 | M | `.github/workflows/ci.yml` | Infrastructure |
| E-004 | Firestore Rules emulator test suite | A-011 | M | `tests/security/firestore_rules_test.py` | Security |
| E-005 | Prompt injection test fixtures + labeling helper | C-005 | M | `backend/security/prompt_injection.py`, test file | Security |
| E-006 | Cross-user isolation integration test at API layer — user A cannot access/modify user B's project or artifact; forged UID fields ignored; missing/invalid token rejected; cross-project resource access rejected | A-003 | M | `tests/security/cross_user_isolation_test.py` | Security |
| E-007 | Fault injection: Gemini failure, Firestore write failure | C-002, A-009 | M | `tests/integration/fault_injection_test.py` | QA |
| E-008 | Structured logging + safe-message redaction middleware | A (secret retrieval) | M | `backend/observability/logging.py`, `middleware.py` | Infrastructure |
| E-009 | Audit-identifier uniqueness test | A-008 | S | `tests/integration/audit_test.py` | QA |
| E-010 | Evaluation harness — precision/recall over fixtures | E-001, C-007, D-005 | L | `tests/evaluation/run_evaluation.py` | QA |
| E-011 | Latency benchmark | A-006, C-013 | M | `tests/integration/latency_benchmark.py` | QA |
| E-012 | `verify_no_secrets.sh` — credential scan | — | S | `scripts/verify_no_secrets.sh` | Security |
| E-013 | Deployment scripts — Docker, Cloud Run, Firebase Hosting, Secret Manager wiring, environment config, health checks | A-010, B (build) | M | `scripts/deploy_backend.sh`, `deploy_frontend.sh` | Infrastructure |
| E-014 | Dependency / security scanning, security headers, basic API abuse/rate-limit considerations | — | M | CI config, `backend/main.py` middleware | Security |
| E-015 (P1) | Accessibility audit pass | B pages exist | S | — | QA |

**Merge order:** E-001/E-002/E-003/E-012 start in Phase 0 alongside contract drafting; everything else lands continuously as its dependency account's code stabilizes. Account 5 is the one account whose work is spread across the whole timeline by design, not front-loaded — this is intentional, not a sign it is under-scoped.

---

## 9. Shared Contracts

Owned by the human integration owner. Every field name is taken directly from SRS §9.2/Appendix B. **Drafted early; frozen at merge time, not before any development may begin (Section 2).**

**Status legend used throughout this section:** 🔒 Frozen (cannot change without the Section 9.6 process) · 📝 Provisional (stable enough to build against, may still shift) · 🧪 Mocked (accounts build local fixtures until the real version exists) · ⚠️ Integration-critical (a change here ripples widely — treat with extra care).

### 9.1 Core entity contracts (Pydantic, mirrored to TS) — 🔒 after Gate 0.5

```python
# backend/domain/models/project.py
class Project(BaseModel):
    project_id: str
    owner_uid: str
    name: str
    description: str | None = None
    goal: str | None = None
    status: Literal["active", "archived"]
    version: int                       # monotonic, incremented on every accepted mutation
    created_at: datetime
    updated_at: datetime
```

```python
# backend/domain/models/requirement.py
class Requirement(BaseModel):
    requirement_id: str
    project_id: str
    type: Literal["functional", "non_functional"]
    statement: str
    rationale: str | None = None
    priority: Literal["must", "should", "may"]
    status: Literal["proposed", "accepted", "rejected", "superseded"]
    acceptance_criteria: list[str] = []
    source_refs: list[str] = []
    version: int
```

```python
# backend/domain/models/component.py
class Component(BaseModel):
    component_id: str
    project_id: str
    name: str
    type: str
    responsibilities: list[str] = []
    interfaces: list[str] = []
    technology: str | None = None
    status: Literal["proposed", "accepted", "rejected"]
```

```python
# backend/domain/models/decision.py
class Decision(BaseModel):
    decision_id: str
    project_id: str
    title: str
    context: str | None = None
    decision: str
    alternatives: list[str] = []
    rationale: str | None = None
    consequences: list[str] = []
    status: Literal["proposed", "accepted", "superseded"]
    supersedes: list[str] = []
```

```python
# backend/domain/models/task.py
class Task(BaseModel):
    task_id: str
    project_id: str
    title: str
    description: str | None = None
    status: Literal["todo", "in_progress", "done", "blocked"]
    priority: Literal["must", "should", "may"]
    depends_on: list[str] = []
    requirement_refs: list[str] = []
    component_refs: list[str] = []
    milestone_id: str | None = None
```

```python
# backend/domain/models/test.py
class TestCase(BaseModel):          # named TestCase, not Test, to avoid pytest collection collisions
    test_id: str
    project_id: str
    type: Literal["unit", "integration", "security", "scenario"]
    title: str
    procedure: list[str] = []
    expected_result: str
    requirement_refs: list[str] = []
    status: Literal["proposed", "accepted", "passing", "failing"]
```

```python
# backend/domain/models/risk.py
class Risk(BaseModel):
    risk_id: str
    project_id: str
    category: str
    description: str
    likelihood: Literal["low", "medium", "high"]
    impact: Literal["low", "medium", "high", "critical"]
    score: int                         # derived, computed server-side — never trust a client-supplied score
    mitigation_refs: list[str] = []
    status: Literal["open", "mitigated", "accepted_risk"]
```

```python
# backend/domain/models/trace_link.py
class TraceLink(BaseModel):
    trace_link_id: str
    project_id: str
    source_type: Literal["requirement","component","decision","task","test","risk","artifact"]
    source_id: str
    relation: Literal["IMPLEMENTS","DECOMPOSES","DEPENDS_ON","GENERATES",
                       "VALIDATES","INFLUENCES","AFFECTS","MITIGATES",
                       "CONFLICTS_WITH","SUPERSEDES","DOCUMENTED_BY"]
    target_type: Literal["requirement","component","decision","task","test","risk","artifact"]
    target_id: str
    created_by: Literal["system","agent","user"]
    created_at: datetime
```

```python
# backend/domain/models/agent_run.py
class AgentRun(BaseModel):
    run_id: str
    project_id: str
    request_id: str
    agent_type: Literal["requirements","architecture","planning","testing","risk","review","orchestrator"]
    project_version: int
    input_refs: list[str] = []
    output_status: Literal["success","invalid_schema","failed","rejected_by_policy"]
    latency_ms: int
    created_at: datetime
    # explicitly excluded: raw chain-of-thought / hidden reasoning text
```

```python
# backend/domain/models/audit_event.py
class AuditEvent(BaseModel):
    event_id: str
    project_id: str
    actor: Literal["user","system"]
    actor_uid: str | None = None
    action: str
    target_type: str
    target_id: str
    outcome: Literal["success","failure"]
    timestamp: datetime
```

### 9.2 The Proposal Envelope — 🔒⚠️ the single most important shared contract, drafted first

```python
# backend/domain/models/proposal.py
class ActionClass(str, Enum):
    READ = "READ"
    PROPOSE = "PROPOSE"
    LOW_IMPACT_WRITE = "LOW_IMPACT_WRITE"
    HIGH_IMPACT_WRITE = "HIGH_IMPACT_WRITE"
    BULK_WRITE = "BULK_WRITE"

class Proposal(BaseModel):
    proposal_id: str
    project_id: str
    run_id: str
    action_class: ActionClass
    entity_type: str
    entity_payload: dict
    affected_entity_ids: list[str] = []
    confidence: Literal["low","medium","high"]
    rationale: str | None = None
    status: Literal["pending","approved","rejected","expired"]
    project_version_at_creation: int
    created_at: datetime
```

Rule: **no agent writes directly to an entity repository.** Every agent returns `Proposal` objects. In P0, every write-class action requires explicit human confirmation before persistence — there is no automatic mutation of any kind:

| `ActionClass` | P0 behavior |
|---|---|
| `READ` | Immediate execution — no proposal, no approval needed. |
| `PROPOSE` | Generates a proposal for review; no persistence until approved. |
| `LOW_IMPACT_WRITE` | Proposal + explicit user confirmation. **No automatic application in P0.** |
| `HIGH_IMPACT_WRITE` | Proposal + explicit user confirmation via `/actions/{id}/approve`. |
| `BULK_WRITE` | Proposal + explicit user confirmation via `/actions/{id}/approve`. |

Configurable automatic application of `LOW_IMPACT_WRITE` (an "auto-apply" policy the user could opt into) remains a P1 feature (Section 33) — it does not exist in P0 under any configuration. This corrects any earlier phrasing that implied only `HIGH_IMPACT_WRITE`/`BULK_WRITE` require approval; in P0, `LOW_IMPACT_WRITE` requires the identical explicit-confirmation path.

**Because this contract is on the critical path for A-009 (Section 13), it is drafted and versioned first, ahead of the other entity contracts, so Account 1 can start the approval transaction against it immediately even while other contracts are still provisional.**

### 9.3 Error contract — 🔒 (blocks B-003 and every account's error handling)

```python
# backend/domain/models/errors.py
class ErrorResponse(BaseModel):
    error_code: str
    message: str             # safe, user-facing — never raw exception text or secrets
    request_id: str
```

### 9.4 ModelClient interface — 🔒⚠️ (Section 15)

```python
# backend/agents/model_client.py
class ModelClient(Protocol):
    async def generate(self, messages: list[Message], response_schema: type[BaseModel] | None = None) -> ModelResponse: ...
```

### 9.5 TypeScript mirrors — 📝 → 🔒

`frontend/lib/contracts/*.ts` mirror every model above field-for-field (camelCase, via a Pydantic `alias_generator` at the API boundary). Account 2 may build against a hand-typed provisional version of these before the generator exists; reconciliation happens before merge, not before Account 2 starts.

### 9.6 Contract change process (post-freeze)

1. Written note in `docs/decision-log.md` explaining why.
2. Human integration owner approval.
3. Version bump comment in the changed file.
4. `scripts/find_contract_usages.py` run to notify every account whose owned files import the model.

### 9.7 Full contract inventory and status

| # | Contract | Status |
|---|---|---|
| 1 | Firebase authentication contract | 🔒 |
| 2 | API contract (Section 11) | 📝 → 🔒 at Gate 0.5 |
| 3 | Firestore document model (Section 10) | 📝 → 🔒 |
| 4 | Project/resource authorization model | 🔒 |
| 5 | Agent input/output schemas | 🔒 |
| 6 | Proposal schema | 🔒⚠️ (drafted first) |
| 7 | Approval schema | 🔒⚠️ |
| 8 | Audit event schema | 🔒 |
| 9 | TraceLink schema | 🔒 |
| 10 | Change Impact schema (now includes `explanation: str`, Section 18) | 🔒 |
| 11 | ModelClient interface | 🔒⚠️ (drafted first, Section 15) |
| 12 | Frontend TypeScript API types | 📝 → 🔒 |

---

## 10. Repository Structure

```
nexus/
├── frontend/                          # Account 2 owns all pages/composition; Account 4 owns components/graph/* only
│   ├── app/                            # Account 2 — sole owner, no exceptions; Account 4 never edits a file here
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── projects/page.tsx
│   │   │   ├── projects/[id]/page.tsx
│   │   │   ├── projects/[id]/chat/page.tsx
│   │   │   ├── projects/[id]/requirements/page.tsx
│   │   │   ├── projects/[id]/architecture/page.tsx    # Account 2 (B-018) — imports Account 4's GraphCanvas component
│   │   │   ├── projects/[id]/planning/page.tsx
│   │   │   ├── projects/[id]/decisions/page.tsx
│   │   │   ├── projects/[id]/testing/page.tsx
│   │   │   ├── projects/[id]/risks/page.tsx
│   │   │   ├── projects/[id]/impact/page.tsx          # Account 2 (B-019) — imports Account 4's ImpactGraph component
│   │   │   └── projects/[id]/audit/page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                        # Account 2
│   │   ├── graph/                     # Account 4 — sole owner (GraphCanvas, GraphNode, GraphEdge, ImpactGraph, ImpactNode); Account 2 never edits a file here
│   │   ├── chat/                      # Account 2
│   │   ├── proposals/                 # Account 2
│   │   └── dashboard/                 # Account 2
│   ├── lib/
│   │   ├── firebase-client.ts
│   │   ├── api-client.ts
│   │   └── contracts/                 # mirrors backend contracts, human integration owner owns
│   ├── hooks/
│   └── middleware.ts
│
├── backend/                            # Accounts 1/3/4 share this, split by subpackage
│   ├── main.py                         # human integration owner owns (router registration only)
│   ├── config.py                       # Account 1
│   ├── auth/                           # Account 1
│   │   ├── firebase.py
│   │   └── dependencies.py
│   ├── domain/                         # CONTRACTS — human integration owner owns
│   │   └── models/
│   │       ├── project.py / requirement.py / component.py / decision.py
│   │       ├── task.py / test.py / risk.py / artifact.py / conversation.py
│   │       ├── agent_run.py / trace_link.py / audit_event.py / proposal.py
│   │       └── errors.py
│   ├── firestore/                      # Account 1
│   │   ├── client.py / repository_base.py    # transaction-aware create()/update() — Section 13.4
│   │   ├── project_repo.py / requirement_repo.py / component_repo.py
│   │   ├── decision_repo.py / task_repo.py / test_repo.py / risk_repo.py
│   │   ├── conversation_repo.py        # A-008b — conversation/message persistence
│   │   ├── trace_link_repo.py          # authored by Account 4, reviewed by Account 1
│   │   └── audit_repo.py / agent_run_repo.py
│   ├── services/                       # Account 1
│   │   └── approval_service.py         # A-009 — coordinates the approval transaction (Section 13.4)
│   ├── secrets/                        # Account 1
│   │   └── secret_manager.py
│   ├── api/
│   │   ├── projects.py                 # Account 1
│   │   ├── chat.py                     # Account 3
│   │   ├── requirements.py             # Account 3 (agent) + Account 1 (CRUD)
│   │   ├── architecture.py / planning.py / testing.py / risks.py   # Account 3
│   │   ├── decisions.py                # Account 1 (CRUD only)
│   │   ├── impact.py / graph.py        # Account 4
│   │   ├── actions.py / audit.py       # Account 1
│   ├── agents/                         # Account 3
│   │   ├── model_client.py             # ModelClient abstraction (Section 15)
│   │   ├── providers/gemini_provider.py
│   │   ├── base.py / orchestrator.py / context.py
│   │   ├── requirements_agent.py / architecture_agent.py / planning_agent.py
│   │   ├── testing_agent.py / risk_agent.py
│   │   ├── review_agent.py             # P1 — stub interface only in P0
│   │   ├── impact_explainer.py         # Section 18 P0 semantic explanation
│   │   └── tools/
│   │       ├── base_tool.py
│   │       └── project_read.py / requirement_tools.py / architecture_tools.py
│   │           / task_tools.py / test_tools.py / risk_tools.py / decision_tools.py
│   ├── graph_model/                    # Account 4
│   │   ├── traversal.py                # deterministic impact traversal
│   │   ├── graph_assembler.py
│   │   └── impact_service.py           # traversal + Gemini explanation, both P0
│   ├── validation/                     # Account 3
│   │   └── schema_validator.py
│   ├── observability/                  # Account 5
│   │   ├── logging.py
│   │   └── middleware.py
│   └── security/                       # Account 5 (policy), Account 1 (hooks)
│       └── prompt_injection.py
│
├── firestore/                           # Account 1
│   ├── firestore.rules
│   └── firestore.indexes.json
│
├── tests/                               # Account 5 owns infra; each account writes its own domain tests
│   ├── unit/{backend,frontend}/
│   ├── integration/
│   ├── security/
│   ├── evaluation/fixtures/
│   └── e2e/
│
├── scripts/                             # Account 5
│   ├── seed_evaluation_fixtures.py
│   ├── deploy_backend.sh / deploy_frontend.sh
│   └── verify_no_secrets.sh
│
├── docs/                                 # human integration owner owns
│   ├── NEXUS_SRS_v1_0.docx
│   ├── nexus_implementation_plan.md
│   ├── api-contract.md
│   └── decision-log.md
│
├── .github/workflows/                    # Account 5
│   ├── ci.yml
│   └── deploy.yml
│
├── firebase.json
├── .env.example
└── README.md
```

**Files that must exist (drafted, may be provisional) before any account writes application code against them:** every file under `backend/domain/models/`, every file under `frontend/lib/contracts/`, `proposal.py`/`proposal.ts` specifically, a draft `firestore/firestore.rules`, the error contract shape, and `docs/api-contract.md`. "Exist and drafted" is the bar — not "frozen and perfect" (Section 2).

---

## 11. Firestore Data Model

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
    conversations/{conversationId}      # persisted via Account 1's conversation_repo.py (A-008b)
      messages/{messageId}              # subcollection — keeps conversation docs small
    agentRuns/{runId}
    auditEvents/{eventId}
    traceLinks/{traceLinkId}
    proposals/{proposalId}               # durable store backing the Proposal Envelope
```

**Ownership model:** every document under `projects/{projectId}` inherits authorization from `projects/{projectId}.ownerUid`. The backend is the only writer for every collection. `project.version` is incremented by the backend inside the same transaction as any accepted mutation (Section 13), which is what makes optimistic concurrency checking possible.

**Indexes** (initial set, revisited after Account 3's real query patterns exist — over-indexing early wastes write throughput for no benefit):

```json
{
  "indexes": [
    { "collectionGroup": "requirements", "fields": [
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "priority", "order": "ASCENDING"} ]},
    { "collectionGroup": "tasks", "fields": [
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "milestoneId", "order": "ASCENDING"} ]},
    { "collectionGroup": "traceLinks", "fields": [
        {"fieldPath": "sourceId", "order": "ASCENDING"},
        {"fieldPath": "relation", "order": "ASCENDING"} ]},
    { "collectionGroup": "auditEvents", "fields": [
        {"fieldPath": "timestamp", "order": "DESCENDING"} ]}
  ]
}
```

---

## 12. Authentication and Authorization

### 12.1 The access pattern

```
Firebase Authentication
    ↓
FastAPI
    ↓
Verify Firebase ID token
    ↓
Derive authenticated UID from verified token claims
    ↓
Authorize project/resource ownership
    ↓
Firebase Admin SDK
    ↓
Firestore
```

### 12.2 Critical clarification (corrects a common conflation in v1.0's phrasing)

**Firestore Security Rules do not protect server-side Admin SDK access the way they protect direct client SDK access.** The Admin SDK bypasses Firestore Rules entirely. Therefore:

**Backend authorization — `require_authenticated_user()`, `require_project_access()`, `require_resource_access()` — is the primary and only authorization boundary for the NEXUS backend.**

Firestore Security Rules in this project serve as:
- protection for any direct client access (there is none in the P0 demo path, but the rules exist anyway),
- defense-in-depth,
- future-proofing against an accidental direct-client-read path being added later,
- protection against unintended direct client access.

**Firestore Rules must never be described or relied upon as protection against an incorrectly authorized Admin SDK request.** That protection comes exclusively from Account 1's authorization dependencies (A-002, A-003), which derive the UID exclusively from the verified Firebase token — never from a client-supplied field.

### 12.3 Rules (concrete)

```javascript
// firestore/firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function isOwner(uid) { return isSignedIn() && request.auth.uid == uid; }

    match /users/{uid} {
      allow read: if isOwner(uid);
      allow write: if false; // backend-only via Admin SDK, which bypasses rules —
                              // this line documents intent for humans/judges reading the file,
                              // it is NOT what actually stops an unauthorized Admin SDK call.
      match /projects/{projectId} {
        allow read: if isOwner(uid);
        allow write: if false;
        match /{subcollection}/{docId} {
          allow read: if isOwner(uid);
          allow write: if false;
        }
      }
    }
  }
}
```

### 12.4 Required tests (Account 5, E-004/E-006)

- User A cannot access User B's project.
- User A cannot modify User B's artifact.
- Forged UID fields in a request body are ignored — UID always comes from the verified token.
- Missing or invalid token is rejected.
- Cross-project resource access is rejected (e.g., a valid token + a resource ID belonging to a different one of the same user's projects, where applicable).

---

## 13. Proposal / Approval Architecture

This is the plan's single most important behavioral primitive, and it is scheduled far earlier in the critical path than v1.0 scheduled it.

### 13.1 The pattern

```
User input
    ↓
Agent
    ↓
Structured proposal
    ↓
Validation
    ↓
Authorization
    ↓
Human approval
    ↓
Transactional persistence
    ↓
Version update
    ↓
Trace links
    ↓
Audit event
```

For low-risk informational (`READ`) responses, a direct response is acceptable. For every write-class action — `LOW_IMPACT_WRITE`, `HIGH_IMPACT_WRITE`, and `BULK_WRITE` — the full pipeline above is mandatory in P0; none of them are automatically applied (Section 9.2).

### 13.2 Why this moves earlier

The proposal/approval transaction (A-009) is not "the last thing every agent needs" — it is the first real backend contract every agent will use. v1.0 scheduled it correctly *in principle* ("develop it against a fake proposal, don't wait for all six agents") but buried that instruction inside a risk-mitigation footnote rather than making it part of the actual execution sequence. v2.0 makes it explicit and early:

```
Fake Proposal
    ↓
Approval API
    ↓
Authorization
    ↓
Firestore transaction
    ↓
Version bump
    ↓
Audit event
```

Concretely: **A-009 starts as soon as A-005 (`RepositoryBase`) and the drafted Proposal contract exist — the same phase as project CRUD, not after Requirements/Architecture agents are done.** Account 1 hand-constructs a fake `Proposal` document to develop and test the transaction. Every agent, once it exists, plugs into the same mechanism:

```
Requirements Agent → Requirement Proposal → Human Approval → Persist Approved Requirement → Version + Audit
Architecture Agent → Architecture Proposal → Human Approval → Persist Approved Architecture → Version + Audit
```

### 13.3 The transaction itself

1. Agent produces a `Proposal` document, `status: "pending"`.
2. Frontend renders it via `ProposalCard` — visually distinct, never merged into the entity's own collection view until accepted.
3. On `/actions/{proposalId}/approve`: backend validates `project_version_at_creation` against current `project.version` (stale-proposal check), writes the real entity document, creates the `TraceLink`(s), increments `project.version`, writes an `AuditEvent`, and sets the proposal's `status: "approved"` — all inside one Firestore transaction.
4. On reject: proposal `status: "rejected"`, `AuditEvent` written, nothing else changes.

This transaction (A-009/A-014) is flagged as **non-parallelizable and not to be rushed** — it touches every entity repository and is the seam where "AI proposal" becomes "real project state" for every feature in the product. A concurrency test (two stale-version approvals racing) is mandatory before it is considered done.

### 13.4 Transaction-aware repository abstraction

`*_repo.py writes` is not an implementation — repositories must be able to participate in a single Firestore transaction alongside each other, or the atomicity requirement above is unenforceable. `RepositoryBase` (Section 8.1, A-005) exposes transaction-aware `create()`/`update()`:

```python
# backend/firestore/repository_base.py
class RepositoryBase:
    def create(self, entity: BaseModel, transaction: firestore.Transaction | None = None) -> None:
        """Writes entity via `transaction.set(...)` when a transaction is supplied,
        or a normal write otherwise. Every domain repository (`requirement_repo.py`,
        `component_repo.py`, `task_repo.py`, `test_repo.py`, `risk_repo.py`,
        `trace_link_repo.py`, `audit_repo.py`, `project_repo.py`) inherits this method
        and never rolls its own transaction handling."""
        ...

    def update(self, entity: BaseModel, transaction: firestore.Transaction | None = None) -> None:
        """Same pattern as create(), for updates (e.g. project.version increments,
        proposal status changes)."""
        ...
```

This is the one pattern used consistently everywhere a repository is called from inside the approval transaction — no repository implements a second, transaction-unaware write path.

### 13.5 ApprovalService — the approval coordinator

The API layer (`backend/api/actions.py`) does not directly coordinate every repository itself. A dedicated service owns that coordination:

```
POST /actions/{id}/approve
            ↓
   ApprovalService (backend/services/approval_service.py, Account 1)
            ↓
      Firestore transaction
      ┌─────┼────────┬────────┐
      ↓     ↓        ↓        ↓
   Entity TraceLink Audit   Proposal
   repo.  repo.     repo.   status update
  create()create()  create()(repo.update())
                          ↓
                  project.version++
                  (project_repo.update())
```

`ApprovalService.approve(proposal_id, uid)`:
1. Opens one Firestore transaction.
2. Reads the current `Proposal` and current `Project.version` inside that transaction.
3. Validates `proposal.project_version_at_creation == project.version` (stale-proposal check) — if it does not match, aborts the transaction and returns a conflict error; nothing is written.
4. Calls `create(transaction=txn)` on the target entity repository (`requirement_repo`, `component_repo`, `task_repo`, `test_repo`, or `risk_repo`, depending on `entity_type`).
5. Calls `create(transaction=txn)` on `trace_link_repo` for every derived `TraceLink`.
6. Calls `update(transaction=txn)` on `project_repo` to increment `project.version`.
7. Calls `create(transaction=txn)` on `audit_repo` to write the `AuditEvent`.
8. Calls `update(transaction=txn)` on the proposal's own document, setting `status: "approved"`.
9. Commits the transaction. All of steps 4–8 succeed together or none of them are persisted.

**Transactional invariant:** the approval operation is atomic with respect to (a) proposal approval state, (b) entity persistence, (c) trace links, (d) project version, and (e) the audit event. If the Firestore transaction fails or aborts for any reason (including the stale-version check in step 3), **none** of (a)–(e) is partially committed — Firestore's transaction semantics guarantee all-or-nothing here, which is exactly why `ApprovalService` performs every write inside a single transaction rather than as separate calls.

**Required concurrency test (owned by Account 1, exercised by A-014):** two approval attempts against the same proposal, submitted concurrently, where both read the same `project.version` at request time. Exactly one must succeed; the other must fail with a stale-version conflict, not silently overwrite or duplicate the entity. This test is a precondition for considering A-009/A-014 done, not an optional hardening pass (Section 23.2 already lists "stale project version" as required coverage; this is that requirement made concrete against `ApprovalService`).

---

## 14. AI / Agent Architecture

### 14.1 BaseAgent interface

```python
# backend/agents/base.py
class AgentInput(BaseModel):
    project_id: str
    project_version: int
    conversation_id: str | None = None
    user_message: str | None = None
    context: dict                      # populated by context.py, never built ad-hoc inside an agent

class AgentOutput(BaseModel):
    proposals: list[Proposal] = []
    read_only_summary: str | None = None
    confidence: Literal["low","medium","high"]
    unresolved_questions: list[str] = []

class BaseAgent(ABC):
    agent_type: ClassVar[str]
    output_schema: ClassVar[type[BaseModel]]
    model_client: ModelClient           # injected — never the Gemini SDK directly (Section 15)

    @abstractmethod
    async def run(self, input: AgentInput) -> AgentOutput: ...

    async def execute(self, input: AgentInput) -> AgentOutput:
        """Template method: builds AgentRun record, calls run(), validates output,
        persists AgentRun regardless of success/failure, never lets a raw exception
        reach the API layer. This is the ONLY entry point route handlers call."""
```

### 14.1.1 Reconciling `AgentOutput.proposals` with each agent's domain output (Requirement[], Component[], etc.)

Section 14.4 describes each specialist agent's "Output schema" as its own domain type — `list[Requirement]` for Requirements, `list[Component]` for Architecture, `list[Task]` for Planning, `list[TestCase]` for Testing, `list[Risk]` for Risk. `AgentOutput` above shows `proposals: list[Proposal]`. These are not competing contracts — they describe two stages of the same pipeline, and every agent implementation follows both:

```
Agent domain output                (e.g. Requirement[], Component[], Task[], TestCase[], Risk[] —
        ↓                           validated candidate entities, not yet authoritative)
validated candidate entity
        ↓
Proposal envelope                  (each candidate entity is serialized into Proposal.entity_payload,
        ↓                           with Proposal.entity_type set accordingly)
authorization
        ↓
human approval
        ↓
transactional persistence          (ApprovalService, Section 13.5)
        ↓
authoritative entity                (now exists in requirement_repo / component_repo / task_repo / etc.)
```

Concretely, per agent:

```
Requirements Agent → Requirement[] → Proposal[] → Approval → Requirement Repository
Architecture Agent → Component[] (+ relationship hints) → Proposal[] → Approval → Component/Decision persistence
Planning Agent     → Task[] → Proposal[] → Approval → Task persistence
Testing Agent      → TestCase[] → Proposal[] → Approval → Test persistence
Risk Agent         → Risk[] → Proposal[] → Approval → Risk persistence
```

Inside `run()`, an agent's domain logic produces its own typed candidate objects (`Requirement`, `Component`, etc.) — this is what Section 14.4's "Output schema" column documents, and it is the schema each agent validates its own Gemini output against before doing anything else. `BaseAgent.execute()` then wraps each validated candidate into a `Proposal` (`entity_payload=candidate.model_dump()`, `entity_type` set to the matching domain type, `action_class` set per Section 9.2's table) before returning `AgentOutput.proposals`. **Agents never call a repository directly and never persist a domain object themselves** — the domain type is a validation and shaping contract internal to the agent's `run()`; the `Proposal` envelope is the only thing that leaves the agent boundary and the only thing the API layer, authorization, and `ApprovalService` ever see. Authorization is checked against the `Proposal`'s `action_class`, the user explicitly approves via `/actions/{id}/approve`, and only then does `ApprovalService` (Section 13.5) perform the transactional write that turns the candidate into an authoritative entity.

### 14.2 Context retrieval and minimization

```python
# backend/agents/context.py
def build_context(project_id: str, agent_type: str, focus_entity_ids: list[str] | None) -> dict:
    """Reads ONLY the Firestore entities relevant to agent_type + focus_entity_ids.
    Each specialist agent declares which entity collections it needs as a static,
    auditable class attribute — not a dynamic decision the model makes."""
```

### 14.3 Typed tool layer

```python
# backend/agents/tools/base_tool.py
class BaseTool(ABC):
    name: ClassVar[str]
    risk_level: ClassVar[Literal["low","medium","high"]]
    args_schema: ClassVar[type[BaseModel]]

    @abstractmethod
    async def execute(self, args: BaseModel, project_id: str, uid: str) -> Proposal | dict:
        """Tools never receive raw DB credentials. Authorization (does this uid own
        this project) is checked HERE, outside Gemini, before execute() runs."""
```

Concrete P0 tools: `RequirementCreate`, `ArchitectureUpdate` (proposal-only), `TaskCreate`, `TestCreate`, `RiskCreate`, `DecisionCreate`, plus the two low-risk read tools `ProjectRead`/`GraphQuery`. `CodeReview` and `ArtifactRead` are P1.

### 14.4 Per-agent specification

| Agent | Context read | Output schema | Tools | Mutation class | P0 validation |
|---|---|---|---|---|---|
| Requirements | existing requirements, conversation history | `list[Requirement]` + unresolved_questions | RequirementCreate | PROPOSE | ≥1 acceptance criterion per requirement, or flagged ambiguous |
| Architecture | accepted requirements, existing components | `list[Component]` + relationship hints | ArchitectureUpdate | PROPOSE | Each component references ≥1 requirement_id |
| Planning | accepted requirements, components, existing tasks | `list[Task]` | TaskCreate | PROPOSE | Every task has ≥1 requirement_ref or component_ref |
| Testing | accepted requirements + acceptance criteria | `list[TestCase]` | TestCreate | PROPOSE | Every test references ≥1 requirement_id |
| Risk | components, requirements, dependencies | `list[Risk]` | RiskCreate | PROPOSE | Score computed server-side, never model-supplied |
| Review (P1) | requirements, components | findings list | CodeReview, ArtifactRead | READ | — |

### 14.5 Failure handling and retry policy

- Gemini call failure: one retry with backoff, then `output_status = "failed"`; no partial proposal is ever persisted.
- Schema validation failure: zero retries with a different prompt in P0; `output_status = "invalid_schema"`, treated as no proposal produced.
- Firestore write failure during proposal persistence: standard 500, `ErrorResponse` returned, frontend never shows a false success state.

---

## 15. ModelClient Abstraction

P0 remains Gemini-only. The abstraction exists **early** — before the first agent is written, not retrofitted after five agents are hardwired to the Gemini SDK.

```python
# backend/agents/model_client.py
class ModelClient(Protocol):
    async def generate(
        self,
        messages: list[Message],
        response_schema: type[BaseModel] | None = None,
    ) -> ModelResponse: ...

# backend/agents/providers/gemini_provider.py
class GeminiProvider(ModelClient):
    """The only file in the codebase that imports the Gemini SDK directly."""
```

Agents depend on `ModelClient`, never on `GeminiProvider` or the Gemini SDK directly. This is the seam that later allows a `ClaudeProvider`/`OpenAIProvider` (P2) or model routing without touching a single agent's `run()` body.

**P0/P1 scope for this abstraction:** `ModelClient` interface, `GeminiProvider`, structured output support, multi-turn conversation support, a minimal tool/function-calling abstraction if the SRS's agent-tool design actually requires it.

**P2 scope (not built now):** `ClaudeProvider`, `OpenAIProvider`, model routing, fallback strategies, cost/latency routing.

The abstraction stays small on purpose — this is not a generic enterprise model gateway. Its only job is to stop every agent from being hardwired directly to Gemini.

---

## 16. Orchestrator

### 16.1 Implementation parallelism vs. runtime dependencies (the distinction v1.0 blurred)

It is correct and encouraged that five Claude accounts implement the five specialist agents in parallel, as five separate files, once the shared foundation (`ModelClient`, `BaseAgent`, context, tools) exists. **It is not correct to claim the running system treats all five agents as independent of each other.** The likely runtime dependency chain is approximately:

```
Requirements → Architecture → Planning → Testing
```

with Risk consuming relevant project context from Requirements/Architecture/etc. rather than running in true isolation. This plan states that chain explicitly so nobody designs the orchestrator, the demo script, or the evaluation harness around a false assumption of total runtime independence.

### 16.2 The orchestrator does not wait for all five agents

The first working runtime slice requires only **one** real specialist agent:

```
Gemini Client (GeminiProvider)
    ↓
ModelClient abstraction
    ↓
BaseAgent
    ↓
Requirements Agent
    ↓
Orchestrator
    ↓
Chat API
    ↓
Frontend
```

Agents are then added incrementally:

```
Orchestrator
    ├── Requirements
    ├── Architecture
    ├── Planning
    ├── Testing
    └── Risk
```

The `Orchestrator.route()` method's shape (message + context → ordered list of agent types to invoke) is designed to support multiple agents from day one, but its **P0 correctness bar is defined against a single specialist agent** — Requirements. Concretely: C-012 (orchestrator) must pass its acceptance test against Requirements alone before Architecture/Planning/Testing/Risk are wired in; each subsequent agent is an additive route, not a rewrite.

```python
# backend/agents/orchestrator.py
class Orchestrator:
    def route(self, user_message: str, project_context_summary: dict) -> list[str]:
        """Returns ordered list of agent_type strings to invoke.
        P0: single-agent routing via a small classification prompt/rules —
        NOT true multi-agent fan-out (that is P1)."""
```

P0 routing is intentionally simple: a lightweight classification step (rule-based or a constrained-enum Gemini call) maps a chat message to exactly one specialist agent. Multi-agent fan-out in a single turn is real complexity explicitly deferred to P1.

### 16.3 The Gemini smoke test is not a temporary chat architecture

Before the Requirements Agent exists, it is still useful to prove that the underlying wiring works: a signed-in user's request reaches Gemini and a response reaches back. That proof is **C-002b, a single direct Gemini smoke-test endpoint** — not a generic temporary orchestrator, not a "chat mode," and not an early version of the chat API.

```
SMOKE TEST (C-002b, connectivity only):

Frontend
    ↓
Auth
    ↓
FastAPI
    ↓
ModelClient
    ↓
Gemini
    ↓
response
```

```
ACTUAL P0 CHAT (C-007 → C-012 → C-013, project-aware and persistent; C-013 also depends on A-008b):

Requirements Agent (C-007)
    ↓
Orchestrator (C-012)
    ↓
Chat API (C-013) ← depends on A-008b (Account 1's conversation_repo.py, Section 13)
    ↓
Conversation/message persistence (A-008b)
    ↓
Gemini multi-turn interaction
```

**Get one direct Gemini smoke-test endpoint working end-to-end before the Requirements Agent exists.** This validates frontend → authentication → FastAPI → `ModelClient` → Gemini → response connectivity, and nothing more. **Persistent, multi-turn, project-aware chat begins only after C-007 (Requirements Agent), C-012 (Orchestrator), and A-008b (conversation/message persistence) are available**, and is served exclusively by C-013's `/chat` endpoint — C-013 is not considered complete until it is wired to A-008b for persisting and retrieving conversation history. The smoke-test route (`backend/api/smoke_test.py`) is deleted once C-013 lands — it must never be allowed to accumulate conversation state, history, or project awareness, or it becomes a second, undocumented chat architecture running alongside the real one.

---

## 17. Knowledge Model and Traceability

The knowledge graph is not a separate database — it is assembled from Firestore `TraceLinks` at read time.

```python
# backend/graph_model/graph_assembler.py
def assemble_graph(project_id: str) -> dict:
    """Builds a React-Flow-ready nodes/edges JSON shape from components + traceLinks.
    No graph database. No caching layer beyond normal Firestore read latency in P0."""
```

Agents create `TraceLink` proposals alongside entity proposals when they identify relationships (e.g., the Architecture Agent's component→requirement `IMPLEMENTS` link). Traceability links are auto-created from agent outputs in P0; a manual link editor is P1.

React Flow renders whatever JSON shape the backend returns — the frontend has no independent graph logic.

---

## 18. P0 Change Impact Analysis

This is a core P0 differentiator and one of the plan's most important demo moments. It is **not** deterministic-only in P0, and it is **not** overengineered — both halves below are P0, and both are intentionally simple.

### 18.1 The pipeline

```
Artifact Change
    ↓
Deterministic graph traversal          (Account 4 — traversal.py)
    ↓
Affected entities
    ↓
Gemini semantic explanation            (Account 3 — impact_explainer.py, P0)
    ↓
Human-readable impact report
    ↓
Optional proposal
    ↓
Human approval
    ↓
Audit
```

**The deterministic graph traversal is the source of "what is connected." Gemini is responsible for "why does this connection matter?" This separation is explicit in the architecture: `traversal.py` never calls Gemini, and `impact_explainer.py` never re-derives the affected set — it only explains a set it is handed.**

### 18.2 Explicitly not required to build this

Vector search, embeddings, RAG, a graph database, or autonomous multi-agent impact analysis. The implementation is a single, lightweight Gemini call over the affected entities and their already-known metadata/context — nothing more.

### 18.3 Worked example

```
Requirement R-004 changed
    ↓
Affected (deterministic traversal):
- Architecture A-002
- ADR-003
- Task T-014
- Test TST-008

Gemini explanation (one call, structured output):
"R-004 affects A-002 because the architecture currently depends on the
authentication mechanism defined by the requirement. ADR-003 may need
review because it records the current authentication decision. T-014 and
TST-008 should be reviewed for implementation and test compatibility."
```

### 18.4 Implementation steps (owned jointly by Account 4 and Account 3)

1. Detect artifact version/change event.
2. Determine changed entity (Account 4).
3. Traverse `TraceLinks` deterministically, bounded depth (Account 4, `traversal.py`).
4. Build the affected-entity set (Account 4).
5. Gather compact context for those entities — no more than needed (Account 4 hands this to Account 3).
6. Send that context to Gemini via `ModelClient` (Account 3, `impact_explainer.py`).
7. Generate a structured `ImpactExplanation` (Account 3).
8. Display affected entities and explanation (Account 2, impact page + B-009's modal).
9. If the system proposes changes as a result, create a `Proposal` (goes through Section 13's pipeline).
10. Human approves/rejects.
11. Record audit event.

### 18.5 Contract addition

The Change Impact schema (Section 9.7, item 10) includes an `explanation: str` field populated by step 6 above — this is a P0 field, not a P1 addition bolted on later.

---

## 19. Vertical Slice 1 — Core NEXUS Loop

**This is the first complete working NEXUS and the primary execution target once the shared foundation exists.**

```
Login
    ↓
Create Project
    ↓
Project Workspace
    ↓
[Gemini smoke test — C-002b, connectivity only, retired once C-013 lands (Section 16.3)]
    ↓
Multi-turn Chat (C-013, persistent, project-aware — depends on A-008b)
    ↓
Requirements Agent (C-007) → Orchestrator (C-012) → Chat API (C-013, requires A-008b to be complete)
    ↓
Gemini (via ModelClient → GeminiProvider)
    ↓
Conversation persisted (Account 1's conversation_repo.py, A-008b — must exist before C-013 is considered done)
    ↓
Structured Proposal
    ↓
Human Approval          ← A-009, built early (Section 13)
    ↓
Firestore Persistence
    ↓
Audit Event
```

**Acceptance condition:** a user can log in, create a project, have a persistent multi-turn conversation with Gemini routed through the Requirements Agent and Orchestrator, generate structured requirements, approve them, and see the approved requirements persisted in their isolated Firestore project.

**Primary tasks:** A-001–A-006, A-008b, A-009 (started here, against a fake proposal), A-010, A-011, B-001–B-003, B-007, B-008, B-010, C-001–C-002, C-002b (smoke test, before C-007), C-003–C-007, C-012, C-013.

---

## 20. Vertical Slice 2 — Architecture + Traceability

```
Approved Requirements
    ↓
Architecture Agent
    ↓
Architecture Proposal
    ↓
Approval
    ↓
Architecture entities persisted
    ↓
React Flow visualization
    ↓
TraceLinks
```

**Acceptance condition:** the user can see requirements and architecture connected through traceability relationships, rendered as a graph.

**Primary tasks:** C-008, D-001–D-004, B-018, B-011 (partial).

---

## 21. Vertical Slice 3 — Change Impact

```
Change Requirement
    ↓
Version/change event
    ↓
Deterministic graph traversal
    ↓
Affected entities
    ↓
Gemini semantic impact explanation      ← P0, see Section 18
    ↓
Impact report
    ↓
Human approval where changes are proposed
    ↓
Audit
```

**Acceptance condition:** a judge can change one requirement and visually demonstrate what NEXUS believes is affected and why. **This should be one of the most important competition demo moments.**

**Primary tasks:** D-005–D-008, C-016, B-009, B-019.

---

## 22. Vertical Slice 4 — Testing + Risk + Dashboard

```
Testing Agent + Risk Agent + Planning Agent
    ↓
Test strategy · Risk analysis · Implementation plan
    ↓
Dashboard / project intelligence view
```

**Acceptance condition:** NEXUS can turn the existing project knowledge into implementation, testing, and risk artifacts, visible on a project health dashboard.

**Primary tasks:** C-009, C-010, C-011, B-013, B-014, A-013, A-007, B-012.

### After the vertical slices

Security hardening, full regression testing, deployment, demo polish, evaluation, documentation (Sections 23–28). The team is not made to wait for every feature in a phase to be complete before a usable application exists — each vertical slice above is independently demoable the moment its acceptance condition is met.

---

## 23. Testing Strategy

### 23.1 Testing pyramid

| Layer | Scope | Representative tasks |
|---|---|---|
| Unit | Individual functions/classes, mocked dependencies | Repository CRUD, schema validators, tool `execute()`, agent `run()` with mocked `ModelClient` |
| Integration | Real Firestore emulator, real route handlers, mocked Gemini | Full CRUD lifecycles, approve/reject transaction, fault injection |
| Security | Adversarial, cross-boundary | Cross-user isolation, Firestore Rules emulator, prompt injection, forged UID |
| AI evaluation | Fixture-based | Requirement extraction accuracy, ambiguity detection recall, impact analysis precision/recall, schema validity rate |
| End-to-end | Full stack, Playwright | One spec per demo scenario (Section 28) |

### 23.2 Minimum required coverage

| Requirement | Test |
|---|---|
| Firebase authentication | Sign-in success/failure, expired token rejection |
| Cross-user isolation | User B cannot read/write User A's project via API or rules |
| Unauthorized project access | Wrong projectId owned by another user → 403/404 |
| Forged UID | Client-supplied UID in body is ignored |
| Gemini failure | Simulated timeout/5xx → clean failure, no partial proposal |
| Firestore failure | Simulated write failure → UI never shows false success |
| Invalid structured AI output | Malformed response → `invalid_schema`, no proposal created |
| Prompt injection | Adversarial text in artifact/conversation → no unauthorized mutation |
| Unauthorized high-impact mutation | Attempt to bypass approval → rejected |
| Stale project version | Two concurrent proposals against changed project → stale one rejected |
| Traceability | Requirement→component→task→test links created and queryable |
| Impact analysis | Known fixture change → correct affected-entity set AND a non-empty, relevant explanation |
| Requirement coverage | Every accepted requirement has ≥1 linked test |
| Risk generation | Risks scored correctly from likelihood×impact table |
| Multi-turn conversation | 3-turn reference scenario resolves references correctly |

### 23.3 Fixed synthetic evaluation dataset

Minimum composition (Account 5, E-001): happy path, ambiguity, conflict, adversarial (prompt injection), and impact (hand-verified dependency graph as ground truth). No fixture contains real credentials, private keys, or personal information.

---

## 24. Security Strategy

| Security control | Task | File |
|---|---|---|
| Firebase token verification | A-002 | `backend/auth/firebase.py` |
| UID derivation from verified token only | A-002 | `backend/auth/firebase.py` |
| Firestore Security Rules (defense-in-depth, not the Admin SDK boundary — Section 12.2) | A-011 | `firestore/firestore.rules` |
| Backend authorization (ownership + scope) — the real Admin SDK security boundary | A-003 | `backend/auth/dependencies.py` |
| Secret Manager credential retrieval | A-010 | `backend/secrets/secret_manager.py` |
| Gemini credential isolation (never to browser) | A-010, E-012 | `backend/secrets/secret_manager.py`, `scripts/verify_no_secrets.sh` |
| Prompt injection handling | E-005 | `backend/security/prompt_injection.py` |
| Typed tools (no arbitrary DB access from agents) | C-005, C-006 | `backend/agents/tools/*.py` |
| Structured outputs (schema validation before mutation) | C-014 | `backend/validation/schema_validator.py` |
| Approval boundaries | A-009, B-009 | `backend/api/actions.py`, `backend/services/approval_service.py`, `ConfirmMutationModal.tsx` |
| Audit logging | A-008, A-009 | `backend/firestore/audit_repo.py` |
| Secret scanning (CI gate) | E-012 | `scripts/verify_no_secrets.sh` |
| Safe logging | E-008, A-015 | `backend/observability/logging.py` |
| Dependency/security scanning, headers, rate-limit posture | E-014 | CI config |

**The security invariant** (the model may recommend an action, but SHALL NOT be the authority that grants itself permission to execute it) is implemented as: every tool's authorization check runs in application code (C-005's decorator) before the tool body executes, using the verified UID from A-002 — Gemini never sees, sets, or influences the authorization decision. Tested directly: E-005's adversarial fixtures include text instructing the model to "approve this change" or "skip confirmation," asserting the mutation still requires a real `/actions/{id}/approve` call from an authenticated request.

---

## 25. CI/CD and Infrastructure

- **Docker** — backend containerized for Cloud Run.
- **Cloud Run** — backend service, dedicated service account with only `roles/secretmanager.secretAccessor` (scoped to the Gemini secret) and `roles/datastore.user` — never `Editor`/`Owner`.
- **Firebase Hosting** — frontend, deployed as a static/client-rendered build only (Section 26.1). Firebase Hosting is never used as a second backend.
- **Secret Manager** — Gemini API key, `gemini-api-key-{env}` naming convention.
- **Environment separation:** `dev` (local emulators, stubbed credential), `staging` (real project, evaluation fixtures seeded), `production` (separate project, no test data ever seeded here).
- **CI (cumulative):** every PR runs the *entire* accumulated test suite, not just its own new tests — a regression in, say, cross-user isolation surfaces immediately even while work has moved on to later vertical slices.
- **Health checks** on the Cloud Run service.

---

## 26. Deployment

### 26.1 Deployment architecture (locked, Section 5 decision 16)

The Next.js frontend is deployed as a static/client-rendered application to Firebase Hosting. All privileged server-side operations occur in FastAPI/Cloud Run. No Next.js server API routes, server-side privileged API handlers, or separate Next.js backend are used in P0.

```
Browser
   │
   ├── Firebase Authentication
   │
   └── HTTPS
        ↓
   Cloud Run / FastAPI
        ↓
   ┌───────────────┬────────────────┬────────────┐
   ↓               ↓                ↓            ↓
Firestore      Secret Manager     Gemini API   (no Next.js backend)
```

Firebase Hosting serves the built Next.js static/client-rendered assets only. It never proxies to a second application server, never holds the Gemini credential, and never performs an Admin SDK write — those responsibilities belong exclusively to Cloud Run/FastAPI, consistent with Section 12's authorization model. Do not create a second backend inside Next.js.

### 26.2 Deployment stages

| Stage | Component | Task |
|---|---|---|
| 1 | Firebase project + Auth providers enabled | INT-002 (human integration owner) |
| 2 | Firestore database created, rules + indexes deployed | A-011, A-012 |
| 3 | GCP project + Secret Manager secret created | INT-002, A-010 |
| 4 | Backend service account, least-privilege IAM | E-013 |
| 5 | Backend containerized, deployed to Cloud Run | E-013 |
| 6 | Frontend built as a static/client-rendered bundle, deployed to Firebase Hosting (Section 26.1) | E-013 |
| 7 | Environment variables/secrets wired (Cloud Run env vars reference Secret Manager, never literal values) | E-013 |
| 8 | Deployment verification — re-run all gates against the deployed URL, confirming no Next.js server route or privileged handler is reachable | human integration owner |

---

## 27. Acceptance Gates

| Gate | Condition | Primary tasks | Demo scenarios |
|---|---|---|---|
| Gate 0.5 | Contracts drafted, human integration owner freezes them; Firebase/GCP project exists | contract drafting, INT-002 | — |
| Gate 1 | Auth + isolated project persistence | A-001–006, B-001–005 | D-01 |
| Gate 1.5 | Gemini smoke test passes (connectivity only — frontend → auth → FastAPI → ModelClient → Gemini → response); retired once Gate 2 is met | C-001, C-002, C-002b | — |
| Gate 2 | Persistent multi-turn Gemini chat works, orchestrator works with Requirements Agent alone, conversation history persists | C-001–007, A-008b, C-012–013 | D-04 |
| Gate 3 | Requirements Agent works, approval transaction works against it | C-007, C-015, B-010, A-009 | D-02 |
| Gate 4 | Architecture + graph works | C-008, D-001–004 | D-03 |
| Gate 5 | Planning + traceability works | C-009, D-001–002, B-011–012 | D-05 (partial) |
| Gate 6 | Impact analysis works — deterministic traversal AND Gemini explanation, both P0 | D-005–008, C-016 | D-06 |
| Gate 7 | Testing + risk analysis works | C-010–011, B-013–014 | D-07, D-08 |
| Gate 8 | Approval + audit fully hardened (concurrency, stale versions) | A-008–009, A-014, B-008–009, B-015 | D-06/D-10 (partial) |
| Gate 9 | Security tests pass | E-004–006, A-011, A-015 | D-10, D-11, D-12 |
| Gate 10 | Full competition demo works, deployed | E-013, human integration owner's demo script | D-01–D-12, all |

**Enforcement rule:** a later gate must never hide failure of an earlier gate. Gate 6+ rehearsals always re-run the Gate 1–5 automated suites as a precondition, not just the new gate's own tests — CI runs the cumulative suite on every PR.

---

## 28. Demo Scenario

1. **D-01** — Sign in, create project, confirm isolated workspace.
2. **D-02** — Vague idea → Requirements Agent extracts + flags ambiguity → approve → persisted.
3. **D-03** — Request architecture → Architecture Agent proposes components → graph renders.
4. **D-04** — Multi-turn follow-up referencing earlier turns → correct project-aware response.
5. **D-05** — Accept an architecture decision → later ask why it was chosen → Decision Ledger answers from stored rationale.
6. **D-06** — Change a requirement → deterministic traversal identifies affected artifacts → **Gemini explains why** → impact report shown → high-impact confirmation modal → user approves.
7. **D-07** — Testing Agent generates tests from accepted requirements → coverage dashboard updates.
8. **D-08** — Risk Agent identifies risks from architecture → scored list appears.
9. **D-09** — *(P1 — Review Agent; shown as "coming soon" stub if judges ask, never faked.)*
10. **D-10** — Feed prompt-injection text → confirm no unauthorized mutation occurs.
11. **D-11** — Attempt cross-user access with a second account → confirm denial.
12. **D-12** — Security panel first:

```
Gemini Credential
-----------------
Storage: Google Cloud Secret Manager
Access: Cloud Run Service Account
Frontend Access: NONE
```

If a judge asks for proof after the panel, browser DevTools/network inspection can then be used as backup — it is not the primary demonstration.

`docs/demo-script.md` (owned by the human integration owner) contains this as a literal, rehearsable run-of-show.

---

## 29. Dependency Graph

```
Contract drafting (Proposal + ModelClient drafted first, Section 9)
        ↓
GCP/Firebase project exists
        ↓
┌─────────────────────────────────────────────────────────────────────┐
│  A-001→A-005 (auth+repo foundation) │ B-001→B-003 (frontend shell,   │
│  A-008b (conversation repo)         │   mockable before A lands)     │
│  A-009 (approval, vs fake proposal) │ D-001→D-002 (trace links,      │
│  C-001→C-006 (ModelClient, base,    │   graph assembler)             │
│    context, tools)                  │                                 │
│  C-002b (Gemini smoke test —        │                                 │
│    connectivity only, Section 16.3) │                                 │
│  E-001,E-002,E-003,E-012 (infra)    │                                 │
└─────────────────────────────────────────────────────────────────────┘
        ↓
C-007 (Requirements Agent — the one agent the first runtime slice needs)
        ↓
C-012 (Orchestrator, built against Requirements alone) → C-013 (Chat API, depends on A-008b for conversation persistence)
        ↓
[C-002b smoke-test route retired]
        ↓
Vertical Slice 1 complete
        ↓
C-008 (Architecture) ∥ D-003→D-004 (graph API + reusable graph component) → B-018 (architecture page composition, Account 2 integrates the component)
        ↓
Vertical Slice 2 complete
        ↓
D-005 (traversal) → D-006 (impact service) ← C-016 (Gemini explainer)
        ↓
D-007 → D-008 (impact API + reusable impact component) → B-019 (impact page composition, Account 2 integrates the component)
        ↓
Vertical Slice 3 complete
        ↓
C-009, C-010, C-011 (Planning, Testing, Risk) ∥ A-013 (dashboard)
        ↓
Vertical Slice 4 complete
        ↓
Security hardening → Full QA → Deployment → Demo polish
```

**The single narrowest point in the whole graph is still A-009 (approve/reject transaction):** it is the only task every other account's "does my proposal actually get persisted" story depends on. It is scheduled as early as A-005 + the Proposal contract allow, developed against a fake proposal, and never gated on all agents existing.

---

## 30. Critical Path

Phases remain useful as a scheduling/documentation view, but **no task in this plan is blocked on "Phase N fully complete."** Each phase below states real upstream task dependencies, not phase-completion dependencies.

| Phase | Focus | Real dependency (not "previous phase done") |
|---|---|---|
| 0 | Contract drafting + minimal infra | None |
| 1 | Auth + project persistence + frontend shell + AI foundation, in parallel | Draft contracts exist |
| 2 | Gemini smoke test (C-002b, connectivity only) → Requirements Agent + Orchestrator + Chat + conversation persistence | C-001–C-006, A-008b |
| 3 | Vertical Slice 1 complete | C-007, C-012, C-013, A-008b, A-009 |
| 4 | Architecture + Graph (Vertical Slice 2) | Slice 1's contracts stable, D-001–D-002 already done in parallel |
| 5 | Change Impact (Vertical Slice 3) | D-005, C-016 |
| 6 | Testing + Risk + Dashboard (Vertical Slice 4) | Accepted requirements/components exist (can develop against fixtures earlier) |
| 7 | Security hardening | Everything security-relevant exists to test against |
| 8 | Full QA / evaluation | E-001 fixtures, most of Account 3 and D-005 |
| 9 | Deployment | All prior |
| 10 | Demo polish | All prior |

Execution order used for scheduling purposes:

```
Contracts + minimal infrastructure
        ↓
Backend foundation + frontend shell + AI core in parallel
        ↓
Vertical Slice 1 → Vertical Slice 2 → Vertical Slice 3 → Vertical Slice 4
        ↓
Security hardening → Full QA → Deployment → Demo polish
```

Not:

```
Phase 0 must finish → Phase 1 must finish → Phase 2 must finish → etc.  ← rejected structure
```

---

## 31. Parallel Execution Plan

**Can run fully simultaneously starting as soon as draft contracts exist:**
- Account 1's foundation tasks (A-001–A-011, including A-008b conversation persistence and A-009 against a fake proposal).
- Account 2's shell tasks (B-001, B-002), and B-003 once the API contract has a stable *shape* — full backend implementation not required.
- Account 3's foundation tasks (C-001–C-006), including C-002b (Gemini smoke test) as soon as C-001/C-002 land — it does not wait for C-007.
- Account 4's data-layer tasks (D-001, D-002).
- All of Account 5's Phase-0 infra tasks (E-001, E-002, E-003, E-012).

**Can run simultaneously once their foundations land:**
- Architecture, Planning, Testing, Risk agents (C-008–C-011) — four separate accounts/sessions, four separate files, zero shared state beyond the already-frozen base classes. (Requirements, C-007, must exist slightly earlier — Section 16.)
- All of Account 2's domain pages (B-010–B-015, B-018, B-019).
- D-004 and D-008 (reusable graph/impact components) can start against a hand-authored fixture JSON before D-003/D-007's real endpoints exist; B-018/B-019 (the pages that host them) can scaffold against a stubbed version of those components in parallel, then wire the real ones in once D-004/D-008 land — this is the same mock-first pattern applied to the Account 2 ↔ Account 4 component boundary.

**Must be strictly sequential:**
1. Draft contracts before literally anything else (though "drafted" ≠ "frozen" — Section 2).
2. Real Firebase/GCP project before A-001 or B-001.
3. A-002 before A-003 before A-006.
4. A-005 before any specific `*_repo.py`.
5. C-001→C-006 before any specialist agent.
6. **C-007 (Requirements Agent) before C-012 (Orchestrator) is meaningfully testable; C-012 AND A-008b (conversation persistence) both before C-013 (Chat API) is complete** — a real runtime chain (Section 16), not just a file-ownership convenience. (C-002b, the Gemini smoke test, is independent of this chain — it validates connectivity before C-007 exists and is retired once C-013 lands, Section 16.3.)
7. A-009 developed early against a fake proposal, built on the transaction-aware `RepositoryBase` and `ApprovalService` (Section 13.4–13.5); must be solid before any true end-to-end demo scenario involving approval.
8. D-005 before D-006/D-007; C-016 before D-006 (impact service needs the explainer).
9. D-004 before B-018 wires the real component in; D-008 before B-019 wires the real component in — Account 2's page composition can scaffold against a stub first, but the real integration is sequential on Account 4's component landing.

**Should be mocked initially, then wired:** frontend pages against a mocked `api-client.ts`; the graph renderer against fixture JSON; Gemini calls in early agent development against a stubbed `ModelClient` implementation.

**Should NOT be built yet:** Review Agent real implementation; artifact upload/repository import; multi-agent fan-out routing; configurable auto-apply policy for `LOW_IMPACT_WRITE` (P0 always confirms); tablet responsiveness pass.

**Must be production-correct from day one:** token verification (A-002) and project-ownership checks (A-003); the approve/reject transaction (A-009) and concurrency logic (A-014); Firestore Security Rules (A-011, as defense-in-depth, not the primary boundary); Secret Manager credential handling (A-010).

---

## 32. Risks / Time Sinks

| Risk | Why it's dangerous | Mitigation |
|---|---|---|
| Overengineering the orchestrator | Tempting to build true multi-agent fan-out or a generic tool-routing DSL before any single agent works end-to-end | P0 orchestrator is deliberately single-agent routing, proven against Requirements Agent alone first (Section 16) |
| The A-009 transaction is underestimated | Touches every entity repo, needs a real Firestore transaction, must handle concurrent stale-version cases, and is the seam where "AI proposal" becomes "real project state" for every feature | Flagged explicitly as non-parallelizable, scheduled early against a fake proposal, given an L complexity rating with its own mandatory concurrency test (Section 13.5), and coordinated through a single `ApprovalService` over transaction-aware repositories rather than ad hoc `*_repo.py` writes |
| Synchronous agent calls creating latency/timeout problems live | If a live demo hits a slow Gemini response with no background job queue, the UI has nothing to show | Chat UI shows a "thinking" state immediately on request send, independent of backend latency |
| Contract drift between Pydantic and TypeScript | Silent field-name mismatches are the most common parallel-development bug class, and fail silently | Alias generator is an early task, not a nice-to-have; `find_contract_usages.py` run before any contract change |
| Firestore query patterns not matching indexes, discovered late | Firestore fails hard on missing indexes, often only surfacing during integration/e2e testing | A-012 explicitly revisits indexes once Account 3's real context-retrieval query patterns exist |
| Building the Review Agent because it's "already speced" | Easy to rationalize as "just one more agent," but it's P1 and adds no P0-requirement coverage | Explicitly cut to a 501-stub task with a one-line justification in Section 33 |
| Evaluation harness left to the last week | It's what turns "the demo looked good" into real precision/recall numbers, but has no user-facing UI | Scheduled explicitly before final deployment, can run partial results incrementally |
| Prompt injection testing treated as a checkbox | Easy to write one trivial injection test that passes, creating false confidence | Fixtures designed to be realistic-looking (e.g., a requirement statement that reads naturally but contains an embedded instruction), not just obviously-adversarial strings |
| Treating the P0 Gemini impact explanation as an excuse to build a bigger semantic system | The instruction is "lightweight," and scope creep here re-introduces the overengineering risk this plan explicitly cuts elsewhere | `impact_explainer.py` is one call over an already-known affected set — it never re-derives the set and never does its own retrieval |

**Explicitly not a time sink (confirmed, not silently assumed):** microservices decomposition, Kubernetes, a graph database, RAG/vector search, LangChain/LangGraph, MCP, or sandboxed execution. None of these are P0 dependencies anywhere in this plan.

---

## 33. P0 / P1 / P2 Scope

### P0 — Competition Vertical Slice

Firebase Auth · user-isolated Firestore · Secret Manager · FastAPI · Next.js frontend · multi-turn Gemini · `ModelClient` + `GeminiProvider` · **five** specialist agents (Requirements, Architecture, Planning, Testing, Risk) · custom orchestrator (proven against Requirements alone first) · proposal/approval (built early, Section 13) · human approval · audit · versioning · traceability graph · deterministic change-impact traversal **and** lightweight Gemini semantic impact explanation (both P0, Section 18) · architecture visualization · testing/risk/planning artifacts · security tests · CI/CD · deployment · competition demo.

| Capability | P0 depth |
|---|---|
| Firebase Authentication | Full |
| User-isolated Firestore | Full |
| Secret Manager credential retrieval | Full |
| Gemini multi-turn interaction | Full |
| Project CRUD + dashboard shell | Full |
| Requirements Agent | Single-pass extraction + ambiguity flagging |
| Architecture Agent + graph | Single-pass component proposal + React Flow render |
| Planning Agent | Task decomposition from *approved* requirements only |
| Testing Agent | Generate tests from requirements; simple coverage count |
| Risk Agent | Identify + score, no mitigation tracking workflow |
| Review Agent | **P1** — 501 stub only |
| Change Impact Analysis | Deterministic traversal **+ lightweight Gemini explanation, both P0** |
| Approval workflow | Full |
| Audit trail | Full |
| Decision Ledger | Create + list + view, no supersession UI |
| Traceability links | Auto-created from agent outputs |
| Project health dashboard | Simple counts |
| Security invariant enforcement | Full — non-negotiable |

### P1 — Important Differentiation (does not block P0)

- Review Agent real implementation + artifact upload + repository-aware review.
- Decision rationale/alternatives richer capture (schema already exists in P0).
- Richer invalidated-decision detection during impact analysis (structured supersession, beyond the P0 explanation).
- Mitigation action tracking.
- True multi-agent fan-out in a single turn.
- Configurable auto-apply policy for `LOW_IMPACT_WRITE`.
- Tablet responsiveness.
- Full evaluation dashboard beyond the fixed-fixture CLI harness.
- LangGraph evaluation (adopt only if justified — Section 5, decision 3).

### P2 — Post-Competition Expansion

GitHub repository integration · pull-request review workflows, CI ingestion · team roles / multi-user collaboration · historical architecture evolution visualization · change simulation/rollback planning · `ClaudeProvider`/`OpenAIProvider` + model routing · MCP tool exposure · sandboxed repository execution · autonomous implementation loops · advanced observability · sophisticated evaluation · autonomous remediation.

**Rule enforced throughout:** no P1/P2 task may appear as a dependency of a P0 task.

---

## 34. Post-Competition Evolution

Each mapping states the concrete P0 seam that makes the evolution possible without rewriting the core system.

| From (P0) | To (post-competition) | Seam that enables it |
|---|---|---|
| Custom orchestrator, single-agent routing | LangGraph | `BaseAgent.execute()`'s template-method shape means a LangGraph node can wrap `execute()` directly; `Orchestrator.route()`'s signature maps onto a LangGraph conditional edge function |
| Typed tool layer | MCP | `BaseTool`'s name/args_schema/execute() shape is already structurally close to an MCP tool definition |
| Artifact analysis (minimal) | Repository/GitHub integration | The `Artifact` entity is the same shape a repository file would take — a GitHub file becomes another `Artifact` with a different `storageRef` scheme |
| Code review via supplied text (P1 Review Agent) | Sandboxed execution | `CodeReview`'s contract stays the same; only the implementation inside `execute()` changes |
| Structured logging | OpenTelemetry | `requestId`/`runId` correlation fields already required in P0 are the same IDs OTel spans need |
| `GeminiProvider` behind `ModelClient` | Model router (Gemini + Claude + OpenAI) | Agents never call Gemini directly (Section 15) — swapping/routing the client is invisible to agent logic |
| Deterministic impact analysis + lightweight Gemini explanation | Richer semantic dependency analysis | `impact_service.py` already has both halves; deeper analysis extends it, it does not replace the deterministic traversal, which remains ground truth |
| Manual implementation, human-approved proposals | Controlled autonomous coding workflows | The `Proposal`/`ActionClass` envelope and approval boundary already model "AI proposes, application code decides, human approves for high-impact" — more autonomy later is a policy change inside the existing envelope, not a new state-management model |

**Explicit guardrail:** none of the P1/P2 items above are implemented, stubbed with real logic, or partially built during P0 beyond the seam itself.

---

## 35. Final Build Checklist

In the exact order to start, for a team beginning today:

1. [ ] **Draft (not necessarily freeze) every Pydantic contract**, especially the Proposal envelope and `ModelClient` interface — these two are drafted first because A-009 and Account 3's foundation both need them immediately.
2. [ ] Create the real Firebase project, enable Google sign-in, create the Firestore database, create the GCP project and the Secret Manager secret holding the Gemini API key.
3. [ ] Pydantic alias generator + TS contract mirrors + frozen error/response envelope.
4. [ ] Evaluation fixtures skeleton, test harness, CI pipeline, secret-scan script — in parallel with the above, same day (Account 5).
5. [ ] Firebase Admin init, token verification, project-access dependency, config, repository base (Account 1) — the single most-depended-on chain in the entire plan.
6. [ ] Firebase client init, login page, typed API client, built against provisional/mocked contracts if needed (Account 2) — unblocks every frontend page.
7. [ ] `ModelClient` abstraction, `GeminiProvider`, `BaseAgent`, context builder, typed tool base (Account 3) — unblocks every agent.
8. [ ] TraceLink repo, graph assembler, and reusable graph components (`GraphCanvas`, `GraphNode`, `GraphEdge`) (Account 4) — unblocks Account 2's page composition (B-018/B-019) and impact analysis; start early even though it becomes demo-relevant later. Account 4 never touches a `frontend/app/*` file (Section 8.2/8.4).
9. [ ] Project CRUD endpoints. Confirm the core mechanic works (sign in → create project → see only your own projects) before touching anything else.
10. [ ] Secret Manager retrieval + Firestore Security Rules. Do this now, not during "security hardening" later — foundational, not a hardening pass.
11. [ ] **Start the approve/reject transaction against a hand-constructed fake `Proposal`, in parallel with the first real agent being built. Do not wait for all five agents to exist.** Build it against the transaction-aware `RepositoryBase` and `ApprovalService` (Section 13.4), not against ad hoc repository writes.
12. [ ] **Get one direct Gemini smoke-test endpoint working end-to-end before the Requirements Agent exists.** This validates frontend → authentication → FastAPI → `ModelClient` → Gemini → response connectivity (C-002b). This is a connectivity check only — it is not the chat API, has no persistence, and is retired once the real `/chat` endpoint (C-013) lands. Persistent, multi-turn, project-aware chat begins only after the Requirements Agent (Step 13 below) and the Orchestrator built against it (C-012) are available. **A-008b (`conversation_repo.py`) is a hard dependency of C-013, not a parallel nice-to-have — start it now so conversation persistence exists before C-013 is wired up, and do not mark C-013 done until it is actually calling A-008b.**
13. [ ] **Requirements Agent, as the first real specialist agent** — the orchestrator's P0 correctness bar is proven against this agent alone before any other agent is wired in.
14. [ ] Build the lightweight Gemini impact explainer (`impact_explainer.py`) alongside the deterministic traversal (`traversal.py`) as one P0 feature, not deterministic-now/AI-later.
15. [ ] From here, fan out: separate accounts/sessions each take Architecture, Planning, Testing, or Risk agents, or continue the frontend page-by-page build, or the impact-analysis chain — all genuinely independent at this point (Section 16 caveat on runtime order still applies for the demo script, not for who can write which file).
16. [ ] **Cumulative CI discipline starts now and never stops:** every subsequent PR runs the *cumulative* test suite, not just its own new tests — set this up before Step 15's fan-out begins, not after.

Everything after Step 16 is the vertical-slice plan in Sections 19–22, executed by whichever accounts are assigned to which slice, converging at Gate 10.

---

### Internal consistency audit (confirmed before this document was finalized)

- [x] Exactly five P0 specialist agents named; Review Agent is P1.
- [x] Five Claude coding accounts defined; human integration owner is separate, not a sixth coding account.
- [x] Approval transaction appears early in the critical path, developed against a fake proposal.
- [x] Orchestrator's P0 correctness bar is proven against the Requirements Agent alone before other agents are wired in.
- [x] P0 Change Impact includes both deterministic traversal AND Gemini semantic explanation.
- [x] Mock-first development is explicitly allowed; only merge requires conformance to canonical contracts.
- [x] Backend authorization is correctly described as the Admin SDK security boundary; Firestore Rules are not described as protecting Admin SDK access.
- [x] Account 5 is Security + Infrastructure + QA.
- [x] `ModelClient` abstraction exists early, before any agent is written.
- [x] Gemini is the only P0 provider; LangGraph, graph DB, vector DB, RAG are not in P0.
- [x] Vertical slices are the actual execution strategy; phases are a documentation view only.
- [x] Contract-first architecture, proposal/approval model, human approval, Secret Manager, Firebase Auth, Firestore isolation, and multi-turn Gemini are all preserved.
- [x] CI is cumulative; demo acceptance gates remain.
- [x] The first complete vertical slice produces a usable NEXUS.
- [x] Account 2 is the sole owner of `frontend/app/*` and all page-level composition; Account 4 owns only `frontend/components/graph/*` on the frontend and never edits `architecture/page.tsx` or `impact/page.tsx` (Section 8.2, 8.4).
- [x] One file, one owner holds everywhere, including the graph/impact page boundary (B-018/B-019 vs. D-004/D-008).
- [x] The Gemini smoke test (C-002b) is explicitly separate from persistent, project-aware multi-turn chat; it is retired once C-013 lands (Section 16.3).
- [x] Requirements Agent → Orchestrator → Chat API dependency chain remains intact and unbroken by the smoke test.
- [x] Conversation/message persistence has explicit Account 1 ownership via A-008b (`conversation_repo.py`); Account 3 calls into it but does not own it.
- [x] `ApprovalService` (`backend/services/approval_service.py`) exists and coordinates the approval transaction; `RepositoryBase` is transaction-aware (`create()`/`update()` accept an optional `transaction`) (Section 13.4–13.5).
- [x] The approval transaction's atomicity is stated as an explicit invariant, and a two-concurrent-approvals test is a mandatory precondition for calling A-009/A-014 done.
- [x] Next.js is locked to a static/client-rendered P0 deployment on Firebase Hosting; FastAPI/Cloud Run is the only privileged backend; no Next.js server routes exist (Section 5 decision 16, Section 26).
- [x] `LOW_IMPACT_WRITE` requires the same explicit-confirmation path as `HIGH_IMPACT_WRITE`/`BULK_WRITE` in P0; no action class is auto-applied (Section 9.2).
- [x] Agent domain outputs (`Requirement[]`, `Component[]`, etc.) are reconciled with the `Proposal` envelope: agents validate against their domain type internally, then wrap the result in a `Proposal` before it leaves the agent boundary (Section 14.1.1).
