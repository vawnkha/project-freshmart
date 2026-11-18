import hmac
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from settings import load_settings

from inference import IMAGE_TYPES, MAX_BYTES, MODEL_ID, MODEL_NAME, VIETNAMESE_LABELS, Predictor
from model_spec import EXPERIMENT_HASH

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")
logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app):
    settings = load_settings()  # Configuration errors fail startup; checkpoint errors remain visible via /health.
    app.state.predictor = None
    app.state.load_error = None
    try:
        app.state.predictor = Predictor(settings.model_path, settings.device, settings.sha256, settings.confidence_threshold)
        logger.info("model_ready model_id=%s sha256=%s device=%s classes=4", MODEL_ID, app.state.predictor.version, app.state.predictor.device)
    except Exception as exc:
        app.state.load_error = str(exc)
        logging.exception("Không thể khởi tạo ConvNeXtV2-Tiny")
    yield


app = FastAPI(title="FreshMart shrimp classification", lifespan=lifespan)


def authorize(request):
    key = load_settings().api_key
    if key and not hmac.compare_digest(request.headers.get("x-ai-api-key", ""), key):
        raise HTTPException(401, "API key không hợp lệ.")


@app.get("/health")
async def health(request: Request):
    authorize(request)
    predictor = request.app.state.predictor
    if predictor is None:
        return JSONResponse(status_code=503, content={"ready": False, "error": request.app.state.load_error})
    return {"ready": True, "device": str(predictor.device), "modelId": MODEL_ID,
            "experimentHash": EXPERIMENT_HASH, "confidenceThreshold": predictor.confidence_threshold,
            "name": MODEL_NAME, "version": predictor.version, "inputShape": [1, 3, 224, 224],
            "classNames": predictor.class_names,
            "classes": [{"classIndex": i, "className": name, "classNameVi": VIETNAMESE_LABELS[name]} for i, name in enumerate(predictor.class_names)]}


@app.post("/predict")
async def predict(request: Request):
    authorize(request)
    predictor = request.app.state.predictor
    if predictor is None:
        raise HTTPException(503, "Checkpoint chưa sẵn sàng. Kiểm tra /health và log AI service.")
    mime_type = request.headers.get("content-type", "").split(";")[0].lower()
    if mime_type not in IMAGE_TYPES:
        raise HTTPException(415, "Chỉ nhận JPEG, PNG hoặc WebP.")
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > MAX_BYTES:
            raise HTTPException(413, "Ảnh vượt quá 5 MB.")
        data.extend(chunk)
    try:
        return await run_in_threadpool(predictor.predict, bytes(data), mime_type)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except BlockingIOError as exc:
        raise HTTPException(429, str(exc)) from exc
    except Exception as exc:
        logging.exception("Inference failed")
        raise HTTPException(503, "Không thể phân tích ảnh. Kiểm tra log AI service.") from exc
