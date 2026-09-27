"""
Hit-and-Run Candidate Temporal State Machine.
SIH 2026 | PS 26125 — Person 4 Incident AI

Explicit State Machine:
1. MONITORING: Tracking regular traffic flow.
2. COLLISION_CANDIDATE: Peak impact or spatio-temporal collision candidate identified.
3. INVOLVED_VEHICLE_IDENTIFIED: Isolates vehicles within impact radius at collision timestamp.
4. VEHICLE_DEPARTS: Detects one vehicle moving away post-collision.
5. TRACK_DISAPPEARS: Offending vehicle exits camera FOV without returning.
6. HIT_AND_RUN_CANDIDATE: Emits audit packet tagged as CANDIDATE requiring human review.
7. BOTH_VEHICLES_DEPARTED: Both vehicles continued driving (not hit-and-run).
8. INSUFFICIENT_TRACK_EVIDENCE: Single vehicle, occlusion, or missing track continuity.

Zero legal determination: Outputs CANDIDATE or REVIEW_REQUIRED states only.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple
import numpy as np


class IncidentState(str, Enum):
    MONITORING = "MONITORING"
    COLLISION_CANDIDATE = "COLLISION_CANDIDATE"
    INVOLVED_VEHICLE_IDENTIFIED = "INVOLVED_VEHICLE_IDENTIFIED"
    VEHICLE_DEPARTS = "VEHICLE_DEPARTS"
    TRACK_DISAPPEARS = "TRACK_DISAPPEARS"
    HIT_AND_RUN_CANDIDATE = "HIT_AND_RUN_CANDIDATE"
    BOTH_VEHICLES_DEPARTED = "BOTH_VEHICLES_DEPARTED"
    INSUFFICIENT_TRACK_EVIDENCE = "INSUFFICIENT_TRACK_EVIDENCE"


@dataclass
class TrackObservation:
    frame_idx: int
    timestamp: float
    bbox: Tuple[float, float, float, float]
    centroid: Tuple[float, float]
    speed: float = 0.0


@dataclass
class HitAndRunResult:
    state: IncidentState
    is_hit_and_run_candidate: bool
    status_label: str  # HIT_AND_RUN_CANDIDATE, VEHICLE_DEPARTURE_AFTER_COLLISION, COLLISION_WITHOUT_DEPARTURE, BOTH_VEHICLES_DEPARTED, INSUFFICIENT_TRACK_EVIDENCE, NO_INCIDENT
    offending_track_id: Optional[int] = None
    victim_track_id: Optional[int] = None
    collision_timestamp: Optional[float] = None
    departure_timestamp: Optional[float] = None
    departure_speed_px_s: Optional[float] = None
    departure_heading: Optional[str] = None
    confidence: float = 0.0
    reason: str = ""


class HitAndRunStateMachine:
    """
    Temporal State Machine tracking potential hit-and-run incidents.
    """

    def __init__(
        self,
        impact_proximity_px: float = 120.0,
        departure_speed_threshold_px_s: float = 80.0,
        post_collision_window_sec: float = 4.0,
        min_stopped_duration_sec: float = 1.5,
    ):
        self.impact_proximity_px = impact_proximity_px
        self.departure_speed_threshold_px_s = departure_speed_threshold_px_s
        self.post_collision_window_sec = post_collision_window_sec
        self.min_stopped_duration_sec = min_stopped_duration_sec

    def evaluate(
        self,
        collision_detected: bool,
        collision_time: float,
        tracks: Dict[int, List[TrackObservation]],
        frame_width: int = 1280,
        frame_height: int = 720,
        involved_track_ids: Optional[List[int]] = None,
    ) -> HitAndRunResult:
        """
        Evaluate full track history against collision event.
        """
        if not collision_detected or not tracks:
            return HitAndRunResult(
                state=IncidentState.MONITORING,
                is_hit_and_run_candidate=False,
                status_label="NO_INCIDENT",
                confidence=0.95,
                reason="No collision detected in sequence.",
            )

        # 1. Identify vehicles present around collision_time
        involved_tracks = {}
        candidate_tids = [tid for tid in (involved_track_ids or []) if tid in tracks]
        if len(candidate_tids) < 2:
            for tid, obs_list in tracks.items():
                pts_near = [obs for obs in obs_list if abs(obs.timestamp - collision_time) <= 1.0]
                if pts_near:
                    involved_tracks[tid] = pts_near[0]
        else:
            for tid in candidate_tids:
                pts_near = [obs for obs in tracks[tid] if abs(obs.timestamp - collision_time) <= 1.2]
                if pts_near:
                    involved_tracks[tid] = pts_near[0]
                elif tracks[tid]:
                    involved_tracks[tid] = min(tracks[tid], key=lambda o: abs(o.timestamp - collision_time))

        if len(involved_tracks) < 2:
            return HitAndRunResult(
                state=IncidentState.INSUFFICIENT_TRACK_EVIDENCE,
                is_hit_and_run_candidate=False,
                status_label="INSUFFICIENT_TRACK_EVIDENCE",
                collision_timestamp=collision_time,
                confidence=0.60,
                reason="Collision detected but fewer than 2 tracked vehicles isolated near impact.",
            )

        # If explicit collision involved tracks provided, use them
        if len(candidate_tids) >= 2:
            impact_pair = (candidate_tids[0], candidate_tids[1])
        else:
            # Find closest pair of vehicles at impact
            tids = list(involved_tracks.keys())
            min_dist = float("inf")
            impact_pair = None

            for i in range(len(tids)):
                for j in range(i + 1, len(tids)):
                    t1, t2 = tids[i], tids[j]
                    c1 = involved_tracks[t1].centroid
                    c2 = involved_tracks[t2].centroid
                    dist = np.hypot(c1[0] - c2[0], c1[1] - c2[1])
                    if dist < min_dist:
                        min_dist = dist
                        impact_pair = (t1, t2)

            if not impact_pair or min_dist > self.impact_proximity_px * 2.5:
                return HitAndRunResult(
                    state=IncidentState.INSUFFICIENT_TRACK_EVIDENCE,
                    is_hit_and_run_candidate=False,
                    status_label="INSUFFICIENT_TRACK_EVIDENCE",
                    collision_timestamp=collision_time,
                    confidence=0.55,
                    reason="Collision detected, but tracks did not enter spatial proximity threshold.",
                )

        veh_a, veh_b = impact_pair
        diag = float(np.hypot(frame_width, frame_height))
        min_dist_thresh = max(35.0, 0.07 * diag)
        min_spd_thresh = max(35.0, self.departure_speed_threshold_px_s * (diag / 1400.0))

        # 2. Analyze post-collision kinematics for both vehicles
        def analyze_post_collision(tid: int):
            post_obs = [obs for obs in tracks[tid] if obs.timestamp > collision_time]
            c_impact = involved_tracks[tid].centroid
            if not post_obs:
                return {
                    "departed": False,
                    "disappeared": False,
                    "avg_speed": 0.0,
                    "moved_dist": 0.0,
                    "last_pos": c_impact,
                    "t_last": collision_time,
                }

            t_last = post_obs[-1].timestamp
            last_cx, last_cy = post_obs[-1].centroid
            bx = post_obs[-1].bbox

            m_x = max(30.0, 0.12 * frame_width)
            m_y = max(30.0, 0.12 * frame_height)
            edge_x = max(30.0, 0.15 * frame_width)
            near_edge = (
                last_cx < m_x
                or last_cx > (frame_width - m_x)
                or last_cy < m_y
                or last_cy > (frame_height - m_y)
                or bx[0] <= (0.08 * frame_width)
                or bx[2] >= (frame_width - edge_x)
                or bx[1] <= (0.08 * frame_height)
                or bx[3] >= (frame_height - (0.12 * frame_height))
            )

            speeds = [o.speed for o in post_obs if o.speed > 0]
            avg_post_speed = float(np.mean(speeds)) if speeds else 0.0
            moved_dist = float(np.hypot(last_cx - c_impact[0], last_cy - c_impact[1]))

            departed = (avg_post_speed >= min_spd_thresh and moved_dist >= min_dist_thresh) or (near_edge and moved_dist >= min_dist_thresh)
            return {
                "departed": departed,
                "disappeared": near_edge,
                "avg_speed": avg_post_speed,
                "moved_dist": moved_dist,
                "last_pos": (last_cx, last_cy),
                "t_last": t_last,
            }

        # Multi-track collision group analysis
        if len(candidate_tids) > 2:
            analyses = {tid: analyze_post_collision(tid) for tid in candidate_tids}
            dep_candidates = [(tid, info) for tid, info in analyses.items() if info["departed"]]
            stat_candidates = [tid for tid, info in analyses.items() if not info["departed"]]
            if dep_candidates and stat_candidates:
                # Offender is the departing vehicle with highest moved distance
                dep_candidates.sort(key=lambda x: x[1]["moved_dist"], reverse=True)
                offender, dep_info = dep_candidates[0]
                victim = stat_candidates[0]
            elif dep_candidates and not stat_candidates:
                return HitAndRunResult(
                    state=IncidentState.BOTH_VEHICLES_DEPARTED,
                    is_hit_and_run_candidate=False,
                    status_label="BOTH_VEHICLES_DEPARTED",
                    collision_timestamp=collision_time,
                    confidence=0.50,
                    reason="All involved vehicles continued moving after impact; no stationary victim remaining at scene.",
                )
            else:
                offender = None
                victim = None
                dep_info = None
        else:
            k_a = analyze_post_collision(veh_a)
            k_b = analyze_post_collision(veh_b)

            # Case 1: Exactly one vehicle departed
            if k_a["departed"] and not k_b["departed"]:
                offender = veh_a
                victim = veh_b
                dep_info = k_a
            elif k_b["departed"] and not k_a["departed"]:
                offender = veh_b
                victim = veh_a
                dep_info = k_b
            # Case 2: Both departed
            elif k_a["departed"] and k_b["departed"]:
                return HitAndRunResult(
                    state=IncidentState.BOTH_VEHICLES_DEPARTED,
                    is_hit_and_run_candidate=False,
                    status_label="BOTH_VEHICLES_DEPARTED",
                    collision_timestamp=collision_time,
                    confidence=0.50,
                    reason="Both vehicles continued moving after impact; no stationary victim remaining at scene.",
                )
            # Case 3: Neither departed directly
            else:
                offender = None
                victim = None
                dep_info = None

        # Post-impact track association (handles tracker ID switches/fragmentation at impact)
        p1 = involved_tracks[veh_a].centroid if veh_a in involved_tracks else (frame_width / 2, frame_height / 2)
        p2 = involved_tracks[veh_b].centroid if veh_b in involved_tracks else (frame_width / 2, frame_height / 2)
        impact_locus = ((p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0)

        if offender is None or dep_info is None:
            k_a = analyze_post_collision(veh_a)
            k_b = analyze_post_collision(veh_b)
            stationary_primary = veh_a if k_a["moved_dist"] <= k_b["moved_dist"] else veh_b

            # Search for any track emerging near impact locus post-collision that departs
            fleeing_candidates = []
            for tid, obs_list in tracks.items():
                if tid in (veh_a, veh_b):
                    continue
                obs_post = [o for o in obs_list if o.timestamp >= (collision_time - 0.2)]
                if len(obs_post) < 2:
                    continue
                first_pt = obs_post[0].centroid
                d_to_locus = np.hypot(first_pt[0] - impact_locus[0], first_pt[1] - impact_locus[1])
                # Track emerged near impact site
                if d_to_locus <= max(140.0, 0.22 * diag):
                    last_pt = obs_post[-1].centroid
                    bx = obs_post[-1].bbox
                    m_x = max(30.0, 0.12 * frame_width)
                    m_y = max(30.0, 0.12 * frame_height)
                    edge_x = max(30.0, 0.15 * frame_width)
                    near_edge = (
                        last_pt[0] < m_x
                        or last_pt[0] > (frame_width - m_x)
                        or last_pt[1] < m_y
                        or last_pt[1] > (frame_height - m_y)
                        or bx[0] <= (0.08 * frame_width)
                        or bx[2] >= (frame_width - edge_x)
                        or bx[1] <= (0.08 * frame_height)
                        or bx[3] >= (frame_height - (0.12 * frame_height))
                    )
                    speeds = [o.speed for o in obs_post if o.speed > 0]
                    avg_spd = float(np.mean(speeds)) if speeds else 0.0
                    moved_dist = float(np.hypot(last_pt[0] - first_pt[0], last_pt[1] - first_pt[1]))
                    if (avg_spd >= min_spd_thresh * 0.7 and moved_dist >= min_dist_thresh * 0.6) or (near_edge and moved_dist >= 25.0):
                        fleeing_candidates.append((tid, {
                            "departed": True,
                            "disappeared": near_edge,
                            "avg_speed": avg_spd,
                            "moved_dist": moved_dist,
                            "last_pos": (last_pt[0], last_pt[1]),
                            "t_last": obs_post[-1].timestamp,
                            "is_post_association": True,
                            "locus": first_pt,
                        }))

            if fleeing_candidates:
                fleeing_candidates.sort(key=lambda x: x[1]["moved_dist"], reverse=True)
                offender, dep_info = fleeing_candidates[0]
                victim = stationary_primary
            else:
                return HitAndRunResult(
                    state=IncidentState.INVOLVED_VEHICLE_IDENTIFIED,
                    is_hit_and_run_candidate=False,
                    status_label="COLLISION_WITHOUT_DEPARTURE",
                    collision_timestamp=collision_time,
                    victim_track_id=candidate_tids[0] if candidate_tids else veh_a,
                    confidence=0.88,
                    reason="Vehicles remained at scene post-impact; driver/vehicle did not flee (NO HIT-AND-RUN).",
                )

        # Determine departure heading
        c_imp = involved_tracks[offender].centroid if (offender in involved_tracks) else dep_info.get("locus", impact_locus)
        dx = dep_info["last_pos"][0] - c_imp[0]
        dy = dep_info["last_pos"][1] - c_imp[1]
        heading_str = "EAST" if dx > 0 else "WEST"
        if abs(dy) > abs(dx):
            heading_str = "SOUTH" if dy > 0 else "NORTH"

        # Distinguish confirmed scene exit from internal departure movement
        if dep_info["disappeared"] or dep_info.get("is_post_association"):
            return HitAndRunResult(
                state=IncidentState.HIT_AND_RUN_CANDIDATE,
                is_hit_and_run_candidate=True,
                status_label="HIT_AND_RUN_CANDIDATE",
                offending_track_id=offender,
                victim_track_id=victim,
                collision_timestamp=collision_time,
                departure_timestamp=dep_info["t_last"],
                departure_speed_px_s=round(dep_info["avg_speed"], 2),
                departure_heading=heading_str,
                confidence=0.88 if dep_info["disappeared"] else 0.82,
                reason=f"Vehicle track #{offender} fled the scene at {dep_info['avg_speed']:.1f} px/s heading {heading_str} while vehicle #{victim} remained stationary.",
            )
        else:
            return HitAndRunResult(
                state=IncidentState.VEHICLE_DEPARTS,
                is_hit_and_run_candidate=False,
                status_label="VEHICLE_DEPARTURE_AFTER_COLLISION",
                offending_track_id=offender,
                victim_track_id=victim,
                collision_timestamp=collision_time,
                departure_timestamp=dep_info["t_last"],
                departure_speed_px_s=round(dep_info["avg_speed"], 2),
                departure_heading=heading_str,
                confidence=0.65,
                reason=f"Vehicle track #{offender} moved away post-impact ({dep_info['avg_speed']:.1f} px/s) but remained within camera view (not confirmed fleeing; NO HIT-AND-RUN).",
            )
