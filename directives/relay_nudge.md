# Directive: Relay-Nudge Service

## Goal
Provide a FastAPI microservice that intercepts urgent tasks aimed at Hyper-Focused users and redirects them to a Transitioning peer, preserving the original user's deep work session.

## Inputs
- **POST body** (`IncomingTask`): `task_id`, `title`, `description`, `urgency` (critical/high/medium/low), `source`, `target_user_id`.

## Flow
1. Resolve `target_user_id` → `NeuroProfile`.  
   - 404 if unknown.
2. Check `NeuroProfile.state == Hyper-Focus`.  
   - 409 if not — task can be delivered normally.
3. Run `task_score()` from `execution/mvp_task_logic.py`.  
   - Weighted formula: urgency (0-60) + keyword boost (0-30) + length signal (0-10).
4. Call `find_transitioning_peer()` to locate a suitable delegate.  
   - 503 if none available.
5. Generate a 1-sentence AI summary via `generate_ai_summary()`.  
   - MVP: deterministic template. Prod: swap for LLM call.
6. Return `RelayNudgeResponse` with original target, redirected peer, score, and summary.

## Execution Scripts
| Script | Purpose |
|---|---|
| `execution/mvp_models.py` | Pydantic models (strict types, enums, constraints) |
| `execution/mvp_task_logic.py` | `task_score`, `prioritize_tasks`, `generate_ai_summary`, `find_transitioning_peer` |
| `execution/relay_nudge_server.py` | FastAPI app with `/relay-nudge` POST + `/health` GET |

## Run
```bash
pip install -r requirements.txt
python -m uvicorn execution.relay_nudge_server:app --reload --port 8000
```

## Test (PowerShell)
```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8000/relay-nudge -Method POST `
  -ContentType 'application/json' `
  -Body '{"task_id":"TSK-042","title":"Production DB Outage","description":"Primary PostgreSQL cluster is unreachable.","urgency":"critical","source":"PagerDuty","target_user_id":"user-100"}' | ConvertTo-Json
```

## Error Codes
| HTTP | Code | When |
|------|------|------|
| 404 | `USER_NOT_FOUND` | `target_user_id` doesn't exist |
| 409 | `NOT_HYPER_FOCUS` | Target user is in a state other than Hyper-Focus |
| 503 | `NO_PEER_AVAILABLE` | No Transitioning peer in the registry |
| 500 | `INTERNAL_ERROR` | Uncaught exception (global handler) |

## Learnings
- PowerShell doesn't support curl's `-H` flag natively — use `Invoke-RestMethod` with `-ContentType`.
- `uvicorn` installed to user Scripts dir; may need PATH addition on Windows.

## Production Checklist
- [ ] Replace `_USER_PROFILES` dict with database/profile-service lookup.
- [ ] Replace `_MOCK_PEER_REGISTRY` with live team-state query.
- [ ] Replace `generate_ai_summary()` stub with real LLM call (Gemini / Claude).
- [ ] Add authentication middleware (JWT / API key).
- [ ] Add rate limiting on `/relay-nudge`.
- [ ] Add OpenTelemetry tracing spans.
