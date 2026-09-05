"""Risk specialist agent for NEXUS.

Follows Implementation Plan §14.4 (C-011) and Data Model §2.7.
Identifies project risks and evaluates severity with deterministic server-side score computation.
"""

from typing import ClassVar, List
import uuid

from backend.domain.models import ActionClass, Proposal, compute_risk_score
from backend.agents.base import AgentInput, AgentOutput, BaseAgent
from backend.agents.model_client import ModelMessage
from backend.agents.prompts import RISK_AGENT_PROMPT
from backend.agents.schemas import RiskAgentOutput


class RiskAgent(BaseAgent):
    agent_type: ClassVar[str] = "risk"
    system_prompt: ClassVar[str] = RISK_AGENT_PROMPT

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
            response_schema=RiskAgentOutput,
            system_instruction=self.system_prompt,
        )

        parsed_output: RiskAgentOutput
        if response.parsed and isinstance(response.parsed, RiskAgentOutput):
            parsed_output = response.parsed
        else:
            parsed_output = RiskAgentOutput(
                reply_text=response.text or "I have performed the risk analysis.",
                risks=[],
                unresolved_questions=[],
            )

        proposals: List[Proposal] = []
        unresolved_questions = list(parsed_output.unresolved_questions)

        for candidate in parsed_output.risks:
            # Deterministic server-side score computation (Data Model §2.7)
            computed_score = compute_risk_score(candidate.likelihood, candidate.impact)

            risk_id = f"risk-{uuid.uuid4().hex[:8]}"
            risk_payload = {
                "risk_id": risk_id,
                "project_id": input.project_id,
                "category": candidate.category,
                "description": candidate.description,
                "likelihood": candidate.likelihood,
                "impact": candidate.impact,
                "score": computed_score,
                "mitigation_refs": candidate.mitigation_refs,
                "status": "open",
            }

            prop_id = f"prop-{uuid.uuid4().hex[:8]}"
            proposals.append(
                Proposal(
                    proposal_id=prop_id,
                    project_id=input.project_id,
                    run_id="",
                    action_class=ActionClass.PROPOSE,
                    entity_type="risk",
                    entity_payload=risk_payload,
                    affected_entity_ids=candidate.mitigation_refs,
                    confidence="high",
                    rationale=f"Identified {candidate.category} risk (score={computed_score}): {candidate.description[:50]}",
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
