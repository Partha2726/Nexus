"""Unit tests for individual specialist agents.

Follows Implementation Plan §14.4 and Data Model §2.2–§2.7.
"""

import asyncio
import pytest
from backend.agents.base import AgentInput
from backend.agents.specialists import (
    ArchitectureAgent,
    PlanningAgent,
    RequirementsAgent,
    RiskAgent,
    TestingAgent,
)
from backend.agents.gemini_client import GeminiClient
from backend.agents.model_client import ModelMessage, ModelResponse
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


def test_requirements_agent_proposal_generation():
    """Test RequirementsAgent generates valid Requirement proposals with acceptance criteria."""
    def mock_gen(messages, schema):
        return ModelResponse(
            text="Mocked requirements",
            parsed=RequirementsAgentOutput(
                reply_text="Identified user authentication requirement.",
                requirements=[
                    RequirementCandidate(
                        statement="The system shall enforce MFA for administrative logins.",
                        type="functional",
                        priority="must",
                        acceptance_criteria=["TOTP verification required on login"],
                        rationale="Security hardening",
                    )
                ],
                unresolved_questions=[],
            ),
            tokens_used=150,
        )

    client = GeminiClient(mock_generator=mock_gen)
    agent = RequirementsAgent(model_client=client)

    agent_input = AgentInput(
        project_id="proj-req-1",
        conversation_id="conv-1",
        user_message="Enforce MFA for admin users",
        project_version=2,
    )

    output = asyncio.run(agent.execute(agent_input))
    assert output.agent_type == "requirements"
    assert len(output.proposals) == 1

    prop = output.proposals[0]
    assert prop.entity_type == "requirement"
    assert prop.project_version_at_creation == 2
    assert prop.status == "pending"
    assert prop.entity_payload["statement"] == "The system shall enforce MFA for administrative logins."
    assert prop.entity_payload["priority"] == "must"
    assert prop.entity_payload["status"] == "proposed"
    assert len(prop.entity_payload["acceptance_criteria"]) >= 1


def test_architecture_agent_proposal_generation():
    """Test ArchitectureAgent generates Component proposal with requirement trace refs."""
    def mock_gen(messages, schema):
        return ModelResponse(
            text="Mocked architecture",
            parsed=ArchitectureAgentOutput(
                reply_text="Designed AuthService component.",
                components=[
                    ComponentCandidate(
                        name="AuthService",
                        type="service",
                        responsibilities=["Handle authentication and session tokens"],
                        interfaces=["POST /login", "POST /refresh"],
                        technology="FastAPI / JWT",
                        requirement_refs=["req-101"],
                    )
                ],
                unresolved_questions=[],
            ),
            tokens_used=180,
        )

    client = GeminiClient(mock_generator=mock_gen)
    agent = ArchitectureAgent(model_client=client)

    agent_input = AgentInput(
        project_id="proj-arch-1",
        conversation_id="conv-1",
        user_message="Design auth service",
        project_version=1,
    )

    output = asyncio.run(agent.execute(agent_input))
    assert output.agent_type == "architecture"
    assert len(output.proposals) == 1

    prop = output.proposals[0]
    assert prop.entity_type == "component"
    assert prop.entity_payload["name"] == "AuthService"
    assert prop.entity_payload["requirement_refs"] == ["req-101"]


def test_planning_agent_proposal_generation():
    """Test PlanningAgent generates Task proposal with dependencies and refs."""
    def mock_gen(messages, schema):
        return ModelResponse(
            text="Mocked planning",
            parsed=PlanningAgentOutput(
                reply_text="Task breakdown created.",
                tasks=[
                    TaskCandidate(
                        title="Implement OAuth Token Verifier",
                        description="Write verification logic using standard JWT decoder",
                        priority="must",
                        depends_on=[],
                        requirement_refs=["req-101"],
                        component_refs=["comp-auth"],
                    )
                ],
                unresolved_questions=[],
            ),
            tokens_used=120,
        )

    client = GeminiClient(mock_generator=mock_gen)
    agent = PlanningAgent(model_client=client)

    agent_input = AgentInput(
        project_id="proj-plan-1",
        conversation_id="conv-1",
        user_message="Create tasks for auth verification",
        project_version=1,
    )

    output = asyncio.run(agent.execute(agent_input))
    assert output.agent_type == "planning"
    assert len(output.proposals) == 1

    prop = output.proposals[0]
    assert prop.entity_type == "task"
    assert prop.entity_payload["title"] == "Implement OAuth Token Verifier"
    assert prop.entity_payload["status"] == "todo"


