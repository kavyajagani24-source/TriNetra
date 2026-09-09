# SIH PS 26124 / PS 26125 Coverage Audit

Audit date: 2026-09-08  
Scope: existing repository only. This is a forensic Phase G audit; no Phase A–F source was changed.

## Verification basis

- `python -m pytest tests/ -v`: **108 passed** (0.43 s, Python 3.14.5).
- The checked SIH demo is `FAST_CACHED_REAL_PHASE_B`: `outputs/sih_demo/` records 8 issues, 60 observations, 4 corroborated road-crack issues, 8 work items, and 1 reopened demo issue.
- The referenced live validation report records GPU inference on a 1920x1080, 15 FPS Indian road video: 366 sampled frames, 22 road-damage detections, 17 observations, and 7 tracks. It documents real D00 (longitudinal-crack) detections. It does **not** establish real validation for every RDD class or every PS capability.
- Repair claims, clear follow-up timing, and the reopened post-repair scenario are explicitly marked simulated/reused in `run_sih_demo.py` and the generated verification artifacts. They are not municipal records or independently acquired post-repair passes.

### Status vocabulary

- **IMPLEMENTED** — working code and a demonstrable path; real-data qualification is noted where available.
- **PARTIALLY IMPLEMENTED** — usable building block or narrow implementation, but missing an essential PS capability, validation, or operational integration.
- **NOT IMPLEMENTED** — no working implementation found; schemas, routing rules, comments, and tests using constructed data do not qualify.
- **NOT DEMONSTRABLE** — implementation exists but no runnable command/artifact/test establishes it. No requirement fell exclusively into this category: each such case is classified either partial (a real building block exists) or not implemented (only declarations exist).

## Requirement matrix

