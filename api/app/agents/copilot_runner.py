"""LangChain tool-calling agent for Career Copilot."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
from sqlalchemy.orm import Session

from app.agents.copilot_tools import build_copilot_tools
from app.core.settings import settings


def build_copilot_executor(db: Session, user_id: UUID) -> AgentExecutor | None:
    api_key: str | None = None
    model: str | None = None
    base_url: str | None = None

    # Prefer direct OpenAI; fall back to OpenRouter if configured (keeps Copilot usable
    # in demos where only OpenRouter is provisioned).
    if settings.openai_api_key:
        api_key = settings.openai_api_key
        model = settings.openai_chat_model
    elif settings.openrouter_api_key:
        api_key = settings.openrouter_api_key
        model = settings.openrouter_chat_model
        base_url = settings.openrouter_base_url.rstrip("/")
    else:
        return None
    tools = build_copilot_tools(db, user_id)
    llm = ChatOpenAI(model=model, api_key=api_key, base_url=base_url, temperature=0.25)
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                (
                    "You are Career Copilot for Doubow: applications, drafts, interview prep, and "
                    "jobs. "
                    "Use tools for facts; keep answers short and actionable."
                ),
            ),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder("agent_scratchpad"),
        ]
    )
    agent = create_tool_calling_agent(llm, tools, prompt)
    return AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=False,
        max_iterations=12,
        handle_parsing_errors=True,
    )


def tuples_to_messages(history: list[tuple[str, str]]) -> list[BaseMessage]:
    out: list[BaseMessage] = []
    for role, content in history:
        if role == "user":
            out.append(HumanMessage(content=content))
        else:
            out.append(AIMessage(content=content))
    return out


def executor_output_text(result: dict[str, Any]) -> str:
    if "output" in result:
        return str(result["output"])
    return str(result)
