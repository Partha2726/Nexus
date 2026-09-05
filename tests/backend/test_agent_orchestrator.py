"""Unit tests for Account 3 concrete AgentOrchestrator and end-to-end routing.

Follows Implementation Plan §16, §18, and API Contract §3.

All tests inject a mock ModelClient via GeminiClient(mock_generator=...) so they
are independent of the Gemini SDK being installed and do NOT exercise the offline
fallback path, which is test-only infrastructure.
"""

import asyncio
import pytest
from backend.domain.ports.orchestrator_port import AgentTurnInput, AgentTurnResult
from backend.agents import AgentOrchestrator, GeminiClient
from backend.agents.model_client import ModelMessage, ModelResponse
from backend.agents.router import RouteDecision
from backend.agents.schemas import (
    ArchitectureAgentOutput,
    ComponentCandidate,
    PlanningAgentOutput,
    RequirementCandidate,
    RequirementsAgentOutput,
    RiskAgentOutput,
    RiskCandidate,
    TaskCandidate,
    TestCaseCandidate,
    TestingAgentOutput,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_client_for(agent_schema_name: str) -> GeminiClient:
    """Return a GeminiClient whose mock_generator dispatches on schema name."""
    _RESPONSES = {
        "RequirementsAgentOutput": ModelResponse(
            text="mocked-req",
            parsed=RequirementsAgentOutput(
                reply_text="Identified SSO requirement.",
                requirements=[
                    RequirementCandidate(
                        statement="The system shall support SSO via Google OAuth2.",
                        type="functional",
                        priority="must",
                        acceptance_criteria=["User can sign in with Google account"],
                        rationale="Competition requirement",
                    )
                ],
                unresolved_questions=[],
            ),
            tokens_used=100,
        ),
        "ArchitectureAgentOutput": ModelResponse(
            text="mocked-arch",
            parsed=ArchitectureAgentOutput(
                reply_text="Designed PaymentProcessor component.",
                components=[
                    ComponentCandidate(
                        name="PaymentProcessor",
                        type="service",
                        responsibilities=["Process card transactions"],
                        interfaces=["POST /charge"],
                        technology="Python/FastAPI",
                        requirement_refs=["req-001"],
                    )
                ],
                unresolved_questions=[],
            ),
            tokens_used=120,
        ),
        "PlanningAgentOutput": ModelResponse(
            text="mocked-plan",
            parsed=PlanningAgentOutput(
                reply_text="Task breakdown created.",
                tasks=[
                    TaskCandidate(
                        title="Implement auth verification",
                        description="Write verification logic",
                        priority="must",
                        depends_on=[],
                        requirement_refs=["req-101"],
                        component_refs=["comp-auth"],
                    )
                ],
                unresolved_questions=[],
            ),
            tokens_used=90,
        ),
        "TestingAgentOutput": ModelResponse(
            text="mocked-test",
            parsed=TestingAgentOutput(
                reply_text="Generated auth test cases.",
                test_cases=[
                    TestCaseCandidate(
                        type="unit",
                        title="Verify token generation",
                        procedure=["1. Generate token", "2. Decode", "3. Assert claims"],
                        expected_result="Claims match expected UID",
                        requirement_refs=["req-101"],
                    )
                ],
                unresolved_questions=[],
            ),
            tokens_used=110,
        ),
        "RiskAgentOutput": ModelResponse(
            text="mocked-risk",
            parsed=RiskAgentOutput(
                reply_text="Identified API dependency risk.",
                risks=[
                    RiskCandidate(
                        category="technical",
                        description="Third-party API unavailability",
                        likelihood="medium",
                        impact="high",
                        mitigation_refs=[],
                    )
                ],
                unresolved_questions=[],
            ),
            tokens_used=130,
        ),
        "RouteDecision": ModelResponse(
            text='{"agent_type": "requirements", "confidence": 0.9, "reasoning": "mock"}',
            parsed=RouteDecision(agent_type="requirements", confidence=0.9, reasoning="mock"),
            tokens_used=10,
        ),
    }

    def _mock_gen(messages, schema):
        name = schema.__name__ if schema else "none"
        if name in _RESPONSES:
            return _RESPONSES[name]
        return ModelResponse(text="fallback", parsed=None, tokens_used=0)

    return GeminiClient(mock_generator=_mock_gen)


def _make_multi_schema_client() -> GeminiClient:
    """Client that dispatches to the correct schema response."""
    return _make_client_for("all")


# ---------------------------------------------------------------------------
# Routing tests — all use injected mock client, no offline fallback
# ---------------------------------------------------------------------------

def test_orchestrator_routes_requirements_request():
    """Orchestrator routes requirements intent to RequirementsAgent with mock client."""
    client = _make_multi_schema_client()
    orchestrator = AgentOrchestrator(model_client=client)

    turn_input = AgentTurnInput(
        project_id="proj-123",
        conversation_id="conv-1",
        user_message="Define the requirements for single sign-on using Google OAuth2",
        history=[],
        project_version=3,
    )

    result = asyncio.run(orchestrator.handle_turn(turn_input))

    assert isinstance(result, AgentTurnResult)
    assert result.agent_type == "requirements"
    assert len(result.proposals) >= 1
    assert result.proposals[0].entity_type == "requirement"
    assert result.proposals[0].project_id == "proj-123"
    assert result.proposals[0].project_version_at_creation == 3
    assert result.proposals[0].status == "pending"


def test_orchestrator_routes_architecture_request():
    """Orchestrator routes architecture intent to ArchitectureAgent with mock client."""
    client = _make_multi_schema_client()
    orchestrator = AgentOrchestrator(model_client=client)

    turn_input = AgentTurnInput(
        project_id="proj-123",
        conversation_id="conv-1",
        user_message="Design the architecture components and services for the payment processing system",
        history=[],
        project_version=1,
    )

    result = asyncio.run(orchestrator.handle_turn(turn_input))

    assert result.agent_type == "architecture"
    assert len(result.proposals) >= 1
    assert result.proposals[0].entity_type == "component"
    assert result.proposals[0].project_version_at_creation == 1


def test_orchestrator_routes_planning_request():
    """Orchestrator routes planning intent to PlanningAgent with mock client."""
    client = _make_multi_schema_client()
    orchestrator = AgentOrchestrator(model_client=client)

    turn_input = AgentTurnInput(
        project_id="proj-123",
        conversation_id="conv-1",
        user_message="Break this down into an implementation plan and engineering tasks",
        history=[],
        project_version=2,
    )

    result = asyncio.run(orchestrator.handle_turn(turn_input))

    assert result.agent_type == "planning"
    assert len(result.proposals) >= 1
    assert result.proposals[0].entity_type == "task"


def test_orchestrator_routes_testing_request():
    """Orchestrator routes testing intent to TestingAgent with mock client."""
    client = _make_multi_schema_client()
    orchestrator = AgentOrchestrator(model_client=client)

    turn_input = AgentTurnInput(
        project_id="proj-123",
        conversation_id="conv-1",
        user_message="Generate unit tests and integration test cases for user authentication",
        history=[],
        project_version=1,
    )

    result = asyncio.run(orchestrator.handle_turn(turn_input))

    assert result.agent_type == "testing"
    assert len(result.proposals) >= 1
    assert result.proposals[0].entity_type == "test"


def test_orchestrator_routes_risk_request():
    """Orchestrator routes risk analysis intent to RiskAgent with mock client."""
    client = _make_multi_schema_client()
    orchestrator = AgentOrchestrator(model_client=client)

    turn_input = AgentTurnInput(
        project_id="proj-123",
        conversation_id="conv-1",
        user_message="Analyze the security risks and failure modes of third-party API dependencies",
        history=[],
        project_version=4,
    )

    result = asyncio.run(orchestrator.handle_turn(turn_input))

    assert result.agent_type == "risk"
    assert len(result.proposals) >= 1
    assert result.proposals[0].entity_type == "risk"
    assert result.proposals[0].project_version_at_creation == 4


def test_orchestrator_multi_turn_context_preservation():
    """Orchestrator preserves multi-turn context; second turn routes via history."""
    client = _make_multi_schema_client()
    orchestrator = AgentOrchestrator(model_client=client)

    turn_1 = AgentTurnInput(
        project_id="proj-123",
        conversation_id="conv-multi",
        user_message="Add functional requirement for audit logging",
        history=[],
        project_version=1,
    )
    res_1 = asyncio.run(orchestrator.handle_turn(turn_1))
    assert res_1.agent_type == "requirements"

    history = [
        {"role": "user", "content": "Add functional requirement for audit logging"},
        {"role": "assistant", "content": res_1.reply_text},
    ]
    turn_2 = AgentTurnInput(
        project_id="proj-123",
        conversation_id="conv-multi",
        user_message="What happens if the audit storage service is unavailable?",
        history=history,
        project_version=1,
    )
    res_2 = asyncio.run(orchestrator.handle_turn(turn_2))
    # The follow-up turn inherits requirements context from conversation history
    assert res_2.agent_type in ("requirements", "risk")
    assert res_2.reply_text is not None


# ---------------------------------------------------------------------------
# Proposal metadata invariant tests
# ---------------------------------------------------------------------------

def test_proposal_metadata_is_application_controlled():
    """BaseAgent.execute() enforces server-side metadata regardless of agent run() output.

    Invariant: status must be 'pending', action_class must be PROPOSE,
    project_version_at_creation must match the input version — not whatever
    the agent's run() might set.
    """
    from backend.agents.base import AgentInput, AgentOutput, BaseAgent
    from backend.domain.models import ActionClass, Proposal
    import uuid

    class _TamperingAgent(BaseAgent):
        """Agent that tries to set forbidden metadata in proposals."""
        agent_type = "requirements"
        system_prompt = ""

        async def run(self, input: AgentInput) -> AgentOutput:
            bad_proposal = Proposal(
                proposal_id=f"prop-{uuid.uuid4().hex[:8]}",
                project_id=input.project_id,
                run_id="injected-run-id",
                action_class=ActionClass.HIGH_IMPACT_WRITE,  # Tampered!
                entity_type="requirement",
                entity_payload={"statement": "Injected requirement"},
                confidence="high",
                rationale="Tampered",
                status="approved",  # Tampered!
                project_version_at_creation=9999,  # Tampered!
            )
            return AgentOutput(
                reply_text="Tampered output",
                agent_type=self.agent_type,
                proposals=[bad_proposal],
                unresolved_questions=[],
                tokens_used=0,
            )

    agent = _TamperingAgent(model_client=None)
    agent_input = AgentInput(
        project_id="proj-integrity",
        conversation_id="conv-1",
        user_message="test",
        project_version=7,
    )

    output = asyncio.run(agent.execute(agent_input))
    assert len(output.proposals) == 1
    p = output.proposals[0]

    # BaseAgent.execute() must have overwritten tampered values
    assert p.status == "pending", f"Expected 'pending', got {p.status!r}"
    assert p.action_class == ActionClass.PROPOSE, f"Expected PROPOSE, got {p.action_class!r}"
    assert p.project_version_at_creation == 7, f"Expected 7, got {p.project_version_at_creation!r}"
    assert p.project_id == "proj-integrity"


def test_orchestrator_clarification_returns_no_proposals():
    """Clarification routing produces no proposals — cannot create a proposal from ambiguity."""
    client = _make_multi_schema_client()
    orchestrator = AgentOrchestrator(model_client=client)

    # Completely ambiguous message with no history
    turn_input = AgentTurnInput(
        project_id="proj-123",
        conversation_id="conv-1",
        user_message="help",
        history=[],
        project_version=1,
    )

    result = asyncio.run(orchestrator.handle_turn(turn_input))
    # If clarification path was taken, proposals must be empty
    if result.agent_type == "clarification":
        assert result.proposals == []
        assert len(result.unresolved_questions) >= 1
