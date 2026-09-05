"""Unit tests for NEXUS domain models and camelCase serialization.

Follows Implementation Plan §9.1, §9.5, Data Model, and ADR-023, ADR-024.
"""

from datetime import datetime
from backend.domain.models import (
    ActionClass,
    AuditEvent,
    Component,
    Conversation,
    Decision,
    ErrorResponse,
    Message,
    Project,
    ProjectCreate,
    ProjectDashboard,
    ProjectUpdate,
    Proposal,
    ProposalApprovalResponse,
    ProposalRejectionResponse,
    Requirement,
    Risk,
    Task,
    TestCase,
    TraceLink,
    compute_risk_score,
)


def test_camel_case_serialization():
    """Verify that Python snake_case models serialize to camelCase JSON."""
    now = datetime(2026, 9, 5, 12, 0, 0)
    project = Project(
        project_id="p-123",
        owner_uid="user-456",
        name="Alpha System",
        description="Core architecture",
        goal="Autonomous SDLC",
        status="active",
        version=2,
        created_at=now,
        updated_at=now,
    )
    dumped = project.model_dump(by_alias=True)

    assert "projectId" in dumped
    assert "ownerUid" in dumped
    assert "createdAt" in dumped
    assert "updatedAt" in dumped
    assert dumped["projectId"] == "p-123"
    assert dumped["ownerUid"] == "user-456"
    assert dumped["version"] == 2


def test_error_response_serialization():
    """Verify ErrorResponse follows standard envelope."""
    error = ErrorResponse(
        error_code="STALE_VERSION",
        message="Version mismatch",
        request_id="req-abc-123",
    )
    dumped = error.model_dump(by_alias=True)
    assert dumped["errorCode"] == "STALE_VERSION"
    assert dumped["message"] == "Version mismatch"
    assert dumped["requestId"] == "req-abc-123"


def test_risk_score_computation():
    """Verify server-side Risk score computation (ADR-024)."""
    # low * low = 1 * 1 = 1
    r1 = Risk(
        risk_id="r1",
        project_id="p1",
        category="security",
        description="Data leak",
        likelihood="low",
        impact="low",
    )
    assert r1.score == 1

    # medium * high = 2 * 3 = 6
    r2 = Risk(
        risk_id="r2",
        project_id="p1",
        category="performance",
        description="Latency spike",
        likelihood="medium",
        impact="high",
    )
    assert r2.score == 6

    # high * critical = 3 * 4 = 12
    r3 = Risk(
        risk_id="r3",
        project_id="p1",
        category="availability",
        description="Total outage",
        likelihood="high",
        impact="critical",
    )
    assert r3.score == 12


def test_proposal_model_identity():
    """Verify Proposal schema and ActionClass enum values."""
    proposal = Proposal(
        proposal_id="act-789",
        project_id="p1",
        run_id="run-1",
        action_class=ActionClass.HIGH_IMPACT_WRITE,
        entity_type="requirement",
        entity_payload={"statement": "Must do X"},
        confidence="high",
        status="pending",
        project_version_at_creation=3,
    )
    dumped = proposal.model_dump(by_alias=True)
    assert dumped["proposalId"] == "act-789"
    assert dumped["actionClass"] == "HIGH_IMPACT_WRITE"
    assert dumped["projectVersionAtCreation"] == 3
    assert dumped["status"] == "pending"


def test_conversation_and_message_models():
    """Verify Conversation and Message model fields (ADR-021)."""
    conv = Conversation(
        conversation_id="c-1",
        project_id="p-1",
        title="Requirements session",
    )
    dumped_conv = conv.model_dump(by_alias=True)
    assert dumped_conv["conversationId"] == "c-1"
    assert dumped_conv["title"] == "Requirements session"

    msg = Message(
        message_id="m-1",
        conversation_id="c-1",
        project_id="p-1",
        role="assistant",
        content="Proposed requirement",
        proposal_ids=["prop-1", "prop-2"],
    )
    dumped_msg = msg.model_dump(by_alias=True)
    assert dumped_msg["messageId"] == "m-1"
    assert dumped_msg["proposalIds"] == ["prop-1", "prop-2"]
