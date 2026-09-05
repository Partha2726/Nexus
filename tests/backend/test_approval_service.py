"""Unit tests for Proposal Approval and Rejection Service.

Follows Implementation Plan §13.5, Data Model §0, §2.9, API Contract §11, and ADR-017, ADR-020.
"""

import pytest
from backend.domain.exceptions import (
    ForbiddenException,
    NotFoundException,
    StaleVersionException,
)
from backend.domain.models import (
    ActionClass,
    Project,
    Proposal,
)
from backend.firestore import (
    get_audit_repo,
    get_component_repo,
    get_decision_repo,
    get_project_repo,
    get_proposal_repo,
    get_requirement_repo,
    get_risk_repo,
    get_task_repo,
    get_test_repo,
    get_trace_link_repo,
    reset_in_memory_store,
)
from backend.services import ApprovalService


@pytest.fixture(autouse=True)
def setup_store():
    reset_in_memory_store()
    yield
    reset_in_memory_store()


@pytest.fixture
def service():
    return ApprovalService()


def test_approve_requirement_proposal_success(service):
    """Test successful requirement proposal approval and transactional persistence."""
    project_repo = get_project_repo()
    proposal_repo = get_proposal_repo()
    req_repo = get_requirement_repo()
    audit_repo = get_audit_repo()

    project = Project(
        project_id="proj-1",
        owner_uid="alice",
        name="Test Project",
        version=1,
    )
    project_repo.create(project)

    proposal = Proposal(
        proposal_id="act-req-1",
        project_id="proj-1",
        run_id="run-1",
        action_class=ActionClass.PROPOSE,
        entity_type="requirement",
        entity_payload={
            "requirement_id": "req-101",
            "type": "functional",
            "statement": "The system shall encrypt data at rest.",
            "priority": "must",
            "acceptance_criteria": ["AES-256 enabled"],
        },
        status="pending",
        project_version_at_creation=1,
    )
    proposal_repo.create(proposal)

    # Execute approval (actionId == proposalId)
    response = service.approve(
        project_id="proj-1",
        action_id="act-req-1",
        user_uid="alice",
    )

    # 1. Verify response shape
    assert response.proposal_id == "act-req-1"
    assert response.status == "approved"
    assert response.entity_type == "requirement"
    assert response.entity_id == "req-101"
    assert response.project_version == 2
    assert response.audit_event_id.startswith("event-")

    # 2. Verify authoritative Requirement record created
    saved_req = req_repo.get("req-101")
    assert saved_req is not None
    assert saved_req.statement == "The system shall encrypt data at rest."
    assert saved_req.status == "accepted"

    # 3. Verify Project version incremented
    updated_project = project_repo.get("proj-1")
    assert updated_project.version == 2

    # 4. Verify Proposal status updated
    saved_prop = proposal_repo.get("act-req-1")
    assert saved_prop.status == "approved"

    # 5. Verify AuditEvent created
    events = audit_repo.list_by_project("proj-1")
    assert len(events) == 1
    assert events[0].action == "proposal_approved"
    assert events[0].target_id == "req-101"
    assert events[0].actor_uid == "alice"


def test_approve_component_with_trace_links(service):
    """Test component approval derives TraceLink to referenced requirement."""
    project_repo = get_project_repo()
    proposal_repo = get_proposal_repo()
    comp_repo = get_component_repo()
    tl_repo = get_trace_link_repo()

    project = Project(
        project_id="proj-1",
        owner_uid="alice",
        name="Test Project",
        version=1,
    )
    project_repo.create(project)

    proposal = Proposal(
        proposal_id="act-comp-1",
        project_id="proj-1",
        run_id="run-1",
        action_class=ActionClass.PROPOSE,
        entity_type="component",
        entity_payload={
            "component_id": "comp-auth",
            "name": "AuthService",
            "type": "service",
            "requirement_refs": ["req-101"],
        },
        status="pending",
        project_version_at_creation=1,
    )
    proposal_repo.create(proposal)

    response = service.approve(
        project_id="proj-1",
        action_id="act-comp-1",
        user_uid="alice",
    )

    assert response.status == "approved"
    assert comp_repo.get("comp-auth") is not None

    # Verify derived TraceLink
    links = tl_repo.list_by_source("proj-1", "comp-auth")
    assert len(links) == 1
    assert links[0].relation == "IMPLEMENTS"
    assert links[0].target_id == "req-101"


