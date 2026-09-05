"""Unit tests for GeminiClient adapter.

Follows Implementation Plan §15 and ADR-012.

Production invariants verified here:
- allow_offline_fallback=False (default) raises AIUnavailableException when SDK absent
- allow_offline_fallback=True (test-only) returns deterministic mock output
- Injected mock_generator is always honored before SDK or fallback
"""

import asyncio
import pytest
from backend.agents.gemini_client import GeminiClient
from backend.agents.model_client import ModelMessage, ModelResponse
from backend.agents.schemas import RequirementCandidate, RequirementsAgentOutput
from backend.agents.exceptions import AIUnavailableException, ModelValidationError


def test_gemini_client_mock_generator():
    """GeminiClient with injected mock_generator returns the mock response.
    This is the correct testing pattern for all agent-level tests.
    """
    def mock_gen(messages, schema):
        return ModelResponse(
            text='{"reply_text": "Sample text", "requirements": [], "unresolved_questions": []}',
            parsed=RequirementsAgentOutput(reply_text="Sample text", requirements=[], unresolved_questions=[]),
            tokens_used=75,
        )

    client = GeminiClient(mock_generator=mock_gen)
    messages = [ModelMessage(role="user", content="Test message")]

    resp = asyncio.run(client.generate(messages=messages, response_schema=RequirementsAgentOutput))
    assert resp.text is not None
    assert resp.parsed is not None
    assert resp.parsed.reply_text == "Sample text"
    assert resp.tokens_used == 75


def test_gemini_client_production_mode_raises_when_sdk_absent():
    """Production GeminiClient (allow_offline_fallback=False, default) raises
    AIUnavailableException when google.genai SDK is not installed.

    This is the correct production behavior: no silent fallback.
    """
    client = GeminiClient()  # allow_offline_fallback=False is the default
    messages = [ModelMessage(role="user", content="Define rate limiting requirement")]

    with pytest.raises(AIUnavailableException):
        asyncio.run(client.generate(messages=messages, response_schema=RequirementsAgentOutput))


def test_gemini_client_offline_fallback_requires_explicit_opt_in():
    """Offline fallback only activates when allow_offline_fallback=True is set.
    This must never be set in production — it is test/development infrastructure only.
    """
    client = GeminiClient(allow_offline_fallback=True)
    messages = [ModelMessage(role="user", content="Define rate limiting requirement")]

    resp = asyncio.run(client.generate(messages=messages, response_schema=RequirementsAgentOutput))
    assert resp.parsed is not None
    assert isinstance(resp.parsed, RequirementsAgentOutput)
    assert len(resp.parsed.requirements) >= 1


def test_gemini_client_offline_fallback_blocked_in_production():
    """Confirm the production constructor flag is False by default.
    Any code path that creates GeminiClient() without allow_offline_fallback=True
    must never silently produce mock AI output.
    """
    client = GeminiClient()
    assert client.allow_offline_fallback is False, (
        "Production GeminiClient must not have allow_offline_fallback=True. "
        "This would allow mock AI output to reach production proposals."
    )
