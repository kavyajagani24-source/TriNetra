"""
GPS Associator — The Sixth Sense
Synchronises video timestamps with GPS telemetry.
GPS status is always explicitly set: DIRECT / INTERPOLATED / UNAVAILABLE.
Coordinates are NEVER fabricated.
"""
from __future__ import annotations
import csv
import json
import logging
import math
from pathlib import Path
from typing import List, Optional, Dict, Any

from sixth_sense.schemas.urban_event import GPSPoint, GPSStatus

logger = logging.getLogger(__name__)


class GPSAssociator:
    """
    Associates a video frame timestamp with GPS coordinates.

    Supported input formats:
      - CSV with columns: timestamp, lat, lon [, heading]
      - JSON: list of {"timestamp":…, "lat":…, "lon":…[, "heading":…]}
      - None / empty: all GPS will be UNAVAILABLE

    All coordinates are returned with uncertainty and explicit status.
    """

    def __init__(
        self,
        gps_source: Optional[str],
        video_start_unix: float = 0.0,
        max_interpolation_gap_sec: float = 10.0,
        base_uncertainty_m: float = 8.0,
        speed_uncertainty_factor: float = 0.5,
    ) -> None:
        """
        Args:
            gps_source: path to CSV/JSON file, or None
            video_start_unix: Unix timestamp of video frame 0 (for alignment)
            max_interpolation_gap_sec: GPS gaps larger than this → UNAVAILABLE
            base_uncertainty_m: Typical GPS fix uncertainty (m)
            speed_uncertainty_factor: Extra uncertainty per m/s of travel speed
        """
        self.video_start_unix = video_start_unix
        self.max_gap = max_interpolation_gap_sec
        self.base_uncertainty = base_uncertainty_m
        self.speed_factor = speed_uncertainty_factor

        self._samples: List[Dict[str, Any]] = []  # sorted by timestamp

        if gps_source:
            self._load(gps_source)

        if not self._samples:
            logger.warning(
                "GPS source empty or unavailable. All GPS will be UNAVAILABLE."
            )

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def get_location(self, video_timestamp_sec: float) -> Optional[GPSPoint]:
        """
        Return GPS location for a given video timestamp.

        Args:
            video_timestamp_sec: seconds from video start (frame_idx / fps)

        Returns:
            GPSPoint with status DIRECT / INTERPOLATED / UNAVAILABLE.
            Returns None only on internal error — always returns UNAVAILABLE
            GPSPoint when GPS data is absent.
        """
        if not self._samples:
            return GPSPoint(
                lat=0.0, lon=0.0,
                timestamp=0.0, uncertainty_m=9999.0,
                heading=None, status=GPSStatus.UNAVAILABLE,
            )

        target_unix = self.video_start_unix + video_timestamp_sec

        # Binary search: find bracketing samples
        lo, hi = 0, len(self._samples) - 1
        while lo < hi:
            mid = (lo + hi) // 2
            if self._samples[mid]["timestamp"] < target_unix:
                lo = mid + 1
            else:
                hi = mid

        # lo is the first sample with timestamp >= target
        if lo == 0:
            s = self._samples[0]
            gap = abs(s["timestamp"] - target_unix)
            return self._make_point(s, gap, target_unix, direct=gap < 1.0)

        s_prev = self._samples[lo - 1]
        s_next = self._samples[lo]
        gap = s_next["timestamp"] - s_prev["timestamp"]

        if gap > self.max_gap:
            return GPSPoint(
                lat=0.0, lon=0.0,
                timestamp=target_unix, uncertainty_m=9999.0,
                heading=None, status=GPSStatus.UNAVAILABLE,
            )

        # Direct match within 1 second
        if abs(s_prev["timestamp"] - target_unix) < 1.0:
            return self._make_point(s_prev, gap, target_unix, direct=True)
        if abs(s_next["timestamp"] - target_unix) < 1.0:
            return self._make_point(s_next, gap, target_unix, direct=True)

        # Linear interpolation
        t_range = s_next["timestamp"] - s_prev["timestamp"]
        alpha = (target_unix - s_prev["timestamp"]) / t_range if t_range > 0 else 0.0
        lat = s_prev["lat"] + alpha * (s_next["lat"] - s_prev["lat"])
        lon = s_prev["lon"] + alpha * (s_next["lon"] - s_prev["lon"])

        # Estimate speed from GPS distance/time for uncertainty
        dist_m = _haversine_m(s_prev["lat"], s_prev["lon"], s_next["lat"], s_next["lon"])
        speed_mps = dist_m / t_range if t_range > 0 else 0.0
        uncertainty = self.base_uncertainty + speed_mps * self.speed_factor

        heading = s_prev.get("heading") or s_next.get("heading")

        return GPSPoint(
            lat=round(lat, 7),
            lon=round(lon, 7),
            timestamp=round(target_unix, 3),
            uncertainty_m=round(uncertainty, 2),
            heading=heading,
            status=GPSStatus.INTERPOLATED,
        )

    # ------------------------------------------------------------------ #
    # Loading
    # ------------------------------------------------------------------ #

    def _load(self, path_str: str) -> None:
        path = Path(path_str)
        if not path.exists():
            logger.warning("GPS file not found: %s — GPS will be UNAVAILABLE.", path_str)
            return

        suffix = path.suffix.lower()
        try:
            if suffix == ".csv":
                self._load_csv(path)
            elif suffix == ".json":
                self._load_json(path)
            else:
                logger.warning("Unknown GPS file format: %s — expected .csv or .json", suffix)
                return
        except Exception as exc:
            logger.error("GPS load error for %s: %s", path_str, exc)
            return

        self._samples.sort(key=lambda s: s["timestamp"])
        logger.info("GPS loaded: %d samples from %s", len(self._samples), path_str)

    def _load_csv(self, path: Path) -> None:
        with open(path, newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    sample = {
                        "timestamp": float(row["timestamp"]),
                        "lat": float(row["lat"]),
                        "lon": float(row["lon"]),
                        "heading": float(row["heading"]) if "heading" in row and row["heading"] else None,
                    }
                    self._samples.append(sample)
                except (KeyError, ValueError) as e:
                    logger.debug("Skipping malformed GPS row: %s — %s", row, e)

    def _load_json(self, path: Path) -> None:
        with open(path) as f:
            data = json.load(f)
        if not isinstance(data, list):
            logger.warning("GPS JSON must be a list of objects.")
            return
        for item in data:
            try:
                sample = {
                    "timestamp": float(item["timestamp"]),
                    "lat": float(item["lat"]),
                    "lon": float(item["lon"]),
                    "heading": item.get("heading"),
                }
                self._samples.append(sample)
            except (KeyError, ValueError) as e:
                logger.debug("Skipping malformed GPS entry: %s — %s", item, e)

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #

    def _make_point(
        self, sample: Dict, gap: float, target_unix: float, direct: bool
    ) -> GPSPoint:
        return GPSPoint(
            lat=round(sample["lat"], 7),
            lon=round(sample["lon"], 7),
            timestamp=round(target_unix, 3),
            uncertainty_m=round(self.base_uncertainty, 2),
            heading=sample.get("heading"),
            status=GPSStatus.DIRECT if direct else GPSStatus.INTERPOLATED,
        )


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in metres between two WGS84 points."""
    R = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))
