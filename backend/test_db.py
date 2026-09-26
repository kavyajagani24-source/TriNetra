import sqlite3
import json

conn = sqlite3.connect("backend/urbaneye.db")
cur = conn.cursor()
cur.execute("SELECT id, track_id, event_type, risk_level, risk_score, start_frame, end_frame, frame_index, in_school_zone, in_crossing_zone, road_entry FROM safety_events WHERE run_id = 'e5f00f9e44dd42489dfd92e6a5659e13'")
events = cur.fetchall()

groups = {}
for e in events:
    tid = e[1]
    if tid not in groups:
        groups[tid] = []
    groups[tid].append(e)

print(f"Total raw events: {len(events)}, Total grouped tracks/incidents: {len(groups)}")
for tid, evs in sorted(groups.items(), key=lambda x: (x[0] is None, x[0])):
    max_score = max(x[4] for x in evs)
    has_high = any(x[3] == 'high' for x in evs)
    level = 'high' if has_high else 'medium'
    types = set(x[2] for x in evs)
    min_f = min(x[5] for x in evs)
    max_f = max(x[6] if x[6] > 0 else x[7] for x in evs)
    print(f"Track #{tid}: {len(evs)} detections | Level: {level.upper()} (peak: {max_score:.2f}) | Types: {types} | Frames: {min_f} -> {max_f}")
