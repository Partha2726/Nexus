"""Architecture specialist agent for NEXUS.

Follows Implementation Plan §14.4 (C-008) and Data Model §2.3.
Decomposes systems into components and establishes requirement trace relationships.
"""

from typing import ClassVar, List
import uuid

from backend.domain.models import ActionClass, Proposal
from backend.agents.base import AgentInput, AgentOutput, BaseAgent
from backend.agents.model_client import ModelMessage
from backend.agents.prompts import ARCHITECTURE_AGENT_PROMPT
from backend.agents.schemas import ArchitectureAgentOutput


class ArchitectureAgent(BaseAgent):
    agent_type: ClassVar[str] = "architecture"
    system_prompt: ClassVar[str] = ARCHITECTURE_AGENT_PROMPT

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
            response_schema=ArchitectureAgentOutput,
            system_instruction=self.system_prompt,
        )

        parsed_output: ArchitectureAgentOutput
        if response.parsed and isinstance(response.parsed, ArchitectureAgentOutput):
            parsed_output = response.parsed
        else:
            parsed_output = ArchitectureAgentOutput(
                reply_text=response.text or "I have processed your architectural design request.",
                components=[],
                unresolved_questions=[],
            )

        proposals: List[Proposal] = []
        unresolved_questions = list(parsed_output.unresolved_questions)

        for candidate in parsed_output.components:
            comp_id = f"comp-{uuid.uuid4().hex[:8]}"
            comp_payload = {
                "component_id": comp_id,
                "project_id": input.project_id,
                "name": candidate.name,
                "type": candidate.type,
                "responsibilities": candidate.responsibilities,
                "interfaces": candidate.interfaces,
                "technology": candidate.technology,
                "status": "proposed",
                "requirement_refs": candidate.requirement_refs,
            }

            prop_id = f"prop-{uuid.uuid4().hex[:8]}"
            proposals.append(
                Proposal(
                    proposal_id=prop_id,
                    project_id=input.project_id,
                    run_id="",
                    action_class=ActionClass.PROPOSE,
                    entity_type="component",
                    entity_payload=comp_payload,
                    affected_entity_ids=candidate.requirement_refs,
                    confidence="high",
                    rationale=f"Proposed {candidate.type} component: {candidate.name}",
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
