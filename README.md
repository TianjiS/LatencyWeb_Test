# TRTC Latency Test App

Lightweight FastAPI + vanilla JS app for measuring Tencent RTC Engine end-to-end latency with TRTC Web SDK V5.

## What It Measures

- Method A: audience logs every valid `TRTC.EVENT.STATISTICS` remote sample to a per-session CSV.
- Method B: anchor publishes a canvas-composited camera stream with an NTP-corrected timestamp burned into the video frame.

The app intentionally avoids heavy UI work, charts, client-side aggregation, and polling so the measurement harness adds as little latency as practical.

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Copy-Item .env.example backend\.env
```

Edit `backend\.env` and set `TRTC_SDK_SECRET_KEY`.

## Run

```powershell
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000`.

## Test Flow

1. Open one browser as `Anchor`, choose a numeric room ID, and join.
2. Open another browser or machine as `Audience` using the same room ID.
3. Audience sessions immediately create `data/{session_id}.csv`; valid statistics samples append to that file.
4. For visual analysis, screen-record the audience video next to `https://time.is`.
5. Download raw CSV from `GET /api/sessions/{session_id}/csv`.

## Notes

- Keep `TRTC_SDK_SECRET_KEY` backend-only. Do not expose it to frontend code.
- Anchor calls `SetAudioCacheParams` after `enterRoom` and before publishing the canvas stream.
- `point2PointDelay == 0` is ignored because it indicates unsupported/old remote SDK reporting.
- Percentile analysis is intentionally offline with Excel, pandas, or similar tools.
