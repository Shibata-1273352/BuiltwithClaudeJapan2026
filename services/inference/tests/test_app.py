"""SEC-07 / SEC-09 groundwork: token required, malformed or oversized input rejected. No model is loaded."""

import io
import os

os.environ["INFERENCE_TOKEN"] = "test-token"

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

import app as app_module  # noqa: E402

app_module.TOKEN = "test-token"
client = TestClient(app_module.app)


def _png(w=8, h=8) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h)).save(buf, format="PNG")
    return buf.getvalue()


def test_health_open():
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["ok"]


def test_segment_requires_token():
    r = client.post("/segment", files={"image": ("x.png", _png(), "image/png")}, data={"text": "lantern"})
    assert r.status_code == 401


def test_segment_wrong_token():
    r = client.post("/segment", headers={"Authorization": "Bearer nope"},
                    files={"image": ("x.png", _png(), "image/png")}, data={"text": "lantern"})
    assert r.status_code == 401


def test_rejects_non_image():
    r = client.post("/depth", headers={"Authorization": "Bearer test-token"},
                    files={"image": ("x.png", b"<svg></svg>", "image/png")})
    assert r.status_code == 400


def test_rejects_bad_box():
    r = client.post("/segment", headers={"Authorization": "Bearer test-token"},
                    files={"image": ("x.png", _png(), "image/png")}, data={"box": "0.5,0.5,0.2,0.9"})
    assert r.status_code == 422


def test_scene_requires_token():
    r = client.post("/scene", files={"image": ("x.png", _png(), "image/png")}, data={"scene_id": "cap_abc"})
    assert r.status_code == 401


def test_scene_rejects_path_like_ids():
    r = client.post(
        "/scene",
        headers={"Authorization": "Bearer test-token"},
        files={"image": ("x.png", _png(), "image/png")},
        data={"scene_id": "../../etc"},
    )
    assert r.status_code == 422


def test_visual_search_requires_token():
    r = client.post("/visual-search", data={"scene_id": "cap_abc", "element": "lantern"})
    assert r.status_code == 401


def test_visual_search_rejects_bad_ids():
    h = {"Authorization": "Bearer test-token"}
    assert client.post("/visual-search", headers=h, data={"scene_id": "../x", "element": "lantern"}).status_code == 422
    assert client.post("/visual-search", headers=h, data={"scene_id": "cap_abc", "element": "../x"}).status_code == 422
    assert client.post("/visual-search", headers=h, data={"scene_id": "cap_abc", "element": "lantern", "k": 99}).status_code == 422


def test_requires_prompt():
    r = client.post("/segment", headers={"Authorization": "Bearer test-token"},
                    files={"image": ("x.png", _png(), "image/png")})
    assert r.status_code == 422