def test_approve_stale_proposal_rejected_with_409(service):
    """Test that a proposal created against version 1 is rejected if project is version 2 (STALE_VERSION)."""
    project_repo = get_project_repo()
    proposal_repo = get_proposal_repo()

    project = Project(
        project_id="proj-1",
        owner_uid="alice",
        name="Test Project",
        version=2,  # Project has already advanced to version 2
    )
    project_repo.create(project)

    stale_proposal = Proposal(
        proposal_id="act-stale",
        project_id="proj-1",
        run_id="run-1",
        action_class=ActionClass.PROPOSE,
        entity_type="requirement",
        entity_payload={"statement": "Stale feature"},
        status="pending",
        project_version_at_creation=1,  # Created at version 1
    )
    proposal_repo.create(stale_proposal)

    with pytest.raises(StaleVersionException) as exc:
        service.approve(
            project_id="proj-1",
            action_id="act-stale",
            user_uid="alice",
        )
    assert "current project version is 2" in str(exc.value)


def test_approve_non_owner_forbidden(service):
    """Test that a non-owner cannot approve proposals."""
    project_repo = get_project_repo()
    proposal_repo = get_proposal_repo()

    project = Project(
        project_id="proj-1",
        owner_uid="alice",
        name="Alice Project",
        version=1,
    )
    project_repo.create(project)

    proposal = Proposal(
        proposal_id="act-1",
        project_id="proj-1",
        run_id="run-1",
        action_class=ActionClass.PROPOSE,
        entity_type="requirement",
        entity_payload={"statement": "Feature X"},
        status="pending",
        project_version_at_creation=1,
    )
    proposal_repo.create(proposal)

    with pytest.raises(ForbiddenException):
        service.approve(
            project_id="proj-1",
            action_id="act-1",
            user_uid="bob",
        )


def test_reject_proposal_behavior(service):
    """Test proposal rejection marks status rejected without incrementing project version."""
    project_repo = get_project_repo()
    proposal_repo = get_proposal_repo()
    audit_repo = get_audit_repo()

    project = Project(
        project_id="proj-1",
        owner_uid="alice",
        name="Test Project",
        version=1,
    )
    project_repo.create(project)

    proposal = Proposal(
        proposal_id="act-reject-1",
        project_id="proj-1",
        run_id="run-1",
        action_class=ActionClass.PROPOSE,
        entity_type="requirement",
        entity_payload={"statement": "Unwanted feature"},
        status="pending",
        project_version_at_creation=1,
    )
    proposal_repo.create(proposal)

    response = service.reject(
        project_id="proj-1",
        action_id="act-reject-1",
        user_uid="alice",
        reason="Out of scope",
    )

    # 1. Verify response
    assert response.proposal_id == "act-reject-1"
    assert response.status == "rejected"
    assert response.audit_event_id.startswith("event-")

    # 2. Verify Proposal status is rejected
    updated_prop = proposal_repo.get("act-reject-1")
    assert updated_prop.status == "rejected"

    # 3. Verify Project version is NOT incremented on rejection
    unchanged_project = project_repo.get("proj-1")
    assert unchanged_project.version == 1

    # 4. Verify AuditEvent created for rejection
    events = audit_repo.list_by_project("proj-1")
    assert len(events) == 1
    assert events[0].action == "proposal_rejected"


def test_approve_nonexistent_project_or_proposal(service):
    """Test 404 error handling for missing project or proposal during approval."""
    project_repo = get_project_repo()
    proposal_repo = get_proposal_repo()

    project = Project(project_id="proj-1", owner_uid="alice", name="Test", version=1)
    project_repo.create(project)

    # Missing proposal
    with pytest.raises(NotFoundException):
        service.approve(project_id="proj-1", action_id="nonexistent-prop", user_uid="alice")

    # Missing project
    with pytest.raises(NotFoundException):
        service.approve(project_id="nonexistent-proj", action_id="act-1", user_uid="alice")


def test_approve_proposal_cross_project_mismatch(service):
    """Test that approving a proposal belonging to project-B under project-A fails with 404."""
    project_repo = get_project_repo()
    proposal_repo = get_proposal_repo()

    p_a = Project(project_id="proj-a", owner_uid="alice", name="Proj A", version=1)
    p_b = Project(project_id="proj-b", owner_uid="alice", name="Proj B", version=1)
    project_repo.create(p_a)
    project_repo.create(p_b)

    prop_b = Proposal(
        proposal_id="act-b-1",
        project_id="proj-b",
        run_id="run-1",
        action_class=ActionClass.PROPOSE,
        entity_type="requirement",
        entity_payload={"statement": "B Req"},
        status="pending",
        project_version_at_creation=1,
    )
    proposal_repo.create(prop_b)

    with pytest.raises(NotFoundException):
        service.approve(project_id="proj-a", action_id="act-b-1", user_uid="alice")


def test_approve_non_pending_proposal_fails(service):
    """Test that already approved/rejected proposals cannot be approved again."""
    project_repo = get_project_repo()
    proposal_repo = get_proposal_repo()

    project = Project(project_id="proj-1", owner_uid="alice", name="Test", version=1)
    project_repo.create(project)

    prop = Proposal(
        proposal_id="act-approved",
        project_id="proj-1",
        run_id="run-1",
        action_class=ActionClass.PROPOSE,
        entity_type="requirement",
        entity_payload={"statement": "Already done"},
        status="approved",
        project_version_at_creation=1,
    )
    proposal_repo.create(prop)

    with pytest.raises(StaleVersionException):
        service.approve(project_id="proj-1", action_id="act-approved", user_uid="alice")


