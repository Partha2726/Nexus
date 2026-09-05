"""Testing specialist agent for NEXUS.

Follows Implementation Plan §14.4 (C-010) and Data Model §2.6.
Generates rigorous test case specifications linked to requirements.
"""

from typing import ClassVar, List
import uuid

from backend.domain.models import ActionClass, Proposal
from backend.agents.base import AgentInput, AgentOutput, BaseAgent
from backend.agents.model_client import ModelMessage
from backend.agents.prompts import TESTING_AGENT_PROMPT
from backend.agents.schemas import TestingAgentOutput


class TestingAgent(BaseAgent):
    __test__ = False
    agent_type: ClassVar[str] = "testing"
    system_prompt: ClassVar[str] = TESTING_AGENT_PROMPT

    async def run(self, input: AgentInput) -> AgentOutput:
        messages: List[ModelMessage] = []
        for msg in input.history:
            role = msg.get("role")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append(ModelMessage(role=role, content=content))

        messages.append(ModelMessage(role="user", content=input.user_message))

        response = await self.model_client.generate(
            messages=messages,
            response_schema=TestingAgentOutput,
            system_instruction=self.system_prompt,
        )

        parsed_output: TestingAgentOutput
        if response.parsed and isinstance(response.parsed, TestingAgentOutput):
            parsed_output = response.parsed
        else:
            parsed_output = TestingAgentOutput(
                reply_text=response.text or "I have drafted the test specifications.",
                test_cases=[],
                unresolved_questions=[],
            )

        proposals: List[Proposal] = []
        unresolved_questions = list(parsed_output.unresolved_questions)

        for candidate in parsed_output.test_cases:
            test_id = f"test-{uuid.uuid4().hex[:8]}"
            test_payload = {
                "test_id": test_id,
                "project_id": input.project_id,
                "type": candidate.type,
                "title": candidate.title,
                "procedure": candidate.procedure,
                "expected_result": candidate.expected_result,
                "requirement_refs": candidate.requirement_refs,
                "status": "proposed",
            }

            prop_id = f"prop-{uuid.uuid4().hex[:8]}"
            proposals.append(
                Proposal(
                    proposal_id=prop_id,
                    project_id=input.project_id,
                    run_id="",
                    action_class=ActionClass.PROPOSE,
                    entity_type="test",
                    entity_payload=test_payload,
                    affected_entity_ids=candidate.requirement_refs,
                    confidence="high",
                    rationale=f"Generated {candidate.type} test case: {candidate.title}",
                    status="pending",
                    project_version_at_creation=input.project_version,
                )
            )

        return AgentOutput(
            reply_text=parsed_output.reply_text,
            agent_type=self.agent_type,
            proposals=proposals,
            unresolved_questions=unresolved_questions,
            tokens_used=response.tokens_used,
        )
