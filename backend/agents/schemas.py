"""Intermediate structured output schemas for NEXUS specialist agents.

Follows Implementation Plan §14.1, §14.4 and Data Model §2.2–§2.7.
These typed models define the structured JSON contracts expected from Gemini.
"""

from typing import List, Literal, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Requirements Agent Schemas
# ---------------------------------------------------------------------------
class RequirementCandidate(BaseModel):
    statement: str = Field(..., description="Clear, testable requirement statement")
    type: Literal["functional", "non_functional"] = Field(
        default="functional", description="Requirement category"
    )
    priority: Literal["must", "should", "may"] = Field(
        default="must", description="MoSCoW priority"
    )
    acceptance_criteria: List[str] = Field(
        default_factory=list,
        description="List of verifiable acceptance criteria (at least 1 required)",
    )
    rationale: Optional[str] = Field(None, description="Why this requirement is needed")


class RequirementsAgentOutput(BaseModel):
    reply_text: str = Field(..., description="Markdown response explaining the requirements analysis")
    requirements: List[RequirementCandidate] = Field(
        default_factory=list, description="List of proposed candidate requirements"
    )
    unresolved_questions: List[str] = Field(
        default_factory=list,
        description="Ambiguities or open questions requiring human user clarification",
    )


# ---------------------------------------------------------------------------
# Architecture Agent Schemas
# ---------------------------------------------------------------------------
class ComponentCandidate(BaseModel):
    name: str = Field(..., description="Component name (e.g. AuthService, PaymentGateway)")
    type: str = Field(..., description="Category (service, database, queue, api, library, etc.)")
    responsibilities: List[str] = Field(default_factory=list, description="Core responsibilities")
    interfaces: List[str] = Field(default_factory=list, description="Exposed interfaces or APIs")
    technology: Optional[str] = Field(None, description="Suggested tech stack or runtime")
    requirement_refs: List[str] = Field(
        default_factory=list,
        description="IDs of requirements this component implements (for TraceLink creation)",
    )


class ArchitectureAgentOutput(BaseModel):
    reply_text: str = Field(..., description="Markdown response explaining architectural choices")
    components: List[ComponentCandidate] = Field(
        default_factory=list, description="Proposed architecture components"
    )
    unresolved_questions: List[str] = Field(
        default_factory=list, description="Architectural trade-offs or open decisions"
    )


# ---------------------------------------------------------------------------
# Planning Agent Schemas
# ---------------------------------------------------------------------------
class TaskCandidate(BaseModel):
    title: str = Field(..., description="Actionable task title")
    description: Optional[str] = Field(None, description="Detailed implementation task description")
    priority: Literal["must", "should", "may"] = Field(
        default="must", description="Priority level"
    )
    depends_on: List[str] = Field(default_factory=list, description="Task IDs this task depends upon")
    requirement_refs: List[str] = Field(
        default_factory=list, description="Associated requirement IDs"
    )
    component_refs: List[str] = Field(
        default_factory=list, description="Associated component IDs"
    )


class PlanningAgentOutput(BaseModel):
    reply_text: str = Field(..., description="Markdown response detailing the implementation breakdown")
    tasks: List[TaskCandidate] = Field(
        default_factory=list, description="Proposed breakdown tasks"
    )
    unresolved_questions: List[str] = Field(
        default_factory=list, description="Sequencing or dependency questions"
    )


# ---------------------------------------------------------------------------
# Testing Agent Schemas
# ---------------------------------------------------------------------------
class TestCaseCandidate(BaseModel):
    __test__ = False
    type: Literal["unit", "integration", "security", "scenario"] = Field(
        default="unit", description="Test category"
    )
    title: str = Field(..., description="Descriptive test case title")
    procedure: List[str] = Field(default_factory=list, description="Step-by-step test procedure")
    expected_result: str = Field(..., description="Expected outcome of the test")
    requirement_refs: List[str] = Field(
        default_factory=list, description="Requirement IDs validated by this test case"
    )


class TestingAgentOutput(BaseModel):
    __test__ = False
    reply_text: str = Field(..., description="Markdown response explaining test strategy")
    test_cases: List[TestCaseCandidate] = Field(
        default_factory=list, description="Proposed test cases"
    )
    unresolved_questions: List[str] = Field(
        default_factory=list, description="Test environment or validation questions"
    )


# ---------------------------------------------------------------------------
# Risk Agent Schemas
# ---------------------------------------------------------------------------
class RiskCandidate(BaseModel):
    category: str = Field(..., description="Risk category (security, performance, compliance, etc.)")
    description: str = Field(..., description="Detailed description of the risk scenario")
    likelihood: Literal["low", "medium", "high"] = Field(..., description="Probability of occurrence")
    impact: Literal["low", "medium", "high", "critical"] = Field(..., description="Severity of impact")
    mitigation_refs: List[str] = Field(
        default_factory=list, description="Task IDs intended to mitigate this risk"
    )


class RiskAgentOutput(BaseModel):
    reply_text: str = Field(..., description="Markdown response detailing identified risks")
    risks: List[RiskCandidate] = Field(
        default_factory=list, description="Proposed risk entries"
    )
    unresolved_questions: List[str] = Field(
        default_factory=list, description="Risk assessment questions or assumptions"
    )


# ---------------------------------------------------------------------------
# General Clarification / General Conversation Schema
# ---------------------------------------------------------------------------
class ClarificationOutput(BaseModel):
    reply_text: str = Field(..., description="Helpful explanation or clarification message")
    unresolved_questions: List[str] = Field(
        default_factory=list, description="Questions clarifying user intent"
    )
