import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

try:
    from .csv_logger import CSV_FIELDS, append_log_row, ensure_session_csv
    from .session_store import create_session, end_session, get_session, list_sessions
    from .usersig import generate_user_sig
except ImportError:
    from csv_logger import CSV_FIELDS, append_log_row, ensure_session_csv
    from session_store import create_session, end_session, get_session, list_sessions
    from usersig import generate_user_sig


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv(BASE_DIR / ".env")

SDK_APP_ID = int(os.getenv("TRTC_SDK_APP_ID", "70001131"))


def _project_path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else BASE_DIR / path


CSV_OUTPUT_DIR = _project_path(os.getenv("CSV_OUTPUT_DIR", "data"))
SESSION_STORE_PATH = _project_path(os.getenv("SESSION_STORE_PATH", "data/sessions.json"))

CSV_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
SESSION_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="TRTC Latency Test", version="0.1.0")


class UserSigRequest(BaseModel):
    userId: str = Field(min_length=1, max_length=64)


class UserSigResponse(BaseModel):
    sdkAppId: int
    userSig: str


class SessionCreateRequest(BaseModel):
    room_id: str
    viewer_user_id: str
    anchor_user_id: Optional[str] = None


class SessionCreateResponse(BaseModel):
    session_id: str


class LogRecord(BaseModel):
    timestamp: str
    session_id: str
    remote_user_id: str
    point2point_delay_ms: int
    jitter_buffer_delay_ms: Optional[int] = None
    rtt_ms: Optional[int] = None
    up_loss_pct: Optional[float] = None
    down_loss_pct: Optional[float] = None
    video_packet_loss_pct: Optional[float] = None
    audio_packet_loss_pct: Optional[float] = None
    video_bitrate_kbps: Optional[int] = None
    video_framerate: Optional[float] = None
    video_resolution: Optional[str] = None


@app.post("/api/usersig", response_model=UserSigResponse)
def usersig(payload: UserSigRequest) -> UserSigResponse:
    return UserSigResponse(
        sdkAppId=SDK_APP_ID,
        userSig=generate_user_sig(payload.userId, SDK_APP_ID),
    )


@app.post("/api/sessions", response_model=SessionCreateResponse)
def sessions_create(payload: SessionCreateRequest) -> SessionCreateResponse:
    session = create_session(
        SESSION_STORE_PATH,
        room_id=payload.room_id,
        viewer_user_id=payload.viewer_user_id,
        anchor_user_id=payload.anchor_user_id,
    )
    ensure_session_csv(CSV_OUTPUT_DIR, session["session_id"])
    return SessionCreateResponse(session_id=session["session_id"])


@app.patch("/api/sessions/{session_id}")
def sessions_end(session_id: str) -> dict:
    session = end_session(SESSION_STORE_PATH, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.get("/api/sessions")
def sessions_list() -> list[dict]:
    return list_sessions(SESSION_STORE_PATH)


@app.post("/api/logs")
def logs_append(record: LogRecord) -> dict:
    if not get_session(SESSION_STORE_PATH, record.session_id):
        raise HTTPException(status_code=404, detail="Session not found")

    row = record.model_dump()
    append_log_row(CSV_OUTPUT_DIR, record.session_id, row)
    return {"ok": True}


@app.get("/api/sessions/{session_id}/csv")
def sessions_csv(session_id: str) -> FileResponse:
    if not get_session(SESSION_STORE_PATH, session_id):
        raise HTTPException(status_code=404, detail="Session not found")

    csv_path = CSV_OUTPUT_DIR / f"{session_id}.csv"
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="CSV not found")

    return FileResponse(
        csv_path,
        media_type="text/csv",
        filename=f"{session_id}.csv",
    )


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "sdkAppId": SDK_APP_ID, "csvFields": CSV_FIELDS}


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
