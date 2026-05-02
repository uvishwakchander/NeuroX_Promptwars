"""
mvp_models.py
Pydantic models for the NeuroX relay-nudge MVP.

Defines strict types for NeuroProfile states, incoming tasks,
scoring results, and the relay-nudge API contract.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Domain enums
# ---------------------------------------------------------------------------

class NeuroState(str, Enum):
    """Cognitive states tracked by a user's NeuroProfile."""
    HYPER_FOCUS = "Hyper-Focus"
    FLOW = "Flow"
    TRANSITIONING = "Transitioning"
    SCATTERED = "Scattered"
    RESTING = "Resting"


class TaskUrgency(str, Enum):
    """Urgency classification for incoming tasks."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


# ---------------------------------------------------------------------------
# Core domain models
# ---------------------------------------------------------------------------

class NeuroProfile(BaseModel):
    """A lightweight representation of a user's cognitive profile."""
    user_id: str = Field(..., description="Unique identifier for the user")
    display_name: str = Field(..., description="Human-readable name")
    state: NeuroState = Field(..., description="Current cognitive state")
    focus_score: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="0-1 score indicating depth of current focus",
    )


class IncomingTask(BaseModel):
    """Schema for an urgent task submitted to the relay-nudge endpoint."""
    task_id: str = Field(..., description="Unique task identifier")
    title: str = Field(..., min_length=1, max_length=256, description="Short task title")
    description: str = Field(..., min_length=1, description="Full task description")
    urgency: TaskUrgency = Field(..., description="Urgency level of the task")
    source: str = Field(..., description="Origin system or user who sent the task")
    target_user_id: str = Field(..., description="User ID this task is intended for")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TaskScoreResult(BaseModel):
    """Output from the task-scoring logic."""
    task_id: str
    raw_score: float = Field(..., ge=0.0, le=100.0)
    urgency_weight: float
    final_score: float = Field(..., ge=0.0, le=100.0)
    should_redirect: bool


# ---------------------------------------------------------------------------
# API response models
# ---------------------------------------------------------------------------

class RelayNudgeResponse(BaseModel):
    """Successful response from /relay-nudge."""
    status: str = Field(default="redirected")
    original_target: str
    redirected_to: str
    redirected_to_state: NeuroState
    task_id: str
    task_score: float
    ai_summary: str = Field(
        ...,
        description="One-sentence AI-generated summary of the task",
    )


class ErrorResponse(BaseModel):
    """Standard error envelope."""
    status: str = Field(default="error")
    code: str
    detail: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
