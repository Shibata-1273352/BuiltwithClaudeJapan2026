"""TSUMUGI inference server (REQUIREMENTS.md 4.10, 9.4.2 ASI03/ASI05/ASI07).

- localhost only, shared bearer token (INFERENCE_TOKEN)
- models load lazily and are released after an idle period (16GB machine)
- inputs are size-checked; responses are pydantic-validated

  INFERENCE_TOKEN=... uv run uvicorn app:app --host 127.0.0.1 --port 8100
"""

from __future__ import annotations

import base64
import hmac
import io
import os
import threading
import time
from typing import Annotated, Literal

import numpy as np
import torch
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel, Field

from scripts.bench import LOCK, pick_device

MAX_BYTES = 12 * 2**20
MAX_PIXELS = 4096 * 4096
IDLE_RELEASE_S = int(os.environ.get("INFERENCE_IDLE_RELEASE_S", "300"))
TOKEN = os.environ.get("INFERENCE_TOKEN", "")

Image.MAX_IMAGE_PIXELS = MAX_PIXELS
app = FastAPI(title="tsumugi-inference", docs_url=None, redoc_url=None)
device = pick_device(os.environ.get("INFERENCE_DEVICE"))
_lock = threading.Lock()
_models: dict[str, tuple[object, object, float]] = {}


def require_token(authorization: Annotated[str | None, Header()] = None) -> None:
    if not TOKEN:
        raise HTTPException(503, "server token not configured")
    given = (authorization or "").removeprefix("Bearer ").strip()
    if not hmac.compare_digest(given.encode(), TOKEN.encode()):
        raise HTTPException(401, "unauthorized")


def _load(kind: Literal["sam3", "depth"]):
    with _lock:
        if kind in _models:
            m, p, _ = _models[kind]
            _models[kind] = (m, p, time.time())
            return m, p
        spec = LOCK[kind]
        if kind == "sam3":
            from transformers import Sam3Model, Sam3Processor

            p = Sam3Processor.from_pretrained(spec["repo"], revision=spec["revision"])
            m = Sam3Model.from_pretrained(spec["repo"], revision=spec["revision"]).to(device).eval()
        else:
            from transformers import AutoImageProcessor, AutoModelForDepthEstimation

            p = AutoImageProcessor.from_pretrained(spec["repo"], revision=spec["revision"])
            m = AutoModelForDepthEstimation.from_pretrained(spec["repo"], revision=spec["revision"]).to(device).eval()
        _models[kind] = (m, p, time.time())
        return m, p


def _release_idle() -> None:
    while True:
        time.sleep(30)
        with _lock:
            for k in [k for k, (_, _, t) in _models.items() if time.time() - t > IDLE_RELEASE_S]:
                del _models[k]
                if device.type == "mps":
                    torch.mps.empty_cache()


threading.Thread(target=_release_idle, daemon=True).start()


async def read_image(file: UploadFile) -> Image.Image:
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "image too large")
    try:
        img = Image.open(io.BytesIO(data))
        if img.format not in {"JPEG", "PNG", "WEBP"}:
            raise HTTPException(415, "unsupported image format")
        img.load()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "invalid image") from None
    return img.convert("RGB")


def png_b64(arr: np.ndarray) -> str:
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode()


class Health(BaseModel):
    ok: bool
    device: str
    loaded: list[str]


class MaskOut(BaseModel):
    score: float = Field(ge=0, le=1)
    bbox: list[float] = Field(min_length=4, max_length=4, description="normalized x1,y1,x2,y2")
    area: float = Field(ge=0, le=1)
    mask_png_b64: str


class SegmentOut(BaseModel):
    model: str
    revision: str
    prompt: str
    elapsed_ms: int
    masks: list[MaskOut]


class DepthOut(BaseModel):
    model: str
    revision: str
    elapsed_ms: int
    width: int
    height: int
    depth_png_b64: str = Field(description="8-bit normalized relative depth (larger = nearer)")


@app.get("/health", response_model=Health)
def health() -> Health:
    return Health(ok=True, device=str(device), loaded=sorted(_models))


@app.post("/segment", response_model=SegmentOut, dependencies=[Depends(require_token)])
async def segment(
    image: UploadFile = File(...),
    text: Annotated[str | None, Form(max_length=64)] = None,
    box: Annotated[str | None, Form(max_length=64, description="normalized x1,y1,x2,y2")] = None,
    max_masks: Annotated[int, Form(ge=1, le=8)] = 3,
) -> SegmentOut:
    if not text and not box:
        raise HTTPException(422, "text or box required")
    img = await read_image(image)
    kwargs: dict = {}
    if box:
        try:
            x1, y1, x2, y2 = (float(v) for v in box.split(","))
        except ValueError:
            raise HTTPException(422, "box must be 4 comma-separated numbers") from None
        if not (0 <= x1 < x2 <= 1 and 0 <= y1 < y2 <= 1):
            raise HTTPException(422, "box out of range")
        kwargs["input_boxes"] = [[[x1 * img.width, y1 * img.height, x2 * img.width, y2 * img.height]]]
        kwargs["input_boxes_labels"] = [[1]]
    if text:
        kwargs["text"] = text
    model, proc = _load("sam3")
    t0 = time.perf_counter()
    inputs = proc(images=img, return_tensors="pt", **kwargs).to(device)
    with torch.inference_mode():
        out = model(**inputs)
    post = proc.post_process_instance_segmentation(
        out, threshold=0.4, mask_threshold=0.5, target_sizes=inputs["original_sizes"].tolist()
    )[0]
    masks: list[MaskOut] = []
    for m, s in list(zip(post["masks"].cpu().numpy().astype(bool), post["scores"].cpu().tolist()))[:max_masks]:
        ys, xs = np.nonzero(m)
        if not len(xs):
            continue
        h, w = m.shape
        masks.append(MaskOut(score=float(s), bbox=[xs.min() / w, ys.min() / h, xs.max() / w, ys.max() / h],
                             area=float(m.mean()), mask_png_b64=png_b64((m * 255).astype(np.uint8))))
    spec = LOCK["sam3"]
    return SegmentOut(model=spec["repo"], revision=spec["revision"], prompt=text or f"box:{box}",
                      elapsed_ms=round((time.perf_counter() - t0) * 1000), masks=masks)


@app.post("/depth", response_model=DepthOut, dependencies=[Depends(require_token)])
async def depth(image: UploadFile = File(...)) -> DepthOut:
    img = await read_image(image)
    model, proc = _load("depth")
    t0 = time.perf_counter()
    inputs = proc(images=img, return_tensors="pt").to(device)
    with torch.inference_mode():
        out = model(**inputs)
    d = proc.post_process_depth_estimation(out, target_sizes=[(img.height, img.width)])[0]["predicted_depth"]
    d = d.float().cpu().numpy()
    d = (d - d.min()) / max(float(d.max() - d.min()), 1e-6)
    spec = LOCK["depth"]
    return DepthOut(model=spec["repo"], revision=spec["revision"],
                    elapsed_ms=round((time.perf_counter() - t0) * 1000), width=img.width, height=img.height,
                    depth_png_b64=png_b64((d * 255).astype(np.uint8)))
