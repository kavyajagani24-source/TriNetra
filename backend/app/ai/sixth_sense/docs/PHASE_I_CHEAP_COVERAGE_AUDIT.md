# Phase I — Cheap PS Coverage Hardening Audit

Audit date: 2026-09-08. Scope: read-only assessment of existing A–H artifacts. No model was loaded for inference, no GPU work ran, no data was downloaded, and no A–H pipeline was changed.

## 1. Current coverage summary

The project has two genuinely demonstrable stories:

- **Road-maintenance City Memory:** real Indian-road D00 longitudinal-crack detections → GPS-tagged observations → four corroborated road-crack issues → explainable work items → qualified, explicitly simulated closure/reopen scenarios.
- **Traffic intelligence from cached perception:** `outputs/traffic_demo/` reused 46 vehicle observations from the existing night-drive run without inference. It produced two 60-second windows: 42 unique observation-level vehicle proxies (26 cars, 16 trucks; relative `SEVERE` / `CONGESTION`) and 4 cars (relative `MODERATE` / `SLOW_FLOW`). The result correctly reports zero persistent bottlenecks.

Important evidence limits:

- The raw tracker IDs were not persisted. Phase H therefore uses deduplicated, confirmed `obs_id` records as **observation-level track proxies**, not a claim of exact raw-track replay.
- No metric speed, lane geometry, road-segment IDs, route schedule, or calibrated physical road geometry exists. No km/h, vehicles/km, lane occupancy, or route-delay metric is supportable.
- The RDD2022 checkpoint lists D00/D10/D20/D40/Repair, but cached real road-damage output contains D00 only. There is no D40/pothole evidence or local labeled dataset.
- Repair claims, clear pass timing, and reopened post-repair evidence in the SIH demo are explicitly simulated/reused; the artifacts say so.

Classification totals across the 42 Phase G requirements: **DEMONSTRATED 16; PARTIALLY DEMONSTRATED 13; CHEAPLY DERIVABLE WITHOUT NEW ML 1; REQUIRES NEW DATA 4; REQUIRES NEW ML 7; NOT WORTH IMPLEMENTING FOR SIH MVP 1.**

## 2. Requirement-by-requirement matrix

Effort: XS (artifact/query/config only), S (small non-ML addition), M (meaningful integration), L (substantial). GPU refers to a credible implementation or demonstration, not merely reading current JSON.

