"""Concrete AgentOrchestrator implementation for NEXUS backend.

Follows Implementation Plan §16, §8.3 (C-012) and satisfies AgentOrchestratorPort.
Dispatches turns to specialist agents, isolates errors, and packages AgentTurnResult.
"""

import logging
from typing import Dict, Optional

from backend.domain.ports.orchestrator_port import (
    AgentOrchestratorPort,
    AgentTurnInput,
    AgentTurnResult,
)
from backend.agents.base import AgentInput, BaseAgent
from backend.agents.gemini_client import GeminiClient
from backend.agents.model_client import ModelClient
from backend.agents.router import AgentRouter
from backend.agents.specialists import (
    ArchitectureAgent,
    PlanningAgent,
    RequirementsAgent,
    RiskAgent,
    TestingAgent,
)

logger = logging.getLogger(__name__)


class AgentOrchestrator(AgentOrchestratorPort):
    """Concrete orchestrator managing agent routing, execution, and proposal construction."""

    def __init__(
        self,
        model_client: Optional[ModelClient] = None,
        router: Optional[AgentRouter] = None,
    ):
        self.model_client = model_client or GeminiClient()
        self.router = router or AgentRouter(model_client=self.model_client)

        # Initialize specialist agents
        self.specialists: Dict[str, BaseAgent] = {
            "requirements": RequirementsAgent(self.model_client),
            "architecture": ArchitectureAgent(self.model_client),
            "planning": PlanningAgent(self.model_client),
            "testing": TestingAgent(self.model_client),
            "risk": RiskAgent(self.model_client),
        }

    async def handle_turn(self, turn_input: AgentTurnInput) -> AgentTurnResult:
        """Execute conversational turn across intent routing and specialist agents."""
        # 1. Determine agent routing
        agent_type = await self.router.route(
            user_message=turn_input.user_message,
            history=turn_input.history,
        )

        # 2. Check for clarification routing
        if agent_type == "clarification":
            return AgentTurnResult(
                reply_text=f"I need more information to assist with your request. Please specify whether you would like to define requirements, design system architecture, generate implementation tasks, create test cases, or evaluate risks.",
                agent_type="clarification",
                proposals=[],
                unresolved_questions=["Could you clarify the engineering scope or artifact type you would like to produce?"],
                tokens_used=0,
            )

        # 3. Select matching specialist agent (default to requirements)
        agent = self.specialists.get(agent_type, self.specialists["requirements"])

        # 4. Formulate AgentInput
        agent_input = AgentInput(
            project_id=turn_input.project_id,
            conversation_id=turn_input.conversation_id,
            user_message=turn_input.user_message,
            history=turn_input.history,
            project_version=turn_input.project_version,
            context={},
        )

        # 4. Execute specialist agent template method
        output = await agent.execute(agent_input)

        # 5. Return typed AgentTurnResult across the Account 1 boundary
        return AgentTurnResult(
            reply_text=output.reply_text,
            agent_type=output.agent_type,
            proposals=output.proposals,
            unresolved_questions=output.unresolved_questions,
            tokens_used=output.tokens_used,
        )


def create_agent_orchestrator(model_client: Optional[ModelClient] = None) -> AgentOrchestrator:
    """Factory function for creating an AgentOrchestrator instance."""
    return AgentOrchestrator(model_client=model_client)