| # | Requirement | Status | Actual implementation | File/module | Function/class | Test coverage | Real-data evidence | Command/artifact | Command Center visibility | Gap |
|---:|---|---|---|---|---|---|---|---|---|---|
| 1 | Existing bus camera integration | PARTIALLY IMPLEMENTED | File-based video ingestion with bus and camera IDs; no connector to a bus DVR/VMS or live camera. | `run_urban_ai.py`, `core/video_reader.py` | `run`, `VideoReader` | Phase A component tests; no VMS test | Indian-road video processed, but bus-camera provenance is supplied metadata | `python run_urban_ai.py --video ...`; annotated output | Indirect, through demo artifacts | Add authenticated/live bus-video ingestion and health telemetry. |
| 2 | GPS / VLT integration | PARTIALLY IMPLEMENTED | CSV/JSON GPS loading, direct matching, linear interpolation, uncertainty, unavailable state. No VLT device/protocol integration. | `association/gps_associator.py` | `GPSAssociator.get_location` | `TestGPSAssociator` (5) | GPS-tagged real Phase B observations | `data/demo_gps.csv`; observation JSON | GPS/status shown in issue/evidence panels | Add VLT feed adapter, clock synchronization, and device-quality monitoring. |
| 3 | Road defects | IMPLEMENTED | Specialized RDD2022 YOLO detector maps road-damage labels to typed events and feeds observation/issue flow. | `perception/road_damage_detector.py` | `RoadDamageDetector.detect` | Phase A, B, E tests | 22 real road-damage detections; D00 evidence | validation report and `01_detections/` | Road-crack issues on map/intelligence | Validate remaining RDD classes and calibration across locations/weather. |
| 4 | Potholes | PARTIALLY IMPLEMENTED | D40 and `pothole` map to `POTHOLE`; subsequent action routing supports it. No real D40/pothole artifact was found. | `perception/road_damage_detector.py` | `_RDD_CLASS_MAP` | Constructed pothole tests in Phase A/B/C | None found for D40 | Detector/model path only | Would display if generated | Acquire and validate real D40 examples; do not call D00 a pothole. |
| 5 | Cracks | IMPLEMENTED | D00/D10/D20 map to `ROAD_CRACK`; temporal grouping and city-memory processing are active. | `perception/road_damage_detector.py`, `events/observation_builder.py` | `RoadDamageDetector.detect`, `ObservationBuilder` | Phase A/B/E | Real D00 (longitudinal crack) detections and four corroborated crack issues | `outputs/sih_demo/02_observations/observations.json` | Map, issue intelligence, evidence flow | Broaden validation beyond the supplied D00 footage. |
| 6 | Dividers / medians | NOT IMPLEMENTED | `ROAD_DIVIDER` is an enum and routing rule only; no detector or extractor. | `schemas/urban_event.py`, `config/routing_rules.yaml` | `EventType.ROAD_DIVIDER` | No detection test | None | None | No real issue generated | Build/train a divider-condition detector. |
| 7 | Zebra crossings | NOT IMPLEMENTED | `ZEBRA_CROSSING` is schema/routing only; no vision pipeline. | `schemas/urban_event.py`, `config/routing_rules.yaml` | `EventType.ZEBRA_CROSSING` | No detection test | None | None | No real issue generated | Add crossing detection/condition logic. |
| 8 | Traffic signs | PARTIALLY IMPLEMENTED | General YOLO maps COCO `traffic light` and `stop sign` to generic `TRAFFIC_SIGN`; it does not assess sign condition, inventory, or broader Indian signs. | `perception/vehicle_detector.py` | `_COCO_TO_EVENT`, `VehicleDetector.detect` | No dedicated sign test | No sign artifact identified | `run_urban_ai.py` general detector path | Would display if produced | Dedicated sign taxonomy/model and validation needed. |
| 9 | Waterlogging | NOT IMPLEMENTED | Enum, severity/routing support, and constructed action tests exist; no classifier/detector is invoked. | `schemas/urban_event.py`, `config/routing_rules.yaml` | `EventType.WATERLOGGING` | `test_complete_pipeline_waterlogging` uses constructed issue | None | No perception command | No generated waterlogging issue | Add trained detector and real water-condition validation. |
| 10 | Garbage / debris / obstructions | NOT IMPLEMENTED | `GARBAGE` enum and sanitation routing exist; no detector. | `schemas/urban_event.py`, `config/routing_rules.yaml` | `EventType.GARBAGE` | No perception test | None | None | No generated issue | Add debris/obstruction detector and operational definition. |
| 11 | Vehicle detection | IMPLEMENTED | YOLO general detector filters COCO car/bus/truck/motorcycle/bicycle and person. | `perception/vehicle_detector.py` | `VehicleDetector.detect` | Phase A pipeline/metrics tests | Validation report records 63 vehicle detections | `run_urban_ai.py`; metrics report | Not surfaced as a traffic product | Validate precision/recall on target bus footage. |
| 12 | Vehicle classification | IMPLEMENTED | Supported COCO classes are retained as class names; auto-rickshaw is explicitly heuristic/inferred. | `perception/vehicle_detector.py` | `_COCO_TO_EVENT`, heuristic block | Tracking class-separation test | General detector ran on real footage; per-class benchmark absent | Observation/detection JSON | Not prominently surfaced | Add India-specific class validation; never treat inferred auto-rickshaw as direct detection. |
| 13 | Vehicle counting | PARTIALLY IMPLEMENTED | Tracks prevent repeated per-frame identity, but metrics count raw detections and no count-line/aggregate vehicle-count output exists. | `tracking/urban_tracker.py`, `output/metrics_reporter.py` | `UrbianTracker`, `add_vehicle_detections` | Tracker tests | 7 tracks in validation report | metrics JSON | No count dashboard | Implement counting-zone logic and calibrated aggregation. |
| 14 | Traffic density | NOT IMPLEMENTED | No density estimator, spatial zones, or aggregation. | — | — | No test | None | None | No | Reuse tracks/counts to calculate density. |
| 15 | Lane occupancy | NOT IMPLEMENTED | No lane detection, calibration, or occupancy measure. | — | — | No test | None | None | No | Requires lane geometry and camera calibration. |
| 16 | Congestion | NOT IMPLEMENTED | Enum and department-routing rule only; no congestion inference. | `schemas/urban_event.py`, `config/routing_rules.yaml` | `EventType.CONGESTION` | Router uses constructed issue | None | No perception command | No generated congestion issue | Build from density/speed history, not route label alone. |
| 17 | Bottleneck detection | NOT IMPLEMENTED | No hotspot/bottleneck algorithm. | — | — | No test | None | None | No | Requires longitudinal congestion and road-segment aggregation. |
| 18 | Route delay intelligence | NOT IMPLEMENTED | No schedule/route/ETA ingestion or delay calculation. | — | — | No test | None | None | No | Requires GTFS/route baseline and VLT telemetry. |
| 19 | Vulnerable road users / pedestrians | PARTIALLY IMPLEMENTED | Detects persons and cyclists and routes their observations for review; no risk, near-miss, or safety inference. | `perception/vehicle_detector.py`, `config/routing_rules.yaml` | `VehicleDetector.detect` | Phase A and Phase C routing tests | Pedestrian observations in cached Phase B artifacts | observations JSON | Issue/evidence display when artifacts exist | Add safety-context analytics. |
| 20 | School-zone safety | NOT IMPLEMENTED | No school-zone GIS layer or safety rules. | — | — | No test | None | None | No | Needs geofencing plus VRU/vehicle behavior. |
| 21 | Rash-driving indicators | NOT IMPLEMENTED | Tracks retain image-space trajectories but no velocity, calibration, or driving-behavior detector. | `tracking/urban_tracker.py` | `Track.trajectory` | Tracker tests only | None | None | No | Do not infer violations from raw pixel motion alone. |
| 22 | Hit-and-run candidate detection | NOT IMPLEMENTED | Incident enum and a frame-scheduler comment are not a detector or evidence workflow. | `schemas/urban_event.py`, `core/frame_scheduler.py` | `EventType.INCIDENT_CANDIDATE`, `trigger_burst` | No incident-detection test | None | None | No | High-risk: requires event model, temporal evidence, policy, and human review. |
| 23 | Vehicle tracking | IMPLEMENTED | IoU + class-constrained tracker with confirmation, loss tolerance, and trajectories; not ByteTrack. | `tracking/urban_tracker.py` | `UrbianTracker.update` | `TestTracker` (2); metrics output | 7 total tracks reported from live validation | `run_urban_ai.py`; metrics JSON | Only incidental annotated-video support | Add MOT evaluation and stronger tracker if data warrants it. |
| 24 | ANPR | NOT IMPLEMENTED | No ANPR detector/OCR. `blur_plates` currently has an empty plate-class set. | `privacy/anonymiser.py`, `config/profiles.yaml` | `_PLATE_BLUR_CLASSES = set()` | No ANPR test | None | None | No | Do not claim plate reading or plate redaction. |
| 25 | Incident evidence packaging | PARTIALLY IMPLEMENTED | Generic observations/evidence chains preserve frames, GPS, timestamps, model confidence, routing and lifecycle, but no incident detection or incident-specific package exists. | `actionable/evidence_chain.py`, `closure/lifecycle_evidence.py` | `EvidenceChainBuilder`, `LifecycleEvidenceBuilder` | Phase C/D evidence tests | Real provenance for road-crack observations; closure scenario simulated | evidence/lifecycle JSON | Evidence panel | Add incident schema, immutable media references, and review workflow. |
| 26 | GIS | PARTIALLY IMPLEMENTED | GeoJSON point export and Leaflet rendering only; no GIS service, network analysis, or PostGIS. | `run_sih_demo.py`, `command_center/js/app.js` | `build_issue_map_geojson`, `initMap` | Phase E/F artifact tests | Real GPS-derived issue points in cached demo | `08_demo_summary/issue_map.geojson` | City Map | Add road-segment matching/production GIS only if needed. |
| 27 | Congestion heat maps | NOT IMPLEMENTED | No heatmap generation or UI layer. | — | — | No test | None | None | No | Depends on real congestion measurements. |
| 28 | OD patterns | NOT IMPLEMENTED | No origin/destination aggregation. | — | — | No test | None | None | No | Requires privacy-safe trip/route data. |
| 29 | Edge processing | PARTIALLY IMPLEMENTED | Local CUDA inference, model warmup, sampling, and performance metrics run on one machine; no deployed edge runtime or bus hardware integration. | `run_urban_ai.py`, `core/gpu_context.py` | `run`, `verify_cuda` | Phase A tests; measured report | CUDA `cuda:0` live validation recorded | live CLI; metrics report | No | Benchmark target edge hardware and define deployment packaging. |
| 30 | Bandwidth optimization | PARTIALLY IMPLEMENTED | FPS sampling and quality gating reduce inference work; no media compression/upload, queueing, or network protocol. | `core/frame_scheduler.py`, `core/quality_gate.py` | `FrameScheduler`, `QualityGate` | Quality-gate tests | Measured 3.1 effective input FPS | validation metrics | No | Add event-first transmission and resilient sync. |
| 31 | Multi-bus corroboration | IMPLEMENTED | Valid-GPS observations of matching event type within 30 m merge; distinct bus IDs are counted. | `events/issue_manager.py`, `simulate_multipass.py` | `IssueManager.ingest` | 9 dedicated corroboration tests | Cached two-bus artifacts: 60 observations, four corroborated road cracks | `python simulate_multipass.py ...`; corroboration JSON | Per-bus evidence funnel | Add calibration for GPS drift/false merges. |
| 32 | Persistent issue identity | IMPLEMENTED | Stable generated issue ID is updated in place on matching observation/reopen. | `events/issue_manager.py`, `closure/verification_engine.py` | `_find_matching_issue`, `apply_result` | Phase B and D identity tests | Cached issue IDs flow to action and closure artifacts | issues/work-items/verification JSON | Issue IDs visible | Persist across restarts; current manager is in-memory. |
| 33 | Issue history / City Memory | IMPLEMENTED | Persistent issue stores observations, buses, severity and closure history; evidence chain retains provenance. | `schemas/urban_event.py`, `events/issue_manager.py` | `PersistentIssue`, `_update_issue` | Phase B/C/D history tests | Real multi-bus observation history in artifacts | `persistent_issues/issues.json` | Evidence funnel | Add durable database for production. |
| 34 | Priority scoring | IMPLEMENTED | Deterministic, explainable 0–100 score with version and reasons. | `actionable/priority_engine.py` | `PriorityEngine.score` | 9 priority tests + integration | Eight cached issues scored | priority/work-item JSON | Priority score/band displayed | Calibrate rules with municipal stakeholders. |
| 35 | Department routing | IMPLEMENTED | YAML-driven suggested route with matched rule and reason; explicitly not legally authoritative. | `actionable/department_router.py`, `config/routing_rules.yaml` | `DepartmentRouter.route` | 8 router tests | Cached road cracks route to PWD | work-items JSON | Department displayed | Validate jurisdiction-specific workflows. |
| 36 | Work-item generation | IMPLEMENTED | Builds work item from issue, priority, and routing with location/provenance. | `actionable/work_item.py` | `WorkItemBuilder.build` | 7 builder tests + integration | Eight cached WorkItems generated | `05_work_items/work_items.json` | Action queue/map fields | Add municipal work-order API/state sync. |
| 37 | Repair claims | PARTIALLY IMPLEMENTED | Typed repair claim builder, but current demo creates explicitly simulated PWD claims; no external work-order update. | `closure/repair_claim.py`, `run_sih_demo.py` | `RepairClaimBuilder.build` | 2 claim tests | Simulated only | `06_verification/repair_claims.json` | Evidence flow | Integrate authorized repair workflow/audit actor. |
| 38 | Proof-of-closure | PARTIALLY IMPLEMENTED | Checks location coverage and no matching defect; correctly qualifies absence as non-absolute proof. Current clear-pass demo is simulated. | `closure/verification_engine.py`, `closure/reobservation_matcher.py` | `VerificationEngine.verify`, `pass_covers_issue_location` | Phase D closure tests | Simulated clear pass only | verification events JSON | Verified status shown | Acquire independent, real post-repair follow-up passes. |
| 39 | Reopening | PARTIALLY IMPLEMENTED | Matching post-claim defect reopens original issue and appends follow-up observation; demo clones real prior D00 observation as post-repair evidence. | `closure/verification_engine.py` | `apply_result`, `append_follow_up_observation` | Phase D/E/F reopening tests | Reused/cloned, not independently acquired post-repair data | reopened-issues JSON | Reopened status/evidence flow | Validate on real time-separated follow-up. |
| 40 | Evidence provenance | IMPLEMENTED | Observation/evidence/lifecycle chains retain IDs, buses, timestamps, GPS, confidence, decision reasons and provenance labels. | `actionable/evidence_chain.py`, `closure/lifecycle_evidence.py` | builders and `to_dict` | Phase C/D evidence tests | Real Phase B provenance plus explicit simulated labels | evidence-chain/lifecycle JSON | Evidence panel | Add hashes/immutable storage for evidentiary use. |
| 41 | Privacy processing | PARTIALLY IMPLEMENTED | In-memory blurs the top portion of detected person boxes before image writes; raw evidence frames are not written by saver. Actual plate blur is inactive without ANPR/plate detections. | `privacy/anonymiser.py`, `run_urban_ai.py` | `Anonymiser.anonymise`, `make_evidence_saver` | No dedicated privacy test | Artifact metadata says anonymized; no privacy efficacy evaluation | annotated/evidence pipeline | Frame evidence when present | Add face/plate detection, tests, retention/access controls. |
| 42 | Human review / consequential-decision safeguards | PARTIALLY IMPLEMENTED | Low-confidence/GPS-insufficient closure returns `REVIEW_REQUIRED`; incident routing says authorized review. No reviewer UI, roles, approval trail, or enforcement action. | `closure/verification_engine.py`, `config/routing_rules.yaml` | `VerificationEngine.verify` | Phase D review-path tests | Logic demonstrated in tests, not human workflow | verification JSON | Review status only | Build a human approval queue and audit trail before consequential use. |

