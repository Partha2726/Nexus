"""Planning specialist agent for NEXUS.

Follows Implementation Plan §14.4 (C-009) and Data Model §2.5.
Breaks requirements into actionable implementation tasks with dependency references.
"""

from typing import ClassVar, List
import uuid

from backend.domain.models import ActionClass, Proposal
from backend.agents.base import AgentInput, AgentOutput, BaseAgent
from backend.agents.model_client import ModelMessage
from backend.agents.prompts import PLANNING_AGENT_PROMPT
from backend.agents.schemas import PlanningAgentOutput


class PlanningAgent(BaseAgent):
    agent_type: ClassVar[str] = "planning"
    system_prompt: ClassVar[str] = PLANNING_AGENT_PROMPT

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
            response_schema=PlanningAgentOutput,
            system_instruction=self.system_prompt,
        )

        parsed_output: PlanningAgentOutput
        if response.parsed and isinstance(response.parsed, PlanningAgentOutput):
            parsed_output = response.parsed
        else:
            parsed_output = PlanningAgentOutput(
                reply_text=response.text or "I have prepared the task implementation plan.",
                tasks=[],
                unresolved_questions=[],
            )

        proposals: List[Proposal] = []
        unresolved_questions = list(parsed_output.unresolved_questions)

        for candidate in parsed_output.tasks:
            task_id = f"task-{uuid.uuid4().hex[:8]}"
            task_payload = {
                "task_id": task_id,
                "project_id": input.project_id,
                "title": candidate.title,
                "description": candidate.description,
                "status": "todo",
                "priority": candidate.priority,
                "depends_on": candidate.depends_on,
                "requirement_refs": candidate.requirement_refs,
                "component_refs": candidate.component_refs,
                "milestone_id": None,
            }

            prop_id = f"prop-{uuid.uuid4().hex[:8]}"
            proposals.append(
                Proposal(
                    proposal_id=prop_id,
                    project_id=input.project_id,
                    run_id="",
                    action_class=ActionClass.PROPOSE,
                    entity_type="task",
                    entity_payload=task_payload,
                    affected_entity_ids=candidate.requirement_refs + candidate.component_refs,
                    confidence="high",
                    rationale=f"Task breakdown item: {candidate.title}",
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
