"""Model client abstraction for NEXUS AI layer.

Follows Implementation Plan §15 and ADR-012.
All specialist agents depend ONLY on this protocol, never on concrete Gemini SDKs.
"""

from typing import Any, List, Literal, Optional, Protocol, Type, runtime_checkable
from pydantic import BaseModel, Field


class ModelMessage(BaseModel):
    """Normalized message representation for LLM prompts."""

    role: Literal["system", "user", "assistant"]
    content: str


class ModelResponse(BaseModel):
    """Normalized response returned from any ModelClient provider."""

    text: str
    parsed: Optional[Any] = None
    tokens_used: int = 0
    raw_response: Optional[Any] = None


@runtime_checkable
class ModelClient(Protocol):
    """Abstract interface for invoking generative language models with structured output."""

    async def generate(
        self,
        messages: List[ModelMessage],
        response_schema: Optional[Type[BaseModel]] = None,
        system_instruction: Optional[str] = None,
        temperature: float = 0.2,
    ) -> ModelResponse:
        """Generate response given a sequence of messages and optional Pydantic schema."""
        ...
