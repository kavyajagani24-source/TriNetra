"""
Serve the Phase F Command Center UI.
Maps /data/* → outputs/sih_demo/* (no fake data; reads pipeline artifacts only).

Usage:
    python run_sih_demo.py          # generate artifacts first
    python serve_command_center.py  # open http://127.0.0.1:8765
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import threading
import time
import uuid
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlparse

PROJECT_ROOT = Path(__file__).parent.resolve()
UI_ROOT = PROJECT_ROOT / "command_center"
DATA_ROOT = PROJECT_ROOT / "outputs" / "sih_demo"
TRAFFIC_DATA_ROOT = PROJECT_ROOT / "outputs" / "traffic_demo"
LIVE_RUNS_ROOT = PROJECT_ROOT / "outputs" / "live_runs"
HOST = "127.0.0.1"
PORT = 8765
MAX_UPLOAD_BYTES = 1_000 * 1024 * 1024  # 1 GB, local-only video test limit.
ALLOWED_VIDEO_SUFFIXES = {".mp4", ".mov", ".avi", ".mkv", ".webm"}

_live_run_lock = threading.Lock()
_live_run: dict = {"status": "idle"}


def _set_live_run(**values: object) -> None:
    """Update the one-at-a-time local live-test status safely."""
    with _live_run_lock:
        _live_run.update(values)


def _get_live_run() -> dict:
    with _live_run_lock:
        return dict(_live_run)


def _tail(path: Path, limit: int = 3000) -> str:
    if not path.exists():
        return ""
    with open(path, "rb") as f:
        f.seek(0, os.SEEK_END)
        f.seek(max(0, f.tell() - limit))
        return f.read().decode("utf-8", errors="replace")


def _run_live_test(run_id: str, run_dir: Path, video_path: Path) -> None:
    """Run the existing one-pass Urban AI engine in a background thread."""
    log_path = run_dir / "run.log"
    _set_live_run(status="running", message="Loading existing models and analysing video…")
    command = [
        sys.executable, str(PROJECT_ROOT / "run_urban_ai.py"),
        "--video", str(video_path),
        "--gps", str(PROJECT_ROOT / "data" / "demo_gps.csv"),
        "--output", str(run_dir),
        "--profile", "road_damage_sensitive",
        "--process-all",
        "--bus-id", "USER_UPLOAD",
        "--camera-id", "USER_CAMERA",
    ]
    try:
        with open(log_path, "w", encoding="utf-8") as log:
            completed = subprocess.run(
                command, cwd=PROJECT_ROOT, stdout=log, stderr=subprocess.STDOUT,
                check=False,
            )
        if completed.returncode:
            _set_live_run(
                status="failed",
                message="The existing engine stopped before producing results.",
                log_tail=_tail(log_path),
            )
            return

        report_path = next((run_dir / "metrics").glob("*_report.json"), None)
        observation_path = next((run_dir / "observations").glob("*_observations.json"), None)
        issue_path = next((run_dir / "issues").glob("*_issues.json"), None)
        annotated_path = next((run_dir / "annotated").glob("*.mp4"), None)
        if not report_path:
            raise RuntimeError("Run completed without a metrics report.")
        report = json.loads(report_path.read_text(encoding="utf-8"))
        observations = json.loads(observation_path.read_text(encoding="utf-8")) if observation_path else {}
        issues = json.loads(issue_path.read_text(encoding="utf-8")) if issue_path else {}
        _set_live_run(
            status="complete",
            message="Live GPU analysis complete.",
            report=report,
            observation_count=observations.get("total_observations", 0),
            issue_count=issues.get("total_issues", 0),
            annotated_video=(f"/live-runs/{run_id}/annotated/{annotated_path.name}" if annotated_path else None),
            report_url=f"/live-runs/{run_id}/metrics/{report_path.name}",
            observations_url=(f"/live-runs/{run_id}/observations/{observation_path.name}" if observation_path else None),
            issues_url=(f"/live-runs/{run_id}/issues/{issue_path.name}" if issue_path else None),
        )
    except Exception as exc:  # Surface local-run errors to the browser, not a blank page.
        _set_live_run(status="failed", message=str(exc), log_tail=_tail(log_path))


def _start_live_run(filename: str, body, content_length: int) -> dict:
    """Persist one browser upload and start the existing inference runner."""
    if content_length <= 0 or content_length > MAX_UPLOAD_BYTES:
        raise ValueError("Video must be between 1 byte and 1 GB.")
    safe_name = Path(filename).name or "upload.mp4"
    if Path(safe_name).suffix.lower() not in ALLOWED_VIDEO_SUFFIXES:
        raise ValueError("Supported video formats: MP4, MOV, AVI, MKV, WEBM.")
    if _get_live_run().get("status") in {"queued", "running"}:
        raise RuntimeError("A live test is already running. Wait for it to finish first.")

    run_id = f"live_{uuid.uuid4().hex[:8]}"
    run_dir = LIVE_RUNS_ROOT / run_id
    input_dir = run_dir / "input"
    input_dir.mkdir(parents=True, exist_ok=False)
    video_path = input_dir / safe_name
    remaining = content_length
    with open(video_path, "wb") as output:
        while remaining:
            chunk = body.read(min(1024 * 1024, remaining))
            if not chunk:
                raise ValueError("Upload ended before the declared size.")
            output.write(chunk)
            remaining -= len(chunk)

    _set_live_run(
        status="queued", run_id=run_id, filename=safe_name,
        message="Video received. Preparing local GPU test…", started_at=time.time(),
    )
    threading.Thread(
        target=_run_live_test, args=(run_id, run_dir, video_path), daemon=True,
        name=f"live-test-{run_id}",
    ).start()
    return _get_live_run()


class CommandCenterHandler(SimpleHTTPRequestHandler):
    """Serve UI from command_center/ and pipeline JSON from outputs/sih_demo/."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(UI_ROOT), **kwargs)

    def translate_path(self, path: str) -> str:
        if path.startswith("/data/"):
            rel = path[len("/data/") :].lstrip("/")
            target = (DATA_ROOT / rel).resolve()
            if not str(target).startswith(str(DATA_ROOT.resolve())):
                return str(UI_ROOT / "404.html")
            return str(target)
        if path.startswith("/traffic-data/"):
            rel = path[len("/traffic-data/") :].lstrip("/")
            target = (TRAFFIC_DATA_ROOT / rel).resolve()
            if not str(target).startswith(str(TRAFFIC_DATA_ROOT.resolve())):
                return str(UI_ROOT / "404.html")
            return str(target)
        if path.startswith("/live-runs/"):
            rel = path[len("/live-runs/") :].lstrip("/")
            target = (LIVE_RUNS_ROOT / rel).resolve()
            if not str(target).startswith(str(LIVE_RUNS_ROOT.resolve())):
                return str(UI_ROOT / "404.html")
            return str(target)
        return super().translate_path(path)

    def _send_json(self, payload: dict, status: int = 200) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        if urlparse(self.path).path == "/api/live-run/status":
            self._send_json(_get_live_run())
            return
        super().do_GET()

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/live-run":
            self._send_json({"error": "Unknown API endpoint."}, 404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            filename = unquote(self.headers.get("X-Upload-Filename", "upload.mp4"))
            result = _start_live_run(filename, self.rfile, length)
            self._send_json(result, 202)
        except (ValueError, RuntimeError) as exc:
            self._send_json({"error": str(exc)}, 400)
        except Exception as exc:
            self._send_json({"error": f"Upload failed: {exc}"}, 500)

    def end_headers(self) -> None:
        # Prevent a local browser from pairing a new HTML shell with a stale
        # JavaScript bundle during evaluator/demo restarts.
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, format: str, *args) -> None:
        sys.stderr.write("[command-center] " + (format % args) + "\n")


def main() -> None:
    if not DATA_ROOT.exists():
        print("ERROR: outputs/sih_demo/ not found. Run: python run_sih_demo.py")
        sys.exit(1)
    if not UI_ROOT.exists():
        print("ERROR: command_center/ not found.")
        sys.exit(1)

    # A browser can keep an asset request open. Serve other local artifacts
    # independently so one stalled request never makes the dashboard blank.
    server = ThreadingHTTPServer((HOST, PORT), CommandCenterHandler)
    url = f"http://{HOST}:{PORT}"
    print("=" * 56)
    print("  THE SIXTH SENSE — VISUAL COMMAND CENTER (Phase F)")
    print("=" * 56)
    print(f"  UI   : {UI_ROOT}")
    print(f"  Data : {DATA_ROOT}")
    print(f"  URL  : {url}")
    print("  Press Ctrl+C to stop")
    print("=" * 56)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