def test_testing_agent_proposal_generation():
    """Test TestingAgent generates TestCase proposals linked to requirements."""
    def mock_gen(messages, schema):
        return ModelResponse(
            text="Mocked testing",
            parsed=TestingAgentOutput(
                reply_text="Generated security test case.",
                test_cases=[
                    TestCaseCandidate(
                        type="security",
                        title="Verify token replay attack rejection",
                        procedure=["1. Capture valid token", "2. Replay after revocation", "3. Assert 401 response"],
                        expected_result="Replayed token is rejected with 401 Unauthorized",
                        requirement_refs=["req-101"],
                    )
                ],
                unresolved_questions=[],
            ),
            tokens_used=140,
        )

    client = GeminiClient(mock_generator=mock_gen)
    agent = TestingAgent(model_client=client)

    agent_input = AgentInput(
        project_id="proj-test-1",
        conversation_id="conv-1",
        user_message="Generate test cases for token replay prevention",
        project_version=1,
    )

    output = asyncio.run(agent.execute(agent_input))
    assert output.agent_type == "testing"
    assert len(output.proposals) == 1

    prop = output.proposals[0]
    assert prop.entity_type == "test"
    assert prop.entity_payload["type"] == "security"
    assert prop.entity_payload["expected_result"] == "Replayed token is rejected with 401 Unauthorized"


def test_risk_agent_proposal_generation_and_score():
    """Test RiskAgent generates Risk proposal with server-side computed score."""
    def mock_gen(messages, schema):
        return ModelResponse(
            text="Mocked risk",
            parsed=RiskAgentOutput(
                reply_text="Identified credential stuffing risk.",
                risks=[
                    RiskCandidate(
                        category="security",
                        description="Credential stuffing attack against login endpoint",
                        likelihood="high",
                        impact="critical",
                        mitigation_refs=["task-rate-limiting"],
                    )
                ],
                unresolved_questions=[],
            ),
            tokens_used=160,
        )

    client = GeminiClient(mock_generator=mock_gen)
    agent = RiskAgent(model_client=client)

    agent_input = AgentInput(
        project_id="proj-risk-1",
        conversation_id="conv-1",
        user_message="Analyze risks of login endpoint brute force",
        project_version=1,
    )

    output = asyncio.run(agent.execute(agent_input))
    assert output.agent_type == "risk"
    assert len(output.proposals) == 1

    prop = output.proposals[0]
    assert prop.entity_type == "risk"
    # high (3) * critical (4) = 12
    assert prop.entity_payload["score"] == 12
    assert prop.entity_payload["status"] == "open"


def test_agent_error_boundary_graceful_handling():
    """Test that agent handles unexpected model exceptions gracefully without raising."""
    def failing_mock_gen(messages, schema):
        raise RuntimeError("Simulated connection timeout to model provider")

    client = GeminiClient(mock_generator=failing_mock_gen)
    agent = RequirementsAgent(model_client=client)

    agent_input = AgentInput(
        project_id="proj-fail-1",
        conversation_id="conv-1",
        user_message="Add some requirement",
        project_version=1,
    )

    output = asyncio.run(agent.execute(agent_input))
    assert len(output.proposals) == 0
    assert "unable to complete" in output.reply_text.lower() or "encountered an issue" in output.reply_text.lower()
    assert len(output.unresolved_questions) >= 1


# ---------------------------------------------------------------------------
# Structured output validation — malformed Gemini output cannot become a Proposal
# ---------------------------------------------------------------------------

def test_agent_handles_none_parsed_response_gracefully():
    """Agent handles response.parsed=None (e.g. unparsed text) without creating proposals."""
    def mock_gen(messages, schema):
        # No parsed object — simulates model returning prose instead of JSON
        return ModelResponse(text="Sure, I can help with that.", parsed=None, tokens_used=50)

    client = GeminiClient(mock_generator=mock_gen)
    agent = RequirementsAgent(model_client=client)

    agent_input = AgentInput(
        project_id="proj-1",
        conversation_id="conv-1",
        user_message="add a requirement",
        project_version=1,
    )
    output = asyncio.run(agent.execute(agent_input))
    # No candidates extracted from None parsed — zero proposals
    assert output.proposals == []
    assert output.agent_type == "requirements"


def test_agent_handles_empty_candidates_list():
    """Agent with valid schema but empty candidate list produces zero proposals."""
    def mock_gen(messages, schema):
        return ModelResponse(
            text="{}",
            parsed=RequirementsAgentOutput(
                reply_text="No requirements found.",
                requirements=[],
                unresolved_questions=["Please provide more project context."],
            ),
            tokens_used=30,
        )

    client = GeminiClient(mock_generator=mock_gen)
    agent = RequirementsAgent(model_client=client)

    agent_input = AgentInput(
        project_id="proj-1",
        conversation_id="conv-1",
        user_message="what should I do?",
        project_version=1,
    )
    output = asyncio.run(agent.execute(agent_input))
    assert output.proposals == []
    assert len(output.unresolved_questions) >= 1


