"""Deterministic and model-assisted intent router for NEXUS orchestrator.

Follows Implementation Plan §16 and ADR-012.
Routes multi-turn user requests to specialized engineering agents.
"""

import re
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

from backend.agents.model_client import ModelClient, ModelMessage
from backend.agents.prompts import ROUTER_PROMPT

AgentType = Literal["requirements", "architecture", "planning", "testing", "risk", "clarification"]


class RouteDecision(BaseModel):
    agent_type: AgentType = Field(..., description="Selected specialist agent type")
    confidence: float = Field(default=1.0, description="Confidence score")
    reasoning: str = Field(default="", description="Routing rationale")


class AgentRouter:
    """Classifies user engineering intent and dispatches to the appropriate specialist."""

    def __init__(self, model_client: Optional[ModelClient] = None):
        self.model_client = model_client

    def classify_intent_heuristically(self, user_message: str, history: List[dict]) -> Optional[AgentType]:
        """Fast, deterministic keyword and regex intent classification."""
        text = user_message.lower().strip()

        # 1. Testing intent
        if any(w in text for w in ["test case", "unit test", "integration test", "qa scenario", "generate test", "write test", "testing"]):
            return "testing"

        # 2. Risk intent
        if any(w in text for w in ["risk", "threat", "vulnerability", "failure mode", "hazard", "mitigate", "mitigation"]):
            return "risk"

        # 3. Planning / Tasks intent
        if any(w in text for w in ["task breakdown", "implementation plan", "break this down", "tasks", "work items", "sprint plan", "todo list"]):
            return "planning"

        # 4. Architecture / System Design intent
        if any(w in text for w in ["architecture", "component", "microservice", "system design", "service boundary", "database design", "api gateway"]):
            return "architecture"

        # 5. Requirements intent
        if any(w in text for w in ["requirement", "feature", "user story", "functional", "non-functional", "acceptance criteria", "spec", "system shall", "must support", "need a feature"]):
            return "requirements"

        # 6. Check recent conversation context if follow-up turn
        if history:
            last_assistant_msg = next((m.get("content", "") for m in reversed(history) if m.get("role") == "assistant"), "")
            last_text = last_assistant_msg.lower()
            if "requirement" in last_text or "functional" in last_text:
                return "requirements"
            if "component" in last_text or "architecture" in last_text:
                return "architecture"
            if "task" in last_text or "plan" in last_text:
                return "planning"
            if "test" in last_text:
                return "testing"
            if "risk" in last_text:
                return "risk"

        return None

    async def route(self, user_message: str, history: List[dict]) -> AgentType:
        """Route turn to the appropriate specialist, using heuristics first with LLM fallback."""
        # Fast path: deterministic heuristic matching
        heuristic = self.classify_intent_heuristically(user_message, history)
        if heuristic is not None:
            return heuristic

        # If model_client available, perform model classification
        if self.model_client is not None:
            try:
                messages = [ModelMessage(role="user", content=f"Classify this intent: {user_message}")]
                resp = await self.model_client.generate(
                    messages=messages,
                    response_schema=RouteDecision,
                    system_instruction=ROUTER_PROMPT,
                    temperature=0.0,
                )
                if resp.parsed and isinstance(resp.parsed, RouteDecision):
                    return resp.parsed.agent_type
            except Exception:
                pass

        # Default fallback is requirements agent for general domain prompts
        return "requirements"
