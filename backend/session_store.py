import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _read(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def _write(path: Path, sessions: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(sessions, file, indent=2)


def create_session(
    path: Path,
    *,
    room_id: str,
    viewer_user_id: str,
    anchor_user_id: Optional[str] = None,
) -> dict:
    sessions = _read(path)
    session = {
        "session_id": f"session_{uuid.uuid4().hex[:12]}",
        "room_id": room_id,
        "viewer_user_id": viewer_user_id,
        "anchor_user_id": anchor_user_id,
        "started_at": _now_iso(),
        "ended_at": None,
    }
    sessions.append(session)
    _write(path, sessions)
    return session


def end_session(path: Path, session_id: str) -> Optional[dict]:
    sessions = _read(path)
    for session in sessions:
        if session["session_id"] == session_id:
            session["ended_at"] = session.get("ended_at") or _now_iso()
            _write(path, sessions)
            return session
    return None


def get_session(path: Path, session_id: str) -> Optional[dict]:
    for session in _read(path):
        if session["session_id"] == session_id:
            return session
    return None


def list_sessions(path: Path) -> list[dict]:
    return _read(path)
