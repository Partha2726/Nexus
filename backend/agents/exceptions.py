"""AI & Agent layer exception definitions for NEXUS backend.

Follows Implementation Plan §14.5 and ADR-012.
All exceptions map to user-safe error categories without leaking secrets or raw LLM traces.
"""

from typing import Optional


class AgentException(Exception):
    """Base exception for all AI/agent layer errors."""

    def __init__(self, message: str, error_code: str = "AI_ERROR"):
        super().__init__(message)
        self.message = message
        self.error_code = error_code


class AIUnavailableException(AgentException):
    """Raised when Gemini provider is unreachable, timed out, or quota exhausted."""

    def __init__(self, message: str = "AI model provider is temporarily unavailable"):
        super().__init__(message, error_code="AI_UNAVAILABLE")


class ModelValidationError(AgentException):
    """Raised when model returns malformed, unparseable, or schema-violating output."""

    def __init__(self, message: str = "Model output failed schema validation"):
        super().__init__(message, error_code="MODEL_VALIDATION_ERROR")


class RoutingException(AgentException):
    """Raised when conversational intent cannot be routed to any known agent."""

    def __init__(self, message: str = "Unable to determine agent routing for message"):
        super().__init__(message, error_code="ROUTING_ERROR")


class AgentExecutionError(AgentException):
    """Raised when an internal agent execution fails unexpectedly."""

    def __init__(self, message: str = "Agent execution failed"):
        super().__init__(message, error_code="AGENT_EXECUTION_ERROR")
