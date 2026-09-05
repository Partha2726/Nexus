"""BaseAgent template class for NEXUS specialist agents.

Follows Implementation Plan §14.1, §14.1.1 and ADR-012.
Provides template execution, proposal wrapping, error isolation, and token accounting.
"""

from abc import ABC, abstractmethod
from typing import ClassVar, List, Optional
import uuid
import logging
from pydantic import BaseModel, Field

from backend.domain.models import ActionClass, Proposal
from backend.agents.exceptions import AgentException
from backend.agents.model_client import ModelClient

logger = logging.getLogger(__name__)


class AgentInput(BaseModel):
    """Input payload passed to any specialist agent."""

    project_id: str
    conversation_id: str
    user_message: str
    history: List[dict] = Field(default_factory=list)
    project_version: int
    context: dict = Field(default_factory=dict)


class AgentOutput(BaseModel):
    """Output payload produced by any specialist agent."""

    reply_text: str
    agent_type: str
    proposals: List[Proposal] = Field(default_factory=list)
    unresolved_questions: List[str] = Field(default_factory=list)
    tokens_used: int = 0


class BaseAgent(ABC):
    """Abstract base class for all NEXUS specialist agents."""

    agent_type: ClassVar[str]
    system_prompt: ClassVar[str]

    def __init__(self, model_client: ModelClient):
        self.model_client = model_client

    @abstractmethod
    async def run(self, input: AgentInput) -> AgentOutput:
        """Execute domain-specific reasoning and candidate generation."""
        ...

    async def execute(self, input: AgentInput) -> AgentOutput:
        """Template execution method wrapping run() with error boundaries and proposal validation."""
        try:
            output = await self.run(input)

            # Ensure all proposals have consistent metadata
            run_id = f"run-{uuid.uuid4().hex[:8]}"
            validated_proposals: List[Proposal] = []

            for p in output.proposals:
                # Enforce server-side metadata constraints
                p.project_id = input.project_id
                p.run_id = run_id
                p.project_version_at_creation = input.project_version
                p.status = "pending"
                p.action_class = ActionClass.PROPOSE
                validated_proposals.append(p)

            output.proposals = validated_proposals
            output.agent_type = self.agent_type
            return output

        except AgentException as exc:
            logger.warning("Agent %s failed gracefully: %s", self.agent_type, exc)
            return AgentOutput(
                reply_text=f"I encountered an issue processing your request: {exc.message}. Please try refining your prompt.",
                agent_type=self.agent_type,
                proposals=[],
                unresolved_questions=[f"System note: {exc.message}"],
                tokens_used=0,
            )
        except Exception as exc:
            logger.error("Unexpected error in agent %s: %s", self.agent_type, exc, exc_info=True)
            return AgentOutput(
                reply_text="I was unable to complete this analysis due to an internal processing error. Please try again with a more specific description.",
                agent_type=self.agent_type,
                proposals=[],
                unresolved_questions=["An unexpected error occurred during processing."],
                tokens_used=0,
            )
