"""Shared helpers for the day-1 verification scripts: device selection, memory, timing, model paths."""

from __future__ import annotations

import json
import os
import time
import warnings
from contextlib import contextmanager
from pathlib import Path

import psutil
import torch

ROOT = Path(__file__).resolve().parent.parent
LOCK = json.loads((ROOT / "models.lock.json").read_text())


def pick_device(requested: str | None = None) -> torch.device:
    if requested:
        return torch.device(requested)
    return torch.device("mps" if torch.backends.mps.is_available() else "cpu")


def sync(device: torch.device) -> None:
    if device.type == "mps":
        torch.mps.synchronize()


def mem_snapshot(device: torch.device) -> dict:
    snap = {"rss_mb": round(psutil.Process().memory_info().rss / 2**20)}
    if device.type == "mps":
        snap["mps_driver_mb"] = round(torch.mps.driver_allocated_memory() / 2**20)
        snap["mps_current_mb"] = round(torch.mps.current_allocated_memory() / 2**20)
    return snap


@contextmanager
def timed(results: dict, key: str, device: torch.device):
    sync(device)
    t0 = time.perf_counter()
    yield
    sync(device)
    results[key] = round((time.perf_counter() - t0) * 1000)


@contextmanager
def capture_fallback_warnings(results: dict):
    """Record which ops fell back to CPU when PYTORCH_ENABLE_MPS_FALLBACK=1."""
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        yield
    msgs = sorted({str(w.message) for w in caught if "fall back" in str(w.message).lower() or "mps" in str(w.message).lower()})
    results["mps_fallback_warnings"] = msgs
    results["mps_fallback_enabled"] = os.environ.get("PYTORCH_ENABLE_MPS_FALLBACK") == "1"


def data_dir() -> Path:
    d = os.environ.get("DATA_DIR")
    if not d:
        raise SystemExit("DATA_DIR is not set")
    return Path(d)
