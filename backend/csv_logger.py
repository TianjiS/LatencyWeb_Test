import csv
from pathlib import Path


CSV_FIELDS = [
    "timestamp",
    "session_id",
    "remote_user_id",
    "point2point_delay_ms",
    "jitter_buffer_delay_ms",
    "rtt_ms",
    "up_loss_pct",
    "down_loss_pct",
    "video_packet_loss_pct",
    "audio_packet_loss_pct",
    "video_bitrate_kbps",
    "video_framerate",
    "video_resolution",
]


def append_log_row(output_dir: Path, session_id: str, row: dict) -> None:
    ensure_session_csv(output_dir, session_id)

    csv_path = output_dir / f"{session_id}.csv"
    with csv_path.open("a", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writerow(row)


def ensure_session_csv(output_dir: Path, session_id: str) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / f"{session_id}.csv"
    write_header = not csv_path.exists()

    if write_header:
        with csv_path.open("w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(file, fieldnames=CSV_FIELDS, extrasaction="ignore")
            writer.writeheader()

    return csv_path
