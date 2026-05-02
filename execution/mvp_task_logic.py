"""
mvp_task_logic.py
Core MVP logic for NeuroX task scoring and prioritisation.

Functions:
    task_score   – Score an incoming task based on urgency and description.
    prioritize_tasks – Given a set of scored tasks, return them ranked.
    generate_ai_summary – Produce a 1-sentence summary of a task.
    find_transitioning_peer – Locate a peer in the 'Transitioning' state.
"""

from __future__ import annotations

from typing import Sequence

from execution.mvp_models import (
    IncomingTask,
    NeuroProfile,
    NeuroState,
    TaskScoreResult,
    TaskUrgency,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_URGENCY_WEIGHTS: dict[TaskUrgency, float] = {
    TaskUrgency.CRITICAL: 1.0,
    TaskUrgency.HIGH: 0.75,
    TaskUrgency.MEDIUM: 0.50,
    TaskUrgency.LOW: 0.25,
}

_KEYWORD_BOOST_TERMS: set[str] = {
    "outage", "downtime", "security", "breach", "p0",
    "incident", "data loss", "production", "blocked", "urgent",
}

_KEYWORD_BOOST: float = 15.0  # bonus points per keyword hit (capped)


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def task_score(task: IncomingTask) -> TaskScoreResult:
    """Score a task on a 0-100 scale.

    Scoring formula:
        base        = urgency_weight × 60          (max 60)
        keyword_hit = min(keyword_matches × BOOST, 30)
        length_sig  = min(len(description) / 50, 10)
        raw         = base + keyword_hit + length_sig
        final       = clamp(raw, 0, 100)

    A task with final_score ≥ 50 is flagged for redirection when the
    target user is in Hyper-Focus.
    """
    urgency_weight: float = _URGENCY_WEIGHTS[task.urgency]

    base: float = urgency_weight * 60.0

    lower_desc: str = task.description.lower()
    keyword_matches: int = sum(
        1 for kw in _KEYWORD_BOOST_TERMS if kw in lower_desc
    )
    keyword_hit: float = min(keyword_matches * _KEYWORD_BOOST, 30.0)

    length_signal: float = min(len(task.description) / 50.0, 10.0)

    raw: float = round(base + keyword_hit + length_signal, 2)
    final: float = round(min(max(raw, 0.0), 100.0), 2)

    return TaskScoreResult(
        task_id=task.task_id,
        raw_score=raw,
        urgency_weight=urgency_weight,
        final_score=final,
        should_redirect=final >= 50.0,
    )


# ---------------------------------------------------------------------------
# Prioritisation
# ---------------------------------------------------------------------------

def prioritize_tasks(
    tasks: Sequence[IncomingTask],
) -> list[TaskScoreResult]:
    """Score and sort tasks from highest priority to lowest."""
    scored: list[TaskScoreResult] = [task_score(t) for t in tasks]
    scored.sort(key=lambda s: s.final_score, reverse=True)
    return scored


# ---------------------------------------------------------------------------
# AI summary (deterministic stub — replace with LLM call in prod)
# ---------------------------------------------------------------------------

def generate_ai_summary(task: IncomingTask) -> str:
    """Return a one-sentence AI summary of the task.

    In production this would call an LLM endpoint.  For the MVP we
    construct a deterministic summary from the task metadata so the
    endpoint is fully functional without an API key.
    """
    urgency_label: str = task.urgency.value.upper()
    truncated: str = (
        task.description[:120] + "…"
        if len(task.description) > 120
        else task.description
    )
    return (
        f"[{urgency_label}] {task.title} — {truncated} "
        f"(source: {task.source})"
    )


# ---------------------------------------------------------------------------
# Peer lookup (in-memory mock registry)
# ---------------------------------------------------------------------------

# In production this would query a database or profile service.
_MOCK_PEER_REGISTRY: list[NeuroProfile] = [
    NeuroProfile(
        user_id="peer-001",
        display_name="Aarav Mehta",
        state=NeuroState.TRANSITIONING,
        focus_score=0.35,
    ),
    NeuroProfile(
        user_id="peer-002",
        display_name="Priya Sharma",
        state=NeuroState.FLOW,
        focus_score=0.80,
    ),
    NeuroProfile(
        user_id="peer-003",
        display_name="Rahul Iyer",
        state=NeuroState.TRANSITIONING,
        focus_score=0.25,
    ),
]


def find_transitioning_peer(
    exclude_user_id: str,
) -> NeuroProfile | None:
    """Find the first peer whose state is 'Transitioning'.

    Returns ``None`` if no suitable peer is available.
    """
    for peer in _MOCK_PEER_REGISTRY:
        if (
            peer.state == NeuroState.TRANSITIONING
            and peer.user_id != exclude_user_id
        ):
            return peer
    return None
