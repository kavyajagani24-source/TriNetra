from sixth_sense.traffic.intelligence import build_traffic_patterns, build_traffic_windows, density_level


def vehicle(obs_id, timestamp, klass="car", bus_id="BUS_001"):
    return {"obs_id": obs_id, "event_type": "VEHICLE", "class_name": klass, "first_seen_ts": timestamp, "bus_id": bus_id}


def test_counts_each_observation_once_per_window():
    windows = build_traffic_windows([vehicle("a", 1), vehicle("a", 1), vehicle("b", 2)])
    assert windows[0]["unique_vehicle_count"] == 2


def test_different_track_proxies_count_separately():
    window = build_traffic_windows([vehicle("a", 1), vehicle("b", 1)])[0]
    assert window["unique_vehicle_count"] == 2


def test_different_tracks_and_classes_aggregate():
    window = build_traffic_windows([vehicle("a", 1, "car"), vehicle("b", 2, "truck")])[0]
    assert window["vehicle_counts"] == {"car": 1, "truck": 1}
    assert window["unique_track_counts"] == {"car": 1, "truck": 1}


def test_class_aggregation_includes_only_present_supported_classes():
    window = build_traffic_windows([vehicle("a", 1, "car"), vehicle("b", 1, "car")])[0]
    assert window["vehicle_counts"] == {"car": 2}


def test_unsupported_class_is_excluded():
    assert build_traffic_windows([vehicle("a", 1, "auto_rickshaw")]) == []


def test_density_is_deterministic():
    assert [density_level(n) for n in (0, 3, 4, 7, 8, 12, 13)] == ["LOW", "LOW", "MODERATE", "MODERATE", "HIGH", "HIGH", "SEVERE"]


def test_one_congested_window_is_not_a_bottleneck():
    windows = build_traffic_windows([vehicle(str(i), 1) for i in range(8)])
    patterns = build_traffic_patterns(windows)
    assert windows[0]["congestion_state"] == "CONGESTION"
    assert patterns[0]["congestion_state"] == "CONGESTION"


def test_repeated_congestion_becomes_bottleneck():
    observations = [vehicle(f"a{i}", 1) for i in range(8)] + [vehicle(f"b{i}", 61) for i in range(8)]
    windows = build_traffic_windows(observations)
    patterns = build_traffic_patterns(windows)
    assert {w["congestion_state"] for w in windows} == {"PERSISTENT_BOTTLENECK"}
    assert patterns[0]["congestion_state"] == "PERSISTENT_BOTTLENECK"


def test_provenance_is_preserved():
    window = build_traffic_windows([vehicle("a", 1)])[0]
    assert window["provenance"]["model_inference_rerun"] is False
    assert "track proxy" in window["provenance"]["track_basis"]


def test_speed_is_explicitly_unavailable_without_metric_input():
    window = build_traffic_windows([vehicle("a", 1)])[0]
    assert "No reliable metric speed" in window["speed_estimation_unavailable"]


def test_lane_occupancy_is_explicitly_unavailable_without_calibration():
    window = build_traffic_windows([vehicle("a", 1)])[0]
    assert "No lane geometry" in window["lane_occupancy_unavailable"]
