"""Unit tests for AgentRouter intent classification and heuristic dispatch.

Follows Implementation Plan §16 and ADR-012.
"""

import asyncio
import pytest
from backend.agents.router import AgentRouter


def test_router_heuristic_classification():
    """Test fast heuristic classification for each domain."""
    router = AgentRouter()

    # Requirements
    assert router.classify_intent_heuristically("We need a requirement for data encryption", []) == "requirements"
    assert router.classify_intent_heuristically("Define functional acceptance criteria for login", []) == "requirements"

    # Architecture
    assert router.classify_intent_heuristically("What architecture components and microservices are needed?", []) == "architecture"
    assert router.classify_intent_heuristically("Design the API gateway component", []) == "architecture"

    # Planning
    assert router.classify_intent_heuristically("Create an implementation plan and task breakdown", []) == "planning"
    assert router.classify_intent_heuristically("Break this into tasks", []) == "planning"

    # Testing
    assert router.classify_intent_heuristically("Generate integration test cases and QA scenarios", []) == "testing"
    assert router.classify_intent_heuristically("Write unit test for password validation", []) == "testing"

    # Risk
    assert router.classify_intent_heuristically("What are the security risks and failure modes?", []) == "risk"
    assert router.classify_intent_heuristically("Analyze potential vulnerability threats", []) == "risk"


def test_router_contextual_follow_up():
    """Test follow-up turn routing based on conversation history context."""
    router = AgentRouter()

    history = [
        {"role": "user", "content": "Analyze system requirements"},
        {"role": "assistant", "content": "I have formulated requirement proposals for authentication."},
    ]

    # Vague follow up should inherit requirements context
    assert router.classify_intent_heuristically("What about refresh tokens?", history) == "requirements"
