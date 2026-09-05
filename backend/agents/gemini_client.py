"""Gemini client adapter for NEXUS AI layer.

Follows Implementation Plan §15 and ADR-012.
Encapsulates Google GenAI SDK interaction, structured JSON parsing, token accounting,
and error sanitization.
"""

import json
import logging
from typing import Any, Callable, List, Optional, Type
from pydantic import BaseModel, ValidationError

from backend.config import settings
from backend.agents.exceptions import AIUnavailableException, ModelValidationError
from backend.agents.model_client import ModelClient, ModelMessage, ModelResponse

logger = logging.getLogger(__name__)


class GeminiClient(ModelClient):
    """Production Gemini client adapter implementing ModelClient interface."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        mock_generator: Optional[Callable[[List[ModelMessage], Optional[Type[BaseModel]]], ModelResponse]] = None,
        allow_offline_fallback: bool = False,
    ):
        self.api_key = api_key
        self.model_name = model_name or getattr(settings, "gemini_model", "gemini-2.0-flash")
        self._mock_generator = mock_generator
        self.allow_offline_fallback = allow_offline_fallback

    async def generate(
        self,
        messages: List[ModelMessage],
        response_schema: Optional[Type[BaseModel]] = None,
        system_instruction: Optional[str] = None,
        temperature: float = 0.2,
    ) -> ModelResponse:
        """Generate response via Gemini SDK with schema enforcement and error handling."""
        # 1. Use mock generator if injected for tests
        if self._mock_generator is not None:
            return self._mock_generator(messages, response_schema)

        # 2. Attempt real Gemini SDK invocation
        try:
            # Try importing google.genai
            try:
                import google.genai as genai
                from google.genai import types
                client = genai.Client(api_key=self.api_key) if self.api_key else genai.Client()
                
                contents = []
                for msg in messages:
                    contents.append(f"{msg.role.upper()}: {msg.content}")
                full_prompt = "\n\n".join(contents)

                config = types.GenerateContentConfig(
                    temperature=temperature,
                    system_instruction=system_instruction,
                )
                if response_schema is not None:
                    config.response_mime_type = "application/json"
                    config.response_schema = response_schema

                response = client.models.generate_content(
                    model=self.model_name,
                    contents=full_prompt,
                    config=config,
                )

                text = response.text or ""
                tokens_used = 0
                if hasattr(response, "usage_metadata") and response.usage_metadata:
                    tokens_used = getattr(response.usage_metadata, "total_token_count", 0) or 0

                parsed = None
                if response_schema is not None:
                    if not text.strip():
                        raise ModelValidationError("Gemini returned empty response for structured schema request.")
                    try:
                        parsed = response_schema.model_validate_json(text)
                    except (ValidationError, json.JSONDecodeError) as e:
                        raise ModelValidationError(f"Gemini output failed schema validation: {e}")

                return ModelResponse(
                    text=text,
                    parsed=parsed,
                    tokens_used=tokens_used,
                    raw_response=response,
                )

            except ImportError:
                # If SDK is not installed in environment:
                if self.allow_offline_fallback:
                    return self._generate_offline_fallback(messages, response_schema)
                raise AIUnavailableException("Gemini SDK (google.genai) is not installed and offline fallback is disabled in production.")

        except ModelValidationError:
            raise
        except AIUnavailableException:
            raise
        except Exception as exc:
            logger.error("Gemini invocation failed: %s", exc)
            if self.allow_offline_fallback:
                return self._generate_offline_fallback(messages, response_schema)
            raise AIUnavailableException(f"AI service call failed: {exc}")

    def _generate_offline_fallback(
        self,
        messages: List[ModelMessage],
        response_schema: Optional[Type[BaseModel]],
    ) -> ModelResponse:
        """Deterministic offline mock generator for local testing when GenAI SDK is absent."""
        user_msg = next((m.content for m in reversed(messages) if m.role == "user"), "feature")
        
        if response_schema is None:
            return ModelResponse(
                text=f"Processed request for: {user_msg}",
                parsed=None,
                tokens_used=100,
            )

        schema_name = response_schema.__name__
        parsed_obj = None

        if schema_name == "RequirementsAgentOutput":
            from backend.agents.schemas import RequirementCandidate, RequirementsAgentOutput
            parsed_obj = RequirementsAgentOutput(
                reply_text=f"I have analyzed your specification: '{user_msg}' and formulated the requirement proposal.",
                requirements=[
                    RequirementCandidate(
                        statement=f"System shall support: {user_msg}",
                        type="functional",
                        priority="must",
                        acceptance_criteria=[f"Validate system behavior for {user_msg}"],
                        rationale=f"Requested feature: {user_msg}",
                    )
                ],
                unresolved_questions=[],
            )
        elif schema_name == "ArchitectureAgentOutput":
            from backend.agents.schemas import ComponentCandidate, ArchitectureAgentOutput
            comp_name = "".join(w.capitalize() for w in user_msg.split()[:2] if w.isalnum()) or "Core"
            parsed_obj = ArchitectureAgentOutput(
                reply_text=f"Architectural design proposed for: '{user_msg}'.",
                components=[
                    ComponentCandidate(
                        name=f"{comp_name}Service",
                        type="service",
                        responsibilities=[f"Manage execution and logic for {user_msg}"],
                        interfaces=["HTTP REST API", "Internal Event Bus"],
                        technology="Python / FastAPI",
                        requirement_refs=[],
                    )
                ],
                unresolved_questions=[],
            )
        elif schema_name == "PlanningAgentOutput":
            from backend.agents.schemas import TaskCandidate, PlanningAgentOutput
            parsed_obj = PlanningAgentOutput(
                reply_text=f"Implementation plan breakdown for: '{user_msg}'.",
                tasks=[
                    TaskCandidate(
                        title=f"Implement {user_msg}",
                        description=f"Core implementation task for {user_msg}",
                        priority="must",
                        depends_on=[],
                        requirement_refs=[],
                        component_refs=[],
                    )
                ],
                unresolved_questions=[],
            )
        elif schema_name == "TestingAgentOutput":
            from backend.agents.schemas import TestCaseCandidate, TestingAgentOutput
            parsed_obj = TestingAgentOutput(
                reply_text=f"Test cases generated for: '{user_msg}'.",
                test_cases=[
                    TestCaseCandidate(
                        type="unit",
                        title=f"Verify {user_msg}",
                        procedure=["1. Initialize fixture", "2. Execute operation", "3. Assert expected state"],
                        expected_result=f"Operation for {user_msg} succeeds without errors",
                        requirement_refs=[],
                    )
                ],
                unresolved_questions=[],
            )
        elif schema_name == "RiskAgentOutput":
            from backend.agents.schemas import RiskCandidate, RiskAgentOutput
            parsed_obj = RiskAgentOutput(
                reply_text=f"Risk assessment conducted for: '{user_msg}'.",
                risks=[
                    RiskCandidate(
                        category="technical",
                        description=f"Potential latency or failure risk associated with: {user_msg}",
                        likelihood="medium",
                        impact="high",
                        mitigation_refs=[],
                    )
                ],
                unresolved_questions=[],
            )
        elif schema_name == "RouteDecision":
            from backend.agents.router import RouteDecision
            parsed_obj = RouteDecision(
                agent_type="requirements",
                confidence=0.95,
                reasoning="Default classification for domain engineering prompt",
            )
        elif schema_name == "ClarificationOutput":
            from backend.agents.schemas import ClarificationOutput
            parsed_obj = ClarificationOutput(
                reply_text=f"Could you clarify the details regarding '{user_msg}'?",
                unresolved_questions=[f"What are the specific constraints for {user_msg}?"],
            )
        else:
            raise AIUnavailableException(f"Unsupported schema in offline mode: {schema_name}")

        return ModelResponse(
            text=getattr(parsed_obj, "reply_text", str(parsed_obj)),
            parsed=parsed_obj,
            tokens_used=120,
        )
