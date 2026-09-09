"""
Metrics Reporter — The Sixth Sense
Records real performance metrics throughout a run.
All numbers are measured — none are fabricated or estimated.
"""
from __future__ import annotations
import json
import time
import logging
import platform
from pathlib import Path
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


class MetricsReporter:
    """
    Accumulates timing and count metrics throughout a pipeline run.
    Call finalize() at end to write the JSON report.
    """

    def __init__(self) -> None:
        self.run_start = time.time()
        self.model_load_times: Dict[str, float] = {}

        # Frame counters
        self.total_frames_in_video: int = 0
        self.frames_processed: int = 0
        self.frames_skipped_quality: int = 0

        # Inference timing (seconds per call)
        self._general_times: List[float] = []
        self._road_damage_times: List[float] = []

        # Detection/track counts
        self.total_vehicle_detections: int = 0
        self.total_road_damage_detections: int = 0
        self.total_tracks: int = 0
        self.total_observations: int = 0
        self.total_issues: int = 0

        # GPU memory snapshots (MB)
        self._gpu_samples: List[float] = []

        self.run_end: Optional[float] = None

    # ------------------------------------------------------------------ #
    # Recording
    # ------------------------------------------------------------------ #

    def record_model_load(self, name: str, elapsed_sec: float) -> None:
        self.model_load_times[name] = round(elapsed_sec, 3)

    def record_general_inference(self, elapsed_sec: float) -> None:
        self._general_times.append(elapsed_sec)

    def record_road_damage_inference(self, elapsed_sec: float) -> None:
        self._road_damage_times.append(elapsed_sec)

    def sample_gpu_memory(self) -> None:
        try:
            import torch
            if torch.cuda.is_available():
                mb = torch.cuda.memory_allocated(0) / 1024**2
                self._gpu_samples.append(round(mb, 1))
        except Exception:
            pass

    def add_vehicle_detections(self, n: int) -> None:
        self.total_vehicle_detections += n

    def add_road_damage_detections(self, n: int) -> None:
        self.total_road_damage_detections += n

    # ------------------------------------------------------------------ #
    # Finalization
    # ------------------------------------------------------------------ #

    def finalize(
        self,
        output_path: str,
        video_path: str,
        profile: str,
        run_id: str,
        model_names: List[str],
        device: str,
        target_fps: int,
        video_fps: float,
        video_resolution: str,
    ) -> Dict[str, Any]:
        self.run_end = time.time()
        wall_time = self.run_end - self.run_start

        def _stats(times: List[float]) -> Dict:
            if not times:
                return {"count": 0, "mean_ms": None, "min_ms": None, "max_ms": None}
            ms = [t * 1000 for t in times]
            return {
                "count": len(ms),
                "mean_ms": round(sum(ms) / len(ms), 2),
                "min_ms": round(min(ms), 2),
                "max_ms": round(max(ms), 2),
            }

        proc_fps = (
            self.frames_processed / wall_time if wall_time > 0 else 0.0
        )

        report: Dict[str, Any] = {
            "run_id": run_id,
            "run_start_unix": round(self.run_start, 3),
            "wall_time_sec": round(wall_time, 2),

            "input": {
                "video_path": video_path,
                "video_fps": round(video_fps, 2),
                "video_resolution": video_resolution,
                "total_frames_in_video": self.total_frames_in_video,
            },

            "configuration": {
                "profile": profile,
                "models": model_names,
                "device": device,
                "target_fps": target_fps,
            },

            "frame_processing": {
                "frames_processed": self.frames_processed,
                "frames_skipped_quality": self.frames_skipped_quality,
                "processing_fps": round(proc_fps, 2),
                "effective_input_fps": round(
                    self.frames_processed / (self.total_frames_in_video / video_fps)
                    if self.total_frames_in_video > 0 and video_fps > 0 else 0.0, 2
                ),
            },

            "model_load_times_sec": self.model_load_times,

            "inference": {
                "general_detector": _stats(self._general_times),
                "road_damage_detector": _stats(self._road_damage_times),
            },

            "detections": {
                "vehicle": self.total_vehicle_detections,
                "road_damage": self.total_road_damage_detections,
                "total": self.total_vehicle_detections + self.total_road_damage_detections,
            },

            "tracking": {
                "total_tracks": self.total_tracks,
            },

            "observations": self.total_observations,
            "persistent_issues": self.total_issues,

            "gpu_memory_mb": {
                "samples": len(self._gpu_samples),
                "peak_mb": round(max(self._gpu_samples), 1) if self._gpu_samples else None,
                "mean_mb": round(sum(self._gpu_samples) / len(self._gpu_samples), 1) if self._gpu_samples else None,
            },

            "system": {
                "platform": platform.platform(),
                "python": platform.python_version(),
            },
        }

        # Write to disk
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w") as f:
            json.dump(report, f, indent=2)
        logger.info("Metrics report written: %s", output_path)

        # Print summary to terminal
        self._print_summary(report)
        return report

    @staticmethod
    def _print_summary(r: Dict) -> None:
        fp = r["frame_processing"]
        inf = r["inference"]
        det = r["detections"]
        gd = inf["general_detector"]
        rd = inf["road_damage_detector"]
        print("\n" + "═" * 62)
        print("  THE SIXTH SENSE — PERFORMANCE REPORT")
        print("═" * 62)
        print(f"  Run ID        : {r['run_id']}")
        print(f"  Wall time     : {r['wall_time_sec']:.1f}s")
        print(f"  Device        : {r['configuration']['device']}")
        print(f"  Profile       : {r['configuration']['profile']}")
        print(f"  Input         : {r['input']['video_resolution']} @ {r['input']['video_fps']:.0f}fps")
        print(f"  Frames in     : {r['input']['total_frames_in_video']}")
        print(f"  Frames proc.  : {fp['frames_processed']}  (skipped quality: {fp['frames_skipped_quality']})")
        print(f"  Processing    : {fp['processing_fps']:.1f} fps")
        print(f"  YOLO general  : {gd['mean_ms']}ms avg" if gd["mean_ms"] else "  YOLO general  : N/A")
        print(f"  Road damage   : {rd['mean_ms']}ms avg" if rd["mean_ms"] else "  Road damage   : N/A")
        print(f"  Detections    : vehicles={det['vehicle']}  road_damage={det['road_damage']}")
        print(f"  Tracks        : {r['tracking']['total_tracks']}")
        print(f"  Observations  : {r['observations']}")
        print(f"  Issues        : {r['persistent_issues']}")
        gpu = r["gpu_memory_mb"]
        if gpu["peak_mb"]:
            print(f"  GPU mem peak  : {gpu['peak_mb']} MB")
        print("═" * 62 + "\n")
