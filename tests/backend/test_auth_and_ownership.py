"""Unit tests for authentication dependencies and project ownership isolation.

Follows Implementation Plan §12, API Contract §1, and ADR-011.
"""

import pytest
from backend.auth.dependencies import (
    extract_bearer_token,
    require_authenticated_user,
    require_project_access,
)
from backend.auth.token_verifier import TokenVerifier
from backend.domain.exceptions import AuthRequiredException, ForbiddenException, NotFoundException
from backend.domain.models import Project
from backend.firestore import get_project_repo, reset_in_memory_store


class MockTokenVerifier(TokenVerifier):
    def verify_id_token(self, token: str):
        if token == "valid-token-alice":
            return {"uid": "alice", "email": "alice@example.com"}
        if token == "valid-token-bob":
            return {"uid": "bob", "email": "bob@example.com"}
        if token == "malformed-claims":
            return {}
        raise ValueError("Invalid signature")


@pytest.fixture(autouse=True)
def setup_store():
    reset_in_memory_store()
    yield
    reset_in_memory_store()


def test_extract_bearer_token_success():
    token = extract_bearer_token("Bearer my-secret-token")
    assert token == "my-secret-token"


def test_extract_bearer_token_missing():
    with pytest.raises(AuthRequiredException) as exc:
        extract_bearer_token(None)
    assert "Missing Authorization header" in str(exc.value)


def test_extract_bearer_token_invalid_format():
    with pytest.raises(AuthRequiredException) as exc:
        extract_bearer_token("Basic dXNlcjpwYXNz")
    assert "Invalid Authorization header format" in str(exc.value)


def test_require_authenticated_user_success():
    verifier = MockTokenVerifier()
    uid = require_authenticated_user(authorization="Bearer valid-token-alice", verifier=verifier)
    assert uid == "alice"


def test_require_authenticated_user_invalid_token():
    verifier = MockTokenVerifier()
    with pytest.raises(AuthRequiredException):
        require_authenticated_user(authorization="Bearer bad-token", verifier=verifier)


def test_require_authenticated_user_missing_uid():
    verifier = MockTokenVerifier()
    with pytest.raises(AuthRequiredException):
        require_authenticated_user(authorization="Bearer malformed-claims", verifier=verifier)


def test_require_project_access_owner_allowed():
    project_repo = get_project_repo()
    project = Project(
        project_id="proj-100",
        owner_uid="alice",
        name="Alice Project",
    )
    project_repo.create(project)

    # Alice accesses her own project
    accessed = require_project_access(project_id="proj-100", user_uid="alice")
    assert accessed.project_id == "proj-100"
    assert accessed.owner_uid == "alice"


def test_require_project_access_non_owner_forbidden():
    project_repo = get_project_repo()
    project = Project(
        project_id="proj-100",
        owner_uid="alice",
        name="Alice Project",
    )
    project_repo.create(project)

    # Bob attempts to access Alice's project
    with pytest.raises(ForbiddenException):
        require_project_access(project_id="proj-100", user_uid="bob")


def test_require_project_access_missing_project_not_found():
    with pytest.raises(NotFoundException):
        require_project_access(project_id="nonexistent-proj", user_uid="alice")