| # | Requirement | Classification | Current evidence/artifact | What is missing | Effort | GPU | SIH demo value |
|---:|---|---|---|---|---|---|---|
| 1 | Existing bus camera integration | PARTIALLY DEMONSTRATED | `run_urban_ai.py` accepts video with bus/camera IDs; cached bus-video artifacts exist. | Live bus DVR/VMS connector and device health. | M | No | Medium |
| 2 | GPS / VLT integration | PARTIALLY DEMONSTRATED | GPS CSV alignment, DIRECT/INTERPOLATED uncertainty in observation and GeoJSON artifacts. | Real VLT protocol/device integration and clock health. | M | No | High |
| 3 | Road defects | DEMONSTRATED | RDD2022 D00 observations and road issues in `outputs/sih_demo/`. | Wider geography/class validation. | — | No | High |
| 4 | Potholes | REQUIRES NEW DATA | Checkpoint contains D40 mapping. | A pothole-containing, reviewable video or labeled D40 data; current artifacts have none. | M | Likely | High |
| 5 | Cracks | DEMONSTRATED | Real D00 longitudinal-crack detections, GPS, corroboration and work items. | Broader D10/D20 validation. | — | No | High |
| 6 | Dividers / medians | REQUIRES NEW ML | Schema/routing label only. | Detector and labeled validation data. | L | Yes | Medium |
| 7 | Zebra crossings | REQUIRES NEW ML | Schema/routing label only. | Detector/condition model and data. | L | Yes | Medium |
| 8 | Traffic signs | PARTIALLY DEMONSTRATED | Existing night-drive observations include `traffic light`; COCO maps lights/stop signs to `TRAFFIC_SIGN`. | Sign taxonomy, condition/inventory logic, validation. | M | Likely | Medium |
| 9 | Waterlogging | REQUIRES NEW ML | Enum and configurable routing only. | Detection model and waterlogging examples. | L | Yes | High |
| 10 | Garbage / debris / obstructions | REQUIRES NEW ML | Enum and sanitation routing only. | Detection model, scope rules, labels. | L | Yes | Medium |
| 11 | Vehicle detection | DEMONSTRATED | Cached night-drive run: 789 detections reported; 46 eligible vehicle observations reused in H. | Target-domain accuracy evaluation. | — | No | High |
| 12 | Vehicle classification | DEMONSTRATED | Cached class counts: 30 cars, 16 trucks; supported COCO classes preserved. | India-specific class evaluation; no auto-rickshaw claim. | — | No | High |
| 13 | Vehicle counting | DEMONSTRATED | Phase H deduplicates `obs_id` vehicle proxies per window. | Persist raw track IDs/count lines for production counting. | — | No | High |
| 14 | Traffic density | DEMONSTRATED | Phase H relative-density windows with transparent no-geometry method. | Calibrated physical density only if geometry is supplied. | — | No | High |
| 15 | Lane occupancy | REQUIRES NEW DATA | Explicitly unavailable in H output. | Lane geometry/camera calibration; then validation. | M | No | Medium |
| 16 | Congestion | DEMONSTRATED | Phase H deterministic relative state: `CONGESTION` and `SLOW_FLOW` from current windows. | Speed/segment-based congestion calibration. | — | No | High |
| 17 | Bottleneck detection | PARTIALLY DEMONSTRATED | Phase H preserves supporting windows and correctly yields zero bottlenecks for a single congestion window; tests cover repeated condition. | Repeated, segment-aligned real congestion windows. | S | No | High |
| 18 | Route delay intelligence | REQUIRES NEW DATA | Timestamps/GPS exist. | Route schedule/GTFS or planned-vs-actual baseline and reliable VLT timestamps. | M | No | High |
| 19 | Vulnerable road users / pedestrians | PARTIALLY DEMONSTRATED | Real person observations; multi-bus pedestrian issues and Traffic/Pedestrian Safety work items. | Safety risk/near-miss logic; do not equate presence with danger. | M | No | High |
| 20 | School-zone safety | REQUIRES NEW DATA | Pedestrian/GPS building blocks only. | Authoritative school-zone geofences plus policy rules. | M | No | Medium |
| 21 | Rash-driving indicators | REQUIRES NEW ML | Image-space trajectory exists only. | Calibrated speed/behavior model, ground truth and policy guardrails. | L | Yes | Low |
| 22 | Hit-and-run candidate detection | REQUIRES NEW ML | Generic evidence chain and incident enum only. | Event model, temporal data, high-stakes human-review protocol. | L | Yes | Low |
| 23 | Vehicle tracking | DEMONSTRATED | IoU tracker is tested; night-drive metrics report 63 tracks. | Persisted raw tracks/MOT evaluation. | S | No | Medium |
| 24 | ANPR | REQUIRES NEW ML | None; plate blur class set is empty. | Plate detector/OCR, privacy/legal controls and labels. | L | Yes | Low |
| 25 | Incident evidence packaging | PARTIALLY DEMONSTRATED | Evidence/lifecycle chains contain GPS, time, confidence, routing and privacy status. | Incident detector/schema, immutable evidence handling and reviewer workflow. | M | No | Medium |
| 26 | GIS | DEMONSTRATED | GPS-derived GeoJSON plus Leaflet Command Center map with issue attributes. | Network/segment analysis or production GIS service. | — | No | High |
| 27 | Congestion heat-map data | CHEAPLY DERIVABLE WITHOUT NEW ML | Phase H windows have GPS-backed source observations, timestamps, density and congestion state. | Only a clearly labelled point/time intensity layer; no road-segment or physical traffic heat map claim. | XS–S | No | Medium |
| 28 | OD patterns | NOT WORTH IMPLEMENTING FOR SIH MVP | Single-pass GPS exists but no privacy-safe trip/route corpus. | Substantial data, privacy design and validation; weak core-story gain. | L | No | Low |
| 29 | Edge processing | PARTIALLY DEMONSTRATED | Local CUDA metrics, frame sampling and quality gating are measured. | Actual bus-edge deployment, hardware and resilience tests. | L | No new GPU run needed | Medium |
| 30 | Bandwidth optimization | PARTIALLY DEMONSTRATED | FPS sampling/quality gate reduce compute; artifact-first H avoids recompute. | Event-first upload, compression, retry/sync measurements. | M | No | Medium |
| 31 | Multi-bus corroboration | DEMONSTRATED | 60 cached observations; four road-crack issues corroborated by BUS_001/BUS_002. | Larger-route calibration only. | — | No | Very high |
| 32 | Persistent issue identity | DEMONSTRATED | Stable issue IDs carried from observations through work/closure and reopen. | Durable storage across service restarts. | M | No | Very high |
| 33 | Issue history / City Memory | DEMONSTRATED | Observation/bus/severity/closure history in evidence/lifecycle artifacts. | Production persistence. | M | No | Very high |
| 34 | Priority scoring | DEMONSTRATED | Versioned score/reasons in evidence chains and work items. | Stakeholder calibration, not new ML. | S | No | High |
| 35 | Department routing | DEMONSTRATED | YAML routing and matched-rule evidence. | Jurisdiction-specific approval. | S | No | High |
| 36 | Work-item generation | DEMONSTRATED | Eight generated WorkItems/action queue. | Municipal work-order API. | M | No | High |
| 37 | Repair claims | PARTIALLY DEMONSTRATED | Typed claims and demo artifacts explicitly label them simulated. | Authorized operational repair source. | M | No | High |
| 38 | Proof-of-closure | PARTIALLY DEMONSTRATED | Location-coverage/no-defect logic; `VERIFIED_REPAIRED` demo is simulated and qualified. | Independent real post-repair pass. | M | Likely | Very high |
| 39 | Reopening | PARTIALLY DEMONSTRATED | Original issue ID retained; demo follow-up reuses/clones real D00 observation. | Real time-separated post-repair re-observation. | M | Likely | Very high |
| 40 | Evidence provenance | DEMONSTRATED | Bus IDs, GPS, timestamps, confidence, decisions and simulation labels preserved. | Hash/immutable storage only for evidentiary deployment. | M | No | High |
| 41 | Privacy processing | PARTIALLY DEMONSTRATED | Person-region blur before evidence writes; outputs mark anonymized. | Face/plate detector validation, retention and access controls. | M | Likely | Medium |
| 42 | Human review / consequential safeguards | PARTIALLY DEMONSTRATED | Low-confidence/GPS failures return review-required; incident route says authorized review. | Reviewer UI, roles and audit trail. | M | No | High |

