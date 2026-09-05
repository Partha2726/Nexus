import asyncio
import pytest
from backend.api.chat import chat_turn, get_conversation_history, set_agent_orchestrator, get_agent_orchestrator
from backend.agents.orchestrator import AgentOrchestrator
from backend.agents.gemini_client import GeminiClient
from backend.domain.models import ChatRequest, Project
from backend.firestore import (
    get_conversation_repo,
    get_project_repo,
    get_proposal_repo,
    reset_in_memory_store,
)


@pytest.fixture(autouse=True)
def setup_store():
    reset_in_memory_store()
    orig_orchestrator = get_agent_orchestrator()
    set_agent_orchestrator(AgentOrchestrator(model_client=GeminiClient(allow_offline_fallback=True)))
    yield
    reset_in_memory_store()
    set_agent_orchestrator(orig_orchestrator)


def test_multi_turn_chat_and_history_persistence():
    """Test full multi-turn conversation flow, proposal creation, and history retrieval."""
    async def _run_test():
        project_repo = get_project_repo()
        conv_repo = get_conversation_repo()
        prop_repo = get_proposal_repo()

        project = Project(
            project_id="proj-chat-1",
            owner_uid="alice",
            name="Chat Project",
            version=1,
        )
        project_repo.create(project)

        # Turn 1: Start conversation
        req1 = ChatRequest(
            message="User authentication via OAuth2 and Firebase",
        )
        res1 = await chat_turn(
            project_id="proj-chat-1",
            payload=req1,
            user_uid="alice",
        )

        assert res1.conversation_id is not None
        assert len(res1.proposals) == 1
        assert res1.proposals[0].project_version_at_creation == 1
        assert res1.agent_type == "requirements"

        # Verify proposals saved to repository
        proposal_id = res1.proposals[0].proposal_id
        saved_prop = prop_repo.get(proposal_id)
        assert saved_prop is not None
        assert saved_prop.entity_type == "requirement"

        # Turn 2: Continue same conversation
        req2 = ChatRequest(
            conversation_id=res1.conversation_id,
            message="Also require rate limiting of 100 req/min",
        )
        res2 = await chat_turn(
            project_id="proj-chat-1",
            payload=req2,
            user_uid="alice",
        )

        assert res2.conversation_id == res1.conversation_id
        assert len(res2.proposals) == 1

        # Verify conversation history
        history = get_conversation_history(
            project_id="proj-chat-1",
            conversation_id=res1.conversation_id,
            user_uid="alice",
        )

        assert history.conversation_id == res1.conversation_id
        # 2 turns = 4 messages (User -> Assistant -> User -> Assistant)
        assert len(history.messages) == 4
        assert history.messages[0].role == "user"
        assert history.messages[0].content == "User authentication via OAuth2 and Firebase"
        assert history.messages[1].role == "assistant"
        assert proposal_id in history.messages[1].proposal_ids
        assert history.messages[2].role == "user"
        assert history.messages[3].role == "assistant"

    asyncio.run(_run_test())
