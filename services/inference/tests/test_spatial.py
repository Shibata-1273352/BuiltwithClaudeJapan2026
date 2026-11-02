import numpy as np
import pytest

from spatial import apply, assign_layers, lantern_anchors, representative_depth, similarity_from_two, transform_params


def test_similarity_recovers_known_transform():
    theta, s, t = np.radians(10), 1.7, np.array([30.0, -12.0])
    rot = s * np.array([[np.cos(theta), -np.sin(theta)], [np.sin(theta), np.cos(theta)]])
    src = np.array([[10.0, 20.0], [200.0, 80.0]])
    dst = src @ rot.T + t
    m = similarity_from_two([tuple(p) for p in src], [tuple(p) for p in dst])
    assert np.allclose(apply(m, src), dst)
    p = transform_params(m)
    assert p["scale"] == pytest.approx(1.7)
    assert p["rotation_deg"] == pytest.approx(10)


def test_scale_translate_fit_exact_and_no_rotation():
    from spatial import scale_translate_fit

    src = [(10.0, 20.0), (110.0, 70.0), (40.0, 90.0)]
    dst = [(2 * x + 5, 2 * y - 3) for x, y in src]
    m = scale_translate_fit(src, dst)
    assert np.allclose(m, [[2, 0, 5], [0, 2, -3]])
    assert transform_params(m)["rotation_deg"] == 0


def test_similarity_rejects_coincident_points():
    with pytest.raises(ValueError):
        similarity_from_two([(1, 1), (1, 1)], [(0, 0), (5, 5)])


def test_lantern_anchors_on_ellipse_ignore_cut_edge():
    h, w = 400, 400
    yy, xx = np.mgrid[:h, :w]
    # ellipse centered near the right edge so it is cut off there
    mask = ((xx - 330) / 120) ** 2 + ((yy - 200) / 90) ** 2 <= 1
    a = {x.name: x for x in lantern_anchors(mask)}
    assert a["bottom_center"].y == pytest.approx(290 / h, abs=0.01)
    assert a["bottom_center"].x == pytest.approx(330 / w, abs=0.02)
    assert a["left_extreme"].x == pytest.approx(210 / w, abs=0.01)
    assert a["left_extreme"].y == pytest.approx(200 / h, abs=0.02)


def test_layers_by_depth_tertiles():
    scene = np.linspace(0, 1, 300).reshape(10, 30)
    layers = assign_layers({"near": 0.95, "mid": 0.5, "far": 0.05}, scene)
    assert layers == {"near": "foreground", "mid": "midground", "far": "background"}


def test_representative_depth_is_median():
    d = np.array([[0.0, 1.0], [5.0, 100.0]])
    m = np.array([[True, True], [True, False]])
    assert representative_depth(d, m) == 1.0
