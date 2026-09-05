"""NEXUS AI & Agent layer public API.

Exposes the concrete AgentOrchestrator, ModelClient abstraction, GeminiClient adapter,
and specialist agents.
"""

from .exceptions import (
    AgentException,
    AIUnavailableException,
    ModelValidationError,
    RoutingException,
    AgentExecutionError,
)
from .model_client import ModelClient, ModelMessage, ModelResponse
from .gemini_client import GeminiClient
from .base import AgentInput, AgentOutput, BaseAgent
from .router import AgentRouter
from .orchestrator import AgentOrchestrator, create_agent_orchestrator
from .specialists import (
    RequirementsAgent,
    ArchitectureAgent,
    PlanningAgent,
    TestingAgent,
    RiskAgent,
)

__all__ = [
    "AgentException",
    "AIUnavailableException",
    "ModelValidationError",
    "RoutingException",
    "AgentExecutionError",
    "ModelClient",
    "ModelMessage",
    "ModelResponse",
    "GeminiClient",
    "AgentInput",
    "AgentOutput",
    "BaseAgent",
    "AgentRouter",
    "AgentOrchestrator",
    "create_agent_orchestrator",
    "RequirementsAgent",
    "ArchitectureAgent",
    "PlanningAgent",
    "TestingAgent",
    "RiskAgent",
]
