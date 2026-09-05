"""Unit tests for Account 1 REST API endpoint handlers.

Follows API Contract §2, §4, §7, §10, §11, §14.
"""

import pytest
from backend.api.actions import (
    approve_action,
    get_proposal,
    list_proposals,
    reject_action,
)
from backend.api.audit import list_audit_events
from backend.api.decisions import create_decision, list_decisions
from backend.api.projects import (
    create_project,
    get_project,
    get_project_dashboard,
    list_projects,
    update_project,
)
from backend.api.requirements import get_requirement, list_requirements
from backend.domain.models import (
    ActionClass,
    DecisionCreate,
    ProjectCreate,
    ProjectUpdate,
    Proposal,
    Requirement,
)
from backend.firestore import (
    get_decision_repo,
    get_project_repo,
    get_proposal_repo,
    get_requirement_repo,
    reset_in_memory_store,
)


@pytest.fixture(autouse=True)
def setup_store():
    reset_in_memory_store()
    yield
    reset_in_memory_store()


def test_project_crud_endpoints():
    """Test Project creation, listing, retrieval, update, and dashboard endpoints."""
    project_repo = get_project_repo()

    # 1. Create project
    create_req = ProjectCreate(
        name="Apollo Project",
        description="Navigation system",
        goal="Reach orbit",
    )
    project = create_project(payload=create_req, user_uid="alice", project_repo=project_repo)
    assert project.name == "Apollo Project"
    assert project.owner_uid == "alice"
    assert project.version == 1

    # 2. List projects for Alice
    p_list = list_projects(user_uid="alice", project_repo=project_repo)
    assert len(p_list.projects) == 1
    assert p_list.projects[0].project_id == project.project_id

    # 3. List projects for Bob (should be empty)
    p_list_bob = list_projects(user_uid="bob", project_repo=project_repo)
    assert len(p_list_bob.projects) == 0

    # 4. Get single project
    p_get = get_project(project_id=project.project_id, user_uid="alice", project_repo=project_repo)
    assert p_get.project_id == project.project_id

    # 5. Patch project
    p_patch = update_project(
        project_id=project.project_id,
        payload=ProjectUpdate(description="Updated navigation system"),
        user_uid="alice",
        project_repo=project_repo,
    )
    assert p_patch.description == "Updated navigation system"
    assert p_patch.version == 1  # Version not incremented by PATCH

    # 6. Dashboard
    dash = get_project_dashboard(project_id=project.project_id, user_uid="alice")
    assert dash.project_id == project.project_id
    assert dash.requirements_count == 0
    assert dash.version == 1


def test_requirements_endpoints():
    """Test reading authoritative requirements."""
    project_repo = get_project_repo()
    req_repo = get_requirement_repo()

    p = create_project(payload=ProjectCreate(name="Req Project"), user_uid="alice", project_repo=project_repo)

    req1 = Requirement(
        requirement_id="req-1",
        project_id=p.project_id,
        type="functional",
        statement="Must support SSO",
        priority="must",
        status="accepted",
    )
    req2 = Requirement(
        requirement_id="req-2",
        project_id=p.project_id,
        type="non_functional",
        statement="Latency < 200ms",
        priority="should",
        status="accepted",
    )
    req_repo.create(req1)
    req_repo.create(req2)

    # List all
    res = list_requirements(project_id=p.project_id, user_uid="alice")
    assert len(res.requirements) == 2

    # Filter by priority
    res_must = list_requirements(project_id=p.project_id, priority="must", user_uid="alice")
    assert len(res_must.requirements) == 1
    assert res_must.requirements[0].requirement_id == "req-1"

    # Get single
    single = get_requirement(project_id=p.project_id, requirement_id="req-1", user_uid="alice")
    assert single.statement == "Must support SSO"


def test_actions_and_proposals_endpoints():
    """Test proposal listing and action approval/rejection endpoints."""
    project_repo = get_project_repo()
    prop_repo = get_proposal_repo()

    p = create_project(payload=ProjectCreate(name="Action Project"), user_uid="alice", project_repo=project_repo)

    proposal = Proposal(
        proposal_id="act-555",
        project_id=p.project_id,
        run_id="run-1",
        action_class=ActionClass.PROPOSE,
        entity_type="requirement",
        entity_payload={"statement": "Live updates"},
        status="pending",
        project_version_at_creation=1,
    )
    prop_repo.create(proposal)

    # List proposals
    proposals_resp = list_proposals(project_id=p.project_id, status="pending", user_uid="alice")
    assert len(proposals_resp.proposals) == 1
    assert proposals_resp.proposals[0].proposal_id == "act-555"

    # Get proposal
    prop_get = get_proposal(project_id=p.project_id, proposal_id="act-555", user_uid="alice")
    assert prop_get.proposal_id == "act-555"

    # Approve action (actionId == proposalId)
    app_res = approve_action(project_id=p.project_id, action_id="act-555", user_uid="alice")
    assert app_res.status == "approved"
    assert app_res.project_version == 2


def test_decisions_and_audit_endpoints():
    """Test direct decision creation and audit event listing."""
    project_repo = get_project_repo()
    p = create_project(payload=ProjectCreate(name="Dec Project"), user_uid="alice", project_repo=project_repo)

    # Create decision
    dec = create_decision(
        project_id=p.project_id,
        payload=DecisionCreate(
            title="Use FastAPI",
            decision="Adopt modular monolith with FastAPI",
            rationale="High performance and async capabilities",
        ),
        user_uid="alice",
    )
    assert dec.title == "Use FastAPI"

    # List decisions
    decs = list_decisions(project_id=p.project_id, user_uid="alice")
    assert len(decs.decisions) == 1
    assert decs.decisions[0].decision_id == dec.decision_id

    # List audit events
    audits = list_audit_events(project_id=p.project_id, user_uid="alice")
    assert isinstance(audits.events, list)
