"""Download pinned model weights (safetensors only) into the HF cache.

Usage: uv run python scripts/download_models.py
"""

import json
from pathlib import Path

from huggingface_hub import snapshot_download

LOCK = json.loads((Path(__file__).resolve().parent.parent / "models.lock.json").read_text())

for key, m in LOCK.items():
    if m.get("download") is False:  # recorded candidates that are not used
        continue
    path = snapshot_download(
        repo_id=m["repo"],
        revision=m["revision"],
        # safetensors only; skip pickle checkpoints such as sam3.pt (ASI04)
        allow_patterns=["*.json", "*.txt", "*.safetensors", "LICENSE", "README.md"],
    )
    print(f"{key}: {path}", flush=True)
