"""Generate traffic intelligence solely from an existing observation artifact."""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from sixth_sense.traffic.intelligence import build_traffic_patterns, build_traffic_windows


DEFAULT_INPUT = Path("outputs/night_drive/observations/run_a17c0aeb_observations.json")


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2), encoding="utf-8")


def build_report(summary: dict) -> str:
    counts = summary["class_counts"]
    return "\n".join([
        "TRAFFIC INTELLIGENCE DEMO",
        "",
        f"Source: {summary['source_artifact']}",
        "Source type: existing real night-drive perception artifact; no model inference rerun",
        f"Windows processed: {summary['windows_processed']}",
        f"Vehicles observed: {summary['vehicles_observed']}",
        f"Cars: {counts.get('car', 0)}",
        f"Buses: {counts.get('bus', 0)}",
        f"Trucks: {counts.get('truck', 0)}",
        f"Motorcycles: {counts.get('motorcycle', 0)}",
        f"Bicycles: {counts.get('bicycle', 0)}",
        f"Peak density: {summary['peak_density']}",
        f"Peak congestion: {summary['peak_congestion']}",
        f"Persistent bottlenecks: {summary['persistent_bottlenecks']}",
        "",
        "Metrics unavailable:",
        "speed — no reliable metric speed was persisted; no km/h values generated",
        "lane occupancy — no lane geometry or camera calibration was persisted",
        "",
    ])


def run(input_path: Path, output_dir: Path) -> dict:
    data = json.loads(input_path.read_text(encoding="utf-8"))
    windows = build_traffic_windows(data.get("observations", []))
    patterns = build_traffic_patterns(windows)
    class_counts = Counter()
    for window in windows:
        class_counts.update(window["vehicle_counts"])
    states = [window["congestion_state"] for window in windows]
    summary = {
        "source_artifact": str(input_path),
        "source_run_id": data.get("run_id"),
        "source_bus_id": data.get("bus_id"),
        "provenance": "existing real night-drive perception output; no new video/model/GPU inference",
        "windows_processed": len(windows),
        "vehicles_observed": sum(window["unique_vehicle_count"] for window in windows),
        "class_counts": dict(sorted(class_counts.items())),
        "peak_density": max((window["density_level"] for window in windows), key=("LOW", "MODERATE", "HIGH", "SEVERE").index, default="LOW"),
        "peak_congestion": "PERSISTENT_BOTTLENECK" if "PERSISTENT_BOTTLENECK" in states else ("CONGESTION" if "CONGESTION" in states else ("SLOW_FLOW" if "SLOW_FLOW" in states else "NORMAL_FLOW")),
        "persistent_bottlenecks": sum(1 for pattern in patterns if pattern["congestion_state"] == "PERSISTENT_BOTTLENECK"),
        "speed_estimation": "unavailable: no reliable metric speed in source artifact",
        "lane_occupancy": "unavailable: no lane geometry/camera calibration in source artifact",
    }
    write_json(output_dir / "traffic_observations.json", {"count": len(windows), "windows": windows})
    write_json(output_dir / "traffic_patterns.json", {"count": len(patterns), "patterns": patterns})
    write_json(output_dir / "traffic_summary.json", summary)
    write_json(output_dir / "metrics.json", {"source_observations": len(data.get("observations", [])), "eligible_vehicle_observations": summary["vehicles_observed"], "model_inference_rerun": False, "speed_estimation": summary["speed_estimation"], "lane_occupancy": summary["lane_occupancy"]})
    (output_dir / "traffic_report.txt").write_text(build_report(summary), encoding="utf-8")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Aggregate existing traffic observations without inference")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=Path("outputs/traffic_demo"))
    args = parser.parse_args()
    summary = run(args.input, args.output)
    print(f"Traffic windows: {summary['windows_processed']}")
    print(f"Vehicles observed: {summary['vehicles_observed']}")
    print(f"Output: {args.output}")


if __name__ == "__main__":
    main()