## Summary counts

| IMPLEMENTED | PARTIALLY IMPLEMENTED | NOT IMPLEMENTED | NOT DEMONSTRABLE | Total |
|---:|---:|---:|---:|---:|
| 12 | 15 | 15 | 0 | 42 |

## A. Strongest implemented capabilities

1. **Road-crack perception with real data:** specialized RDD2022 inference, temporal validation, GPS association, and real D00 evidence. The evidence supports cracks, not a blanket pothole claim.
2. **City Memory:** a clear observation → persistent issue distinction, GPS-aware deduplication, multi-bus corroboration, stable IDs, and retained provenance.
3. **Action path:** deterministic explainable priority, configurable department routing, generated work items, and inspectable evidence chains.
4. **Accountability mechanics:** a robust rule-based closure/reopen engine that preserves the original issue identity and labels uncertainty rather than treating repair claims as truth.
5. **Demo transparency:** generated artifacts distinguish real perception inputs from simulated repair/follow-up scenarios.

## B. Strongest differentiators

- Multi-bus corroboration turns repeated sightings into a single physical issue instead of a detection list.
- Persistent identity and full observation history make the city-memory narrative concrete.
- Priority and routing are explainable rather than opaque scores.
- Closure verification is intentionally skeptical: it requires a later location-covered pass and can reopen the original issue.

