"""
relay_nudge_server.py
Lightweight FastAPI server exposing the /relay-nudge endpoint.

Usage:
    uvicorn execution.relay_nudge_server:app --reload --port 8000
"""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from execution.mvp_models import (
    ErrorResponse,
    IncomingTask,
    NeuroProfile,
    NeuroState,
    RelayNudgeResponse,
)
from execution.mvp_task_logic import (
    find_transitioning_peer,
    generate_ai_summary,
    task_score,
)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="NeuroX Relay-Nudge Service",
    version="0.1.0",
    description=(
        "Scores incoming urgent tasks against the target user's NeuroProfile. "
        "When the target is in Hyper-Focus, redirects the task to a "
        "'Transitioning' peer with an AI-generated summary."
    ),
)

# CORS — allow the web frontend to call the API from any origin during dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the web platform as static files under /app
_WEB_DIR = Path(__file__).resolve().parent.parent / "web"
if _WEB_DIR.is_dir():
    app.mount("/app", StaticFiles(directory=str(_WEB_DIR), html=True), name="web")

logger = logging.getLogger("neurox.relay")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

# ---------------------------------------------------------------------------
# In-memory user profile store (mock — swap for DB in production)
# ---------------------------------------------------------------------------

_USER_PROFILES: dict[str, NeuroProfile] = {
    "user-100": NeuroProfile(
        user_id="user-100",
        display_name="Vishwak Chander",
        state=NeuroState.HYPER_FOCUS,
        focus_score=0.92,
    ),
    "user-200": NeuroProfile(
        user_id="user-200",
        display_name="Kiran Desai",
        state=NeuroState.FLOW,
        focus_score=0.70,
    ),
    "user-300": NeuroProfile(
        user_id="user-300",
        display_name="Meena Rajput",
        state=NeuroState.SCATTERED,
        focus_score=0.20,
    ),
}


def _lookup_profile(user_id: str) -> NeuroProfile | None:
    return _USER_PROFILES.get(user_id)


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def _global_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    body: dict[str, Any] = ErrorResponse(
        code="INTERNAL_ERROR",
        detail="An unexpected error occurred. Please try again later.",
    ).model_dump(mode="json")
    return JSONResponse(status_code=500, content=body)


# ---------------------------------------------------------------------------
# Health check & Root
# ---------------------------------------------------------------------------

@app.get("/")
async def root_redirect():
    """Redirect base URL to the web platform."""
    return RedirectResponse(url="/app/")

@app.get("/health", tags=["ops"])
async def health_check() -> dict[str, str]:
    """Simple liveness probe."""
    return {"status": "ok", "service": "neurox-relay-nudge"}


# ---------------------------------------------------------------------------
# Gemini API Initialization
# ---------------------------------------------------------------------------
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

model = None
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-1.5-flash')
    except Exception as e:
        logger.error(f"Failed to initialize Gemini model: {e}")

# ---------------------------------------------------------------------------
# POST /therapy-chat
# ---------------------------------------------------------------------------

@app.post("/therapy-chat")
async def therapy_chat(request: Request):
    data = await request.json()
    user_msg = data.get("message")
    
    if not model:
        return {"reply": "I'm in offline mode right now, but I can tell you're looking for support. Take a deep breath. (API Key not configured)"}
    
    try:
        prompt = f"You are an empathetic AI therapist for neurodiverse individuals. User says: {user_msg}. Respond concisely and supportively."
        response = model.generate_content(prompt)
        return {"reply": response.text}
    except Exception as e:
        logger.error(f"Gemini API Error: {e}")
        return {"reply": "My neural processors are a bit overwhelmed. Let's try again in a moment."}


# ---------------------------------------------------------------------------
# POST /relay-nudge
# ---------------------------------------------------------------------------

@app.post(
    "/relay-nudge",
    response_model=RelayNudgeResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Validation / business-rule error"},
        404: {"model": ErrorResponse, "description": "Target user not found"},
        409: {"model": ErrorResponse, "description": "Target user is not in Hyper-Focus"},
        503: {"model": ErrorResponse, "description": "No Transitioning peer available"},
    },
    tags=["relay"],
    summary="Relay an urgent task away from a Hyper-Focused user",
)
async def relay_nudge(task: IncomingTask) -> RelayNudgeResponse:
    """Accept an incoming urgent task and, if the target user is in
    *Hyper-Focus*, score the task using the MVP logic, find a
    *Transitioning* peer, and return a redirection payload with a
    one-sentence AI summary.

    **Flow:**
    1. Look up the target user's NeuroProfile.
    2. Verify the user is in ``Hyper-Focus`` state.
    3. Score the task via ``task_score()``.
    4. Find a ``Transitioning`` peer via ``find_transitioning_peer()``.
    5. Generate a one-sentence AI summary.
    6. Return the redirection payload.
    """

    # 1. Resolve target user --------------------------------------------------
    profile: NeuroProfile | None = _lookup_profile(task.target_user_id)
    if profile is None:
        logger.warning("Target user %s not found", task.target_user_id)
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                code="USER_NOT_FOUND",
                detail=f"No NeuroProfile found for user '{task.target_user_id}'.",
            ).model_dump(mode="json"),
        )

    # 2. Check cognitive state -------------------------------------------------
    if profile.state != NeuroState.HYPER_FOCUS:
        logger.info(
            "User %s is in state '%s', not Hyper-Focus — no redirect needed",
            task.target_user_id,
            profile.state.value,
        )
        raise HTTPException(
            status_code=409,
            detail=ErrorResponse(
                code="NOT_HYPER_FOCUS",
                detail=(
                    f"User '{profile.display_name}' is currently in "
                    f"'{profile.state.value}' state. Redirection is only "
                    f"triggered during 'Hyper-Focus'."
                ),
            ).model_dump(mode="json"),
        )

    # 3. Score the task --------------------------------------------------------
    score_result = task_score(task)
    logger.info(
        "Task %s scored %.2f (redirect=%s)",
        task.task_id,
        score_result.final_score,
        score_result.should_redirect,
    )

    # 4. Find a Transitioning peer --------------------------------------------
    peer: NeuroProfile | None = find_transitioning_peer(
        exclude_user_id=task.target_user_id,
    )
    if peer is None:
        logger.error("No Transitioning peer available for redirect")
        raise HTTPException(
            status_code=503,
            detail=ErrorResponse(
                code="NO_PEER_AVAILABLE",
                detail=(
                    "No team member is currently in 'Transitioning' state "
                    "to accept the redirected task."
                ),
            ).model_dump(mode="json"),
        )

    # 5. Generate AI summary ---------------------------------------------------
    ai_summary: str = generate_ai_summary(task)

    # 6. Build response --------------------------------------------------------
    response = RelayNudgeResponse(
        original_target=profile.display_name,
        redirected_to=peer.display_name,
        redirected_to_state=peer.state,
        task_id=task.task_id,
        task_score=score_result.final_score,
        ai_summary=ai_summary,
    )

    logger.info(
        "Task %s redirected from %s → %s",
        task.task_id,
        profile.display_name,
        peer.display_name,
    )
    return response