def test_rejection_error_scenarios(service):
    """Test rejection error scenarios: wrong user, wrong project, missing proposal, non-pending."""
    project_repo = get_project_repo()
    proposal_repo = get_proposal_repo()

    project = Project(project_id="proj-1", owner_uid="alice", name="Test", version=1)
    project_repo.create(project)

    prop = Proposal(
        proposal_id="act-1",
        project_id="proj-1",
        run_id="run-1",
        action_class=ActionClass.PROPOSE,
        entity_type="requirement",
        entity_payload={"statement": "Some req"},
        status="pending",
        project_version_at_creation=1,
    )
    proposal_repo.create(prop)

    # 1. Wrong user
    with pytest.raises(ForbiddenException):
        service.reject(project_id="proj-1", action_id="act-1", user_uid="bob")

    # 2. Missing proposal
    with pytest.raises(NotFoundException):
        service.reject(project_id="proj-1", action_id="missing-act", user_uid="alice")

    # 3. Missing project
    with pytest.raises(NotFoundException):
        service.reject(project_id="missing-proj", action_id="act-1", user_uid="alice")

    # Reject successfully first
    service.reject(project_id="proj-1", action_id="act-1", user_uid="alice")

    # 4. Reject already rejected proposal
    with pytest.raises(StaleVersionException):
        service.reject(project_id="proj-1", action_id="act-1", user_uid="alice")


def test_transaction_rollback_on_downstream_failure(service, monkeypatch):
    """Test that failure during transaction stages does not leave partial writes."""
    project_repo = get_project_repo()
    proposal_repo = get_proposal_repo()
    req_repo = get_requirement_repo()
    audit_repo = get_audit_repo()

    project = Project(project_id="proj-txn", owner_uid="alice", name="Txn Test", version=1)
    project_repo.create(project)

    proposal = Proposal(
        proposal_id="act-fail-txn",
        project_id="proj-txn",
        run_id="run-1",
        action_class=ActionClass.PROPOSE,
        entity_type="requirement",
        entity_payload={
            "requirement_id": "req-txn-fail",
            "type": "functional",
            "statement": "Fail midway",
            "priority": "must",
        },
        status="pending",
        project_version_at_creation=1,
    )
    proposal_repo.create(proposal)

    # Monkeypatch audit_repo.create to raise an unexpected runtime error
    def failing_audit_create(event, transaction=None):
        raise RuntimeError("Simulated downstream write failure in AuditRepository")

    monkeypatch.setattr(service.audit_repo, "create", failing_audit_create)

    with pytest.raises(RuntimeError) as exc:
        service.approve(project_id="proj-txn", action_id="act-fail-txn", user_uid="alice")
    assert "Simulated downstream write failure" in str(exc.value)

    # Verify no partial writes committed
    # 1. Project version should still be 1
    assert project_repo.get("proj-txn").version == 1
    # 2. Proposal should still be pending
    assert proposal_repo.get("act-fail-txn").status == "pending"
    # 3. Requirement should not be persisted
    assert req_repo.get("req-txn-fail") is None
    # 4. No audit event created
    assert len(audit_repo.list_by_project("proj-txn")) == 0


def test_rejection_rollback_on_downstream_failure(service, monkeypatch):
    """Test that failure during rejection does not leave partial writes or mutate proposal status."""
    project_repo = get_project_repo()
    proposal_repo = get_proposal_repo()
    audit_repo = get_audit_repo()

    project = Project(project_id="proj-rej-txn", owner_uid="alice", name="Rej Txn", version=1)
    project_repo.create(project)

    proposal = Proposal(
        proposal_id="act-fail-rej",
        project_id="proj-rej-txn",
        run_id="run-1",
        action_class=ActionClass.PROPOSE,
        entity_type="requirement",
        entity_payload={"statement": "To be rejected"},
        status="pending",
        project_version_at_creation=1,
    )
    proposal_repo.create(proposal)

    def failing_audit_create(event, transaction=None):
        raise RuntimeError("Simulated audit creation failure during rejection")

    monkeypatch.setattr(service.audit_repo, "create", failing_audit_create)

    with pytest.raises(RuntimeError) as exc:
        service.reject(project_id="proj-rej-txn", action_id="act-fail-rej", user_uid="alice")
    assert "Simulated audit creation failure during rejection" in str(exc.value)

    # Proposal remains pending
    assert proposal_repo.get("act-fail-rej").status == "pending"
    # Project version remains 1
    assert project_repo.get("proj-rej-txn").version == 1
    # No audit event created
    assert len(audit_repo.list_by_project("proj-rej-txn")) == 0


