"""Transparent traffic aggregation over persisted vehicle observations.

The Phase A tracker was not persisted as JSON.  Each confirmed, temporally
grouped vehicle observation is therefore used as an *observation-level track
proxy*.  Its ``obs_id`` is stable and is counted once per time window.  This
module never estimates km/h, physical density, or lane occupancy.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, Iterable, List


SUPPORTED_VEHICLE_CLASSES = ("car", "bus", "truck", "motorcycle", "bicycle")
WINDOW_SECONDS = 60.0


def density_level(unique_count: int) -> str:
    """Relative density from unique observation-level vehicle proxies/60 sec."""
    if unique_count <= 3:
        return "LOW"
    if unique_count <= 7:
        return "MODERATE"
    if unique_count <= 12:
        return "HIGH"
    return "SEVERE"


def congestion_for_density(level: str) -> str:
    return {
        "LOW": "NORMAL_FLOW",
        "MODERATE": "SLOW_FLOW",
        "HIGH": "CONGESTION",
        "SEVERE": "CONGESTION",
    }[level]


def _eligible(observation: Dict[str, Any]) -> bool:
    return observation.get("event_type") == "VEHICLE" and observation.get("class_name") in SUPPORTED_VEHICLE_CLASSES


def build_traffic_windows(
    observations: Iterable[Dict[str, Any]], window_seconds: float = WINDOW_SECONDS
) -> List[Dict[str, Any]]:
    """Aggregate confirmed vehicle observations into source-bus time windows.

    A duplicate observation ID is only admitted once to a window, preventing
    accidental double counting if an artifact is concatenated or replayed.
    """
    if window_seconds <= 0:
        raise ValueError("window_seconds must be positive")

    buckets: Dict[tuple, Dict[str, Any]] = {}
    for observation in observations:
        if not _eligible(observation):
            continue
        timestamp = float(observation.get("first_seen_ts", 0.0))
        start = int(timestamp // window_seconds) * window_seconds
        bus_id = observation.get("bus_id") or "BUS_UNKNOWN"
        key = (bus_id, start)
        bucket = buckets.setdefault(key, {"records": {}, "bus_id": bus_id, "start": start})
        proxy_id = observation.get("obs_id")
        if not proxy_id:
            continue
        bucket["records"].setdefault(proxy_id, observation)

    windows: List[Dict[str, Any]] = []
    for index, (_, bucket) in enumerate(sorted(buckets.items(), key=lambda item: (item[0][0], item[0][1])), start=1):
        records = list(bucket["records"].values())
        class_counts = {name: 0 for name in SUPPORTED_VEHICLE_CLASSES}
        for record in records:
            class_counts[record["class_name"]] += 1
        class_counts = {name: count for name, count in class_counts.items() if count}
        count = len(records)
        density = density_level(count)
        windows.append({
            "traffic_window_id": f"traffic_window_{index:03d}",
            "start_time": bucket["start"],
            "end_time": bucket["start"] + window_seconds,
            "source_bus_id": bucket["bus_id"],
            "road_segment_id": None,
            "vehicle_counts": class_counts,
            "unique_track_counts": class_counts.copy(),
            "unique_vehicle_count": count,
            "supporting_observation_ids": sorted(bucket["records"]),
            "density_level": density,
            "density_method": "relative unique observation-level vehicle proxies per 60-second window; no calibrated road geometry",
            "density_evidence_basis": f"{count} unique confirmed vehicle observations; obs_id deduplicated within window",
            "congestion_state": congestion_for_density(density),
            "speed_estimation_unavailable": "No reliable metric speed exists in cached artifacts; image-space trajectories are not km/h.",
            "lane_occupancy_unavailable": "No lane geometry or camera calibration exists in cached artifacts.",
            "provenance": {
                "source": "existing persisted perception observations",
                "track_basis": "observation-level track proxy (raw tracker IDs were not persisted)",
                "model_inference_rerun": False,
            },
        })
    return windows


def build_traffic_patterns(windows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Create per-bus traffic patterns and require repeated congestion for bottlenecks."""
    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for window in windows:
        grouped[window["source_bus_id"]].append(window)

    patterns: List[Dict[str, Any]] = []
    for bus_id, bus_windows in sorted(grouped.items()):
        bus_windows.sort(key=lambda item: item["start_time"])
        congestion_windows = [w for w in bus_windows if w["congestion_state"] == "CONGESTION"]
        consecutive: List[List[Dict[str, Any]]] = []
        active: List[Dict[str, Any]] = []
        for window in congestion_windows:
            if active and window["start_time"] != active[-1]["end_time"]:
                consecutive.append(active)
                active = []
            active.append(window)
        if active:
            consecutive.append(active)

        bottleneck_ids = set()
        for run in consecutive:
            if len(run) >= 2:
                bottleneck_ids.update(w["traffic_window_id"] for w in run)
        for window in bus_windows:
            if window["traffic_window_id"] in bottleneck_ids:
                window["congestion_state"] = "PERSISTENT_BOTTLENECK"

        patterns.append({
            "pattern_id": f"traffic_pattern_{bus_id.lower()}",
            "road_segment_id": None,
            "first_seen": bus_windows[0]["start_time"],
            "last_seen": bus_windows[-1]["end_time"],
            "observation_count": len(bus_windows),
            "supporting_windows": [w["traffic_window_id"] for w in bus_windows],
            "bus_ids": [bus_id],
            "congestion_state": "PERSISTENT_BOTTLENECK" if bottleneck_ids else max(
                (w["congestion_state"] for w in bus_windows),
                key=("NORMAL_FLOW", "SLOW_FLOW", "CONGESTION").index,
            ),
            "density_state": max(
                (w["density_level"] for w in bus_windows),
                key=("LOW", "MODERATE", "HIGH", "SEVERE").index,
            ),
            "confidence_evidence_basis": "Repeated-window state only; no metric speed, lane geometry, or road-segment calibration.",
            "provenance": bus_windows[0]["provenance"],
        })
    return patterns
