"""
Unit tests for trajectory management and pixel speed calculations.
"""

from app.ai.tracker.trajectory_manager import TrajectoryManager


def test_trajectory_manager():
    tm = TrajectoryManager(max_points=5)

    # Point 1 at t=0
    p1 = tm.add_point(track_id=1, x=0.0, y=0.0, frame_number=1, timestamp=0.0)
    assert p1.pixel_speed is None

    # Point 2 at t=1: moved dx=30, dy=40 -> distance = 50, dt=1.0 -> speed = 50.0
    p2 = tm.add_point(track_id=1, x=30.0, y=40.0, frame_number=2, timestamp=1.0)
    assert p2.pixel_speed == 50.0

    traj = tm.get_trajectory(track_id=1)
    assert len(traj) == 2

    # Ring buffer max points enforcement
    for i in range(3, 10):
        tm.add_point(track_id=1, x=float(i * 10), y=0.0, frame_number=i, timestamp=float(i))

    assert len(tm.get_trajectory(track_id=1)) == 5

    # Fleet average speed calculation
    avg_speed = tm.calculate_current_fleet_average_speed(active_track_ids={1})
    assert avg_speed > 0
