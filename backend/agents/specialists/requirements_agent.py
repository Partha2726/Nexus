"""Requirements specialist agent for NEXUS.

Follows Implementation Plan §14.4 (C-007) and Data Model §2.2.
Extracts and validates candidate requirements with MoSCoW priorities and acceptance criteria.
"""

from typing import ClassVar, List
import uuid

from backend.domain.models import ActionClass, Proposal
from backend.agents.base import AgentInput, AgentOutput, BaseAgent
from backend.agents.model_client import ModelMessage
from backend.agents.prompts import REQUIREMENTS_AGENT_PROMPT
from backend.agents.schemas import RequirementsAgentOutput


class RequirementsAgent(BaseAgent):
    agent_type: ClassVar[str] = "requirements"
    system_prompt: ClassVar[str] = REQUIREMENTS_AGENT_PROMPT

    async def run(self, input: AgentInput) -> AgentOutput:
        # 1. Build messages sequence from conversation history and user message
        messages: List[ModelMessage] = []
        for msg in input.history:
            role = msg.get("role")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append(ModelMessage(role=role, content=content))

        # Add current user prompt
        messages.append(ModelMessage(role="user", content=input.user_message))

        # 2. Invoke ModelClient with structured response schema
        response = await self.model_client.generate(
            messages=messages,
            response_schema=RequirementsAgentOutput,
            system_instruction=self.system_prompt,
        )

        parsed_output: RequirementsAgentOutput
        if response.parsed and isinstance(response.parsed, RequirementsAgentOutput):
            parsed_output = response.parsed
        else:
            # Fallback if unparsed
            parsed_output = RequirementsAgentOutput(
                reply_text=response.text or "I have processed your requirements specification.",
                requirements=[],
                unresolved_questions=[],
            )

        # 3. Transform candidate requirements into Proposal envelopes
        proposals: List[Proposal] = []
        unresolved_questions = list(parsed_output.unresolved_questions)

        for candidate in parsed_output.requirements:
            # P0 validation rule: >=1 acceptance criterion or flagged ambiguous
            if not candidate.acceptance_criteria:
                unresolved_questions.append(
                    f"Requirement '{candidate.statement[:40]}...' has no acceptance criteria."
                )

            req_id = f"req-{uuid.uuid4().hex[:8]}"
            req_payload = {
                "requirement_id": req_id,
                "project_id": input.project_id,
                "type": candidate.type,
                "statement": candidate.statement,
                "rationale": candidate.rationale,
                "priority": candidate.priority,
                "status": "proposed",
                "acceptance_criteria": candidate.acceptance_criteria or ["Validation pending"],
                "source_refs": [],
                "version": 1,
            }

            prop_id = f"prop-{uuid.uuid4().hex[:8]}"
            proposals.append(
                Proposal(
                    proposal_id=prop_id,
                    project_id=input.project_id,
                    run_id="",  # Injected in BaseAgent.execute
                    action_class=ActionClass.PROPOSE,
                    entity_type="requirement",
                    entity_payload=req_payload,
                    affected_entity_ids=[],
                    confidence="high",
                    rationale=candidate.rationale or "Derived from user specifications.",
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