## C. Weakest PS areas

The largest functional gaps are traffic intelligence (counts, density, lanes, congestion, bottlenecks and route delay), broad infrastructure perception (waterlogging, garbage, dividers, zebra crossings), safety/incident capability (school zones, rash driving, hit-and-run), ANPR, and operational integrations (bus VMS/VLT, durable storage, municipal work-order APIs). GIS is currently a GeoJSON + Leaflet display, not a full GIS stack.

## D. Highest-value next features (do not implement in Phase G)

| Rank | Addition | SIH relevance | Demo value | Technical value / reuse | Effort | Risk | Recommendation |
|---:|---|---|---|---|---|---|---|
| 1 | Traffic intelligence from existing tracks: calibrated counting zones, density, congestion and a simple bottleneck view | 5/5 | 5/5 | Reuses YOLO, tracker, GPS, metrics and Command Center | Medium | Medium | Build first; it closes several PS gaps with one coherent pipeline. |
| 2 | Dedicated infrastructure-condition perception: validate D40 potholes, then add one narrow high-value class such as waterlogging or zebra-crossing condition | 5/5 | 5/5 | Reuses detection → observation → issue → action flow | Medium–High | Medium–High | Build second; scope tightly around labeled data and real validation. |
| 3 | Human-reviewed safety/incident candidate workflow with evidence package and explicit non-enforcement safeguards | 4/5 | 4/5 | Reuses trajectories, evidence and review-required outcomes | High | High | Build only as a review aid, after a clear data/policy boundary is agreed. |

## E. Features explicitly not recommended now

- **ANPR and hit-and-run identification:** high legal/privacy stakes and not needed to prove the core City Memory story.
- **OD patterns and congestion heat maps before traffic measurements exist:** dashboards would risk becoming decorative rather than evidence-backed.
- **PostgreSQL/PostGIS, MQTT, FastAPI, or a full cloud/edge deployment rewrite:** production architecture is premature before the next capability is validated; the current local artifact contract is sufficient for a focused demo.
- **Replacing the verified IoU tracker with ByteTrack or adding SAHI:** neither solves the highest-value PS gaps, and neither is currently implemented.

## F. Recommended next phase

Limit the next phase to these two or three additions:

1. Traffic count/density/congestion aggregation built on existing tracks.
2. One data-backed infrastructure perception expansion, beginning with real D40 pothole validation.
3. If time and governance permit, a human-reviewed incident-candidate evidence flow—not automated enforcement.
