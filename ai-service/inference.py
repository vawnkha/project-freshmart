"""ConvNeXtV2-Tiny: strict checkpoint identity and training evaluation transform."""
import hashlib
import io
import threading
import warnings
from pathlib import Path
from settings import DEFAULT_DEVICE, torch_threads

import timm
import torch
from PIL import Image, ImageOps, UnidentifiedImageError

from torchvision import transforms as T
from model_spec import MODEL_ID, MODEL_NAME, MODEL_SHA256, EXPERIMENT_HASH, CLASS_SLUGS, VIETNAMESE_LABELS

MAX_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 20_000_000
IMAGE_TYPES = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


def checkpoint_classes(checkpoint):
    if checkpoint.get("class_slugs") != CLASS_SLUGS:
        raise RuntimeError("Checkpoint class_slugs must match the four approved classes in order.")
    if checkpoint.get("experiment_hash") != EXPERIMENT_HASH:
        raise RuntimeError("Checkpoint experiment_hash does not match the approved experiment.")
    return CLASS_SLUGS.copy()


def preprocessing():
    return T.Compose([
        T.Resize((224, 224), interpolation=T.InterpolationMode.BICUBIC),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])


def decode_image(data: bytes, mime_type: str):
    if not data or len(data) > MAX_BYTES:
        raise ValueError("Ảnh phải có dung lượng từ 1 byte đến 5 MB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                if mime_type not in IMAGE_TYPES or image.format != IMAGE_TYPES[mime_type]:
                    raise ValueError("Định dạng khai báo không khớp nội dung ảnh.")
                if image.width * image.height > MAX_PIXELS or getattr(image, "n_frames", 1) != 1:
                    raise ValueError("Chỉ nhận ảnh tĩnh tối đa 20 triệu pixel.")
                image.load()
                return ImageOps.exif_transpose(image).convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ValueError("Ảnh không giải mã được hoặc vượt giới hạn pixel.") from exc


class Predictor:
    def __init__(self, model_path: Path, device_name=DEFAULT_DEVICE, expected_sha256=MODEL_SHA256, confidence_threshold=0.7):
        if not model_path.is_file():
            raise RuntimeError(f"Không tìm thấy checkpoint: {model_path}. Đặt best.pt thật vào MODEL_PATH.")
        with model_path.open("rb") as checkpoint_file:
            self.version = hashlib.file_digest(checkpoint_file, "sha256").hexdigest()
        if self.version != MODEL_SHA256 or (expected_sha256 and self.version != expected_sha256.lower()):
            raise RuntimeError("Checkpoint không khớp MODEL_SHA256.")
        ck = torch.load(model_path, map_location="cpu", weights_only=True)
        if not isinstance(ck, dict):
            raise RuntimeError("Checkpoint must be a metadata dictionary.")
        self.class_names = checkpoint_classes(ck)
        state = ck.get("model", {})
        if not isinstance(state, dict) or tuple(state.get("head.fc.weight", torch.empty(0)).shape) != (4, 768):
            raise RuntimeError("Checkpoint head.fc.weight must have shape (4, 768).")
        if ck.get("seed") != 42 or ck.get("best_epoch") != 26:
            raise RuntimeError("Checkpoint seed/best_epoch mismatch.")
        if device_name not in {"cpu", "cuda", "auto"}:
            raise RuntimeError("AI_DEVICE chỉ nhận cpu, cuda hoặc auto.")
        if device_name == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("AI_DEVICE=cuda nhưng CUDA không khả dụng; hãy chọn cpu.")
        self.device = torch.device("cuda" if device_name == "auto" and torch.cuda.is_available() else "cpu" if device_name == "auto" else device_name)
        torch.set_num_threads(torch_threads())
        self.model = timm.create_model(MODEL_ID, pretrained=False, num_classes=4)
        self.model.load_state_dict(state, strict=True)
        self.model.to(self.device).eval()
        self.transform = preprocessing()
        self.epoch = ck["best_epoch"]
        self.val_macro_f1 = ck.get("best_val_macro_f1")
        self.confidence_threshold = confidence_threshold
        self.lock = threading.Lock()

    def predict(self, data: bytes, mime_type: str):
        # Bound concurrent CPU/GPU work; don't build an unbounded inference queue.
        if not self.lock.acquire(blocking=False):
            raise BlockingIOError("Dịch vụ AI đang bận. Vui lòng thử lại sau.")
        try:
            image = decode_image(data, mime_type)
            tensor = self.transform(image).unsqueeze(0).to(self.device)
            if tuple(tensor.shape) != (1, 3, 224, 224):
                raise RuntimeError("Input tensor không đúng kích thước.")
            with torch.inference_mode():
                logits = self.model(tensor)
                if tuple(logits.shape) != (1, len(self.class_names)) or not torch.isfinite(logits).all():
                    raise RuntimeError("Đầu ra mô hình không hợp lệ.")
                probabilities = torch.softmax(logits.float(), dim=1)[0].cpu().tolist()
            best = max(range(len(self.class_names)), key=probabilities.__getitem__)
            return {
                "prediction": {
                    "classIndex": best, "className": self.class_names[best], "classNameVi": VIETNAMESE_LABELS[self.class_names[best]],
                    "confidence": probabilities[best],
                    "confidenceThreshold": self.confidence_threshold, "lowConfidence": probabilities[best] < self.confidence_threshold,
                    "probabilities": [{"classIndex": i, "className": name, "classNameVi": VIETNAMESE_LABELS[name], "probability": probabilities[i]} for i, name in enumerate(self.class_names)],
                },
                "model": {"name": MODEL_NAME, "modelId": MODEL_ID, "version": self.version, "experimentHash": EXPERIMENT_HASH, "seed": 42, "bestEpoch": self.epoch},
            }
        finally:
            self.lock.release()