## 3. Cheapest remaining wins

1. **Labelled traffic-intensity map layer (XS–S, no GPU).** Render existing Phase H GPS/time window points using density/congestion labels. It must say “relative traffic intensity from observation-level vehicle proxies,” not heat map, traffic volume, or vehicles/km.
2. **Traffic time-window evidence card (XS, no GPU).** A small Command Center section can display the already verified two windows, class counts, state and explicit speed/lane unavailability. This is presentation of existing data, not a new capability.
3. **Pedestrian presence hotspot summary (S, no GPU).** Aggregate existing geotagged pedestrian observations into clearly named “observed VRU presence clusters.” Keep it separate from school-zone or danger claims.
4. **Traffic bottleneck readiness display (XS, no GPU).** Show zero persistent bottlenecks honestly, together with the persisted rule: multiple consecutive congestion windows are required. Do not manufacture one for a demo.

## 4. Expensive or risky requirements

- New perception classes: waterlogging, garbage/debris, dividers, zebra crossings, ANPR, and driving/incident behavior all need carefully scoped models and ground-truth data.
- Route delay needs route timetable/GTFS/VLT history; lane occupancy needs calibration; school safety needs authoritative GIS data.
- Hit-and-run, rash-driving and ANPR create privacy, false-positive and consequential-decision risks disproportionate to their value for this MVP.
- Real proof-of-closure/reopening needs independent time-separated post-repair footage. Re-running known D00 footage cannot supply D40 or this evidence.

## 5. Requirements to explicitly leave out

- OD patterns, ANPR, hit-and-run detection, rash-driving enforcement, and cloud/database architecture changes.
- Metric speed, vehicles/km, lane occupancy, route delays, or road-segment congestion claims without the required data/calibration.
- D40 pothole validation until a known pothole-containing source is available; do not spend GPU credit rerunning the known D00 footage.

## 6. Recommended final SIH implementation scope

Keep the MVP focused on: **road-crack City Memory + corroboration + actionable municipal workflow + qualified closure verification**, with an adjacent **relative traffic intelligence** panel showing vehicle class counts, density and congestion from cached observations. The only cheap optional addition is a truthfully labelled traffic-intensity map/card; it should not alter the road-issue pipeline.

## 7. Recommended demo storyline

1. Bus camera plus GPS captures a journey; quality gating and privacy handling operate before evidence is written.
2. RDD2022 detects a real D00 longitudinal crack; repeated frames become one observation.
3. A second bus corroborates the same location; City Memory retains the issue identity and provenance.
4. Explainable priority selects a department and creates a work item.
5. Show the closure claim as a claim—not a conclusion—and show a next-pass qualified verification/reopen branch labelled simulated where applicable.
6. In a parallel card, show the existing night-drive traffic result: 42 vehicle proxies in a severe/congested minute, then 4 in a moderate/slow-flow minute; speed/lane occupancy unavailable; no persistent bottleneck claimed.

## 8. Evidence to show judges

- `outputs/sih_demo/01_detections/validation_report.json`: real GPU configuration, 22 road-damage detections and measured performance.
- `outputs/sih_demo/02_observations/observations.json` and `04_corroboration/corroboration_summary.json`: observation provenance and BUS_001/BUS_002 corroboration.
- `outputs/sih_demo/08_demo_summary/issue_map.geojson`, work items, evidence and lifecycle chains: map, priorities, route, repair/verification provenance.
- `outputs/traffic_demo/traffic_observations.json`, `traffic_patterns.json`, and `traffic_report.txt`: reusable traffic evidence and explicit limits.
- Explicit provenance slide: real perception/road observations vs simulated repair/follow-up workflow; D00 is a crack, not a pothole.
