"""Validated environment settings. No model/preprocessing policy lives here."""
import os
import re
import math
from dataclasses import dataclass
from pathlib import Path
from model_spec import MODEL_SHA256

ROOT = Path(__file__).resolve().parent
DEFAULT_MODEL_PATH = "models/best.pt"
DEFAULT_DEVICE = "cpu"
DEFAULT_THREADS = 4


def torch_threads(env=None):
    env = os.environ if env is None else env
    raw = env.get("AI_TORCH_THREADS", str(DEFAULT_THREADS))
    if not re.fullmatch(r"[0-9]+", raw) or not 1 <= int(raw) <= 16:
        raise ValueError("AI_TORCH_THREADS phải là số nguyên từ 1 đến 16.")
    return int(raw)


@dataclass(frozen=True)
class Settings:
    model_path: Path
    device: str
    sha256: str
    api_key: str
    threads: int
    confidence_threshold: float


def load_settings(env=None):
    env = os.environ if env is None else env
    mode = env.get("NODE_ENV", "development")
    if mode not in {"development", "test", "production"}:
        raise ValueError("NODE_ENV phải là development, test hoặc production.")
    path = env.get("MODEL_PATH", DEFAULT_MODEL_PATH)
    if not path.strip():
        raise ValueError("MODEL_PATH không được rỗng.")
    path = Path(path)
    if not path.is_absolute():
        path = ROOT / path
    device = env.get("AI_DEVICE", DEFAULT_DEVICE)
    if device not in {"cpu", "cuda", "auto"}:
        raise ValueError("AI_DEVICE phải là cpu, cuda hoặc auto.")
    sha = env.get("MODEL_SHA256", "") or MODEL_SHA256
    if sha and not re.fullmatch(r"[a-fA-F0-9]{64}", sha):
        raise ValueError("MODEL_SHA256 phải là 64 ký tự hex hoặc để trống.")
    key = env.get("AI_API_KEY", "")
    if mode == "production" and not key.strip():
        raise ValueError("AI_API_KEY bắt buộc trong production.")
    try:
        threshold = float(env.get("AI_LOW_CONFIDENCE_THRESHOLD", "0.7"))
        if not math.isfinite(threshold) or not 0 <= threshold <= 1:
            raise ValueError()
    except ValueError as exc:
        raise ValueError("AI_LOW_CONFIDENCE_THRESHOLD phải là số từ 0 đến 1.") from exc
    return Settings(path, device, sha, key, torch_threads(env), threshold)
