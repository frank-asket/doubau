"""Career Copilot: LangChain agent + WebSocket streaming + session history."""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.agents.copilot_runner import (
    build_copilot_executor,
    executor_output_text,
    tuples_to_messages,
)
from app.api.deps import CurrentUserDep, DbDep, user_from_token_payload
from app.db import SessionLocal
from app.models.copilot_session import CopilotMessage, CopilotSession
from app.security import decode_any_access_token

log = logging.getLogger(__name__)

router = APIRouter(prefix="/copilot", tags=["copilot"])

# ~20 conversational turns (user + assistant), capped at 40 rows.
_MAX_CONTEXT_MESSAGES = 40


class SessionOut(BaseModel):
    id: UUID


class WsClientMessage(BaseModel):
    text: str = Field(min_length=1, max_length=12_000)


@router.post("/sessions", response_model=SessionOut)
def create_session(db: DbDep, current_user: CurrentUserDep) -> SessionOut:
    s = CopilotSession(user_id=current_user.id)
    db.add(s)
    db.commit()
    db.refresh(s)
    return SessionOut(id=s.id)


@router.websocket("/ws")
async def copilot_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    token = websocket.query_params.get("token") or websocket.query_params.get("access_token")
    session_id_raw = websocket.query_params.get("session_id")
    if not token or not session_id_raw:
        await websocket.close(code=4401)
        return
    try:
        sid = UUID(session_id_raw)
    except Exception:
        await websocket.close(code=4400)
        return

    try:
        payload = await decode_any_access_token(token)
    except Exception:
        await websocket.close(code=4401)
        return

    with SessionLocal() as db:
        try:
            user = user_from_token_payload(db, payload)
        except HTTPException:
            await websocket.close(code=4401)
            return
        sess = db.get(CopilotSession, sid)
        if sess is None or sess.user_id != user.id:
            await websocket.close(code=4403)
            return

    try:
        while True:
            raw = await websocket.receive_json()
            try:
                msg = WsClientMessage.model_validate(raw)
            except Exception:
                await websocket.send_json({"type": "error", "detail": "invalid_message"})
                continue

            with SessionLocal() as db:
                try:
                    user = user_from_token_payload(db, payload)
                except HTTPException:
                    await websocket.close(code=4401)
                    return
                sess = db.get(CopilotSession, sid)
                if sess is None or sess.user_id != user.id:
                    await websocket.close(code=4403)
                    return

                db.add(CopilotMessage(session_id=sid, role="user", content=msg.text))
                db.commit()

                rows = db.scalars(
                    select(CopilotMessage)
                    .where(CopilotMessage.session_id == sid)
                    .order_by(CopilotMessage.created_at.asc())
                ).all()
                if not rows or rows[-1].role != "user":
                    await websocket.send_json({"type": "error", "detail": "history_mismatch"})
                    continue
                prior_rows = rows[:-1]
                if len(prior_rows) > _MAX_CONTEXT_MESSAGES:
                    prior_rows = prior_rows[-_MAX_CONTEXT_MESSAGES:]
                hist_tuples = [(m.role, m.content) for m in prior_rows]
                chat_history = tuples_to_messages(hist_tuples)

                ex = build_copilot_executor(db, user.id)
                if ex is None:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "detail": (
                                "Career Copilot is not configured. Set DOUBOW_OPENAI_API_KEY "
                                "(or OPENAI_API_KEY), "
                                "or configure DOUBOW_OPENROUTER_API_KEY + DOUBOW_OPENROUTER_*."
                            ),
                        }
                    )
                    continue

                # Bind loop variables for asyncio.to_thread() helper (ruff B023).
                _ex = ex
                _text = msg.text
                _history = chat_history

                def _run(executor=_ex, text=_text, history=_history) -> str:
                    result = executor.invoke({"input": text, "chat_history": history})
                    return executor_output_text(result)

                try:
                    assistant_text = await asyncio.to_thread(_run)
                except Exception as e:  # noqa: BLE001
                    log.warning("copilot agent failed: %s", e)
                    await websocket.send_json({"type": "error", "detail": "agent_failed"})
                    continue

                db.add(CopilotMessage(session_id=sid, role="assistant", content=assistant_text))
                db.commit()

                chunk_size = 48
                for i in range(0, len(assistant_text), chunk_size):
                    await websocket.send_json(
                        {"type": "delta", "text": assistant_text[i : i + chunk_size]}
                    )
                await websocket.send_json({"type": "done"})
    except WebSocketDisconnect:
        return