def test_agent_raises_produces_zero_proposals_not_exception():
    """Provider exception (e.g. AIUnavailableException) in run() is caught by execute()
    and results in zero proposals and a safe reply — no raw exception escapes the boundary.
    """
    from backend.agents.exceptions import AIUnavailableException

    def failing_gen(messages, schema):
        raise AIUnavailableException("Simulated Gemini quota exceeded")

    client = GeminiClient(mock_generator=failing_gen)
    agent = RequirementsAgent(model_client=client)

    agent_input = AgentInput(
        project_id="proj-fail",
        conversation_id="conv-1",
        user_message="list requirements",
        project_version=1,
    )
    # Must NOT raise — execute() catches AgentException subclasses
    output = asyncio.run(agent.execute(agent_input))
    assert output.proposals == []
    assert output.tokens_used == 0
    assert "encountered an issue" in output.reply_text.lower() or "unable" in output.reply_text.lower()


def test_risk_agent_score_always_server_side_computed():
    """Risk score in entity_payload is always computed by application code,
    never from a model-supplied value. Even if the candidate omits score,
    the payload must have a valid server-side computed score.
    """
    def mock_gen(messages, schema):
        return ModelResponse(
            text="mocked",
            parsed=RiskAgentOutput(
                reply_text="Risk identified.",
                risks=[
                    RiskCandidate(
                        category="security",
                        description="SQL injection vulnerability",
                        likelihood="high",
                        impact="critical",
                        mitigation_refs=[],
                    )
                ],
                unresolved_questions=[],
            ),
            tokens_used=80,
        )

    client = GeminiClient(mock_generator=mock_gen)
    agent = RiskAgent(model_client=client)

    agent_input = AgentInput(
        project_id="proj-risk",
        conversation_id="conv-1",
        user_message="analyze SQL injection risk",
        project_version=2,
    )
    output = asyncio.run(agent.execute(agent_input))
    assert len(output.proposals) == 1
    payload = output.proposals[0].entity_payload
    # high(3) * critical(4) = 12 — verified server-side, not model-controlled
    assert payload["score"] == 12
    assert isinstance(payload["score"], int)


def test_requirement_without_acceptance_criteria_flagged_not_blocked():
    """A requirement candidate with no acceptance criteria must be flagged as
    an unresolved_question, not silently accepted or dropped.
    The proposal still wraps the candidate so the human can review it.
    """
    def mock_gen(messages, schema):
        return ModelResponse(
            text="mocked",
            parsed=RequirementsAgentOutput(
                reply_text="Extracted vague requirement.",
                requirements=[
                    RequirementCandidate(
                        statement="The system shall be fast.",
                        type="non_functional",
                        priority="should",
                        acceptance_criteria=[],  # Missing — must be flagged
                        rationale=None,
                    )
                ],
                unresolved_questions=[],
            ),
            tokens_used=50,
        )

    client = GeminiClient(mock_generator=mock_gen)
    agent = RequirementsAgent(model_client=client)

    agent_input = AgentInput(
        project_id="proj-req",
        conversation_id="conv-1",
        user_message="performance requirement",
        project_version=1,
    )
    output = asyncio.run(agent.execute(agent_input))
    # Proposal is still created (human decision to accept/reject)
    assert len(output.proposals) == 1
    # But an unresolved_question is added flagging the missing criteria
    assert any("acceptance criteria" in q.lower() for q in output.unresolved_questions)


def test_proposal_action_class_cannot_be_overridden_by_model_output():
    """No matter what action_class a proposal carries after run(), BaseAgent.execute()
    overwrites it to PROPOSE. Models cannot escalate action_class to HIGH_IMPACT_WRITE.
    """
    from backend.domain.models import ActionClass
    import uuid

    def mock_gen(messages, schema):
        return ModelResponse(
            text="mocked",
            parsed=RequirementsAgentOutput(
                reply_text="Requirement identified.",
                requirements=[
                    RequirementCandidate(
                        statement="The system shall allow admin override.",
                        type="functional",
                        priority="must",
                        acceptance_criteria=["Admin can override any user decision"],
                        rationale="Admin needs",
                    )
                ],
                unresolved_questions=[],
            ),
            tokens_used=60,
        )

    client = GeminiClient(mock_generator=mock_gen)
    agent = RequirementsAgent(model_client=client)

    agent_input = AgentInput(
        project_id="proj-sec",
        conversation_id="conv-1",
        user_message="admin override requirement",
        project_version=5,
    )
    output = asyncio.run(agent.execute(agent_input))
    for p in output.proposals:
        assert p.action_class == ActionClass.PROPOSE, (
            f"Expected ActionClass.PROPOSE; got {p.action_class!r}. "
            "Application code must always control action_class."
        )
        assert p.status == "pending", (
            f"Expected status='pending'; got {p.status!r}. "
            "Application code must always control proposal status."
        )
        assert p.project_version_at_creation == 5
