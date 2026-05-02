import pytest
from mvp_models import IncomingTask
from mvp_task_logic import task_score

def test_task_score_critical_urgency():
    task = IncomingTask(
        task_id="T1",
        title="Server Down",
        description="The main database is completely unreachable.",
        source="PagerDuty",
        urgency="critical",
        target_user_id="user-100"
    )
    result = task_score(task)
    assert result.score >= 50  # Critical urgency has a base weight of 50
    assert "critical" in result.summary.lower()

def test_task_score_low_urgency():
    task = IncomingTask(
        task_id="T2",
        title="Update documentation",
        description="Fix typo in the readme.",
        source="Slack",
        urgency="low",
        target_user_id="user-100"
    )
    result = task_score(task)
    assert result.score <= 30  # Low urgency and short length should yield low score
