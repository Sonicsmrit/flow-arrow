"""Flow Arrow voice helper: POST /transcribe (raw webm/opus body) -> {text, ms}."""
import io
import os
import time

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from faster_whisper import WhisperModel

MODEL = os.environ.get("WHISPER_MODEL", "whisper-small-nepali-ct2")
THREADS = int(os.environ.get("WHISPER_THREADS", "8"))
MAX_BYTES = 5 * 1024 * 1024

# Nepali demo vocabulary: bill, balance, blood pressure medicine, refill, pickup.
PROMPT = (
    "बिल, ब्यालेन्स, ब्लड प्रेसर औषधि, रिफिल, पिकअप, "
    "खाता, बचत, क्रेडिट कार्ड, भुक्तानी, फार्मेसी, औषधि"
)

model = WhisperModel(MODEL, device="cpu", compute_type="int8", cpu_threads=THREADS)
app = FastAPI()


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL, "threads": THREADS}


@app.post("/transcribe")
async def transcribe(request: Request):
    audio = await request.body()
    if not audio:
        return JSONResponse({"error": "empty body"}, status_code=400)
    if len(audio) > MAX_BYTES:
        return JSONResponse({"error": "audio too large"}, status_code=413)
    start = time.perf_counter()
    segments, _info = model.transcribe(
        io.BytesIO(audio),
        language="ne",
        beam_size=5,
        vad_filter=True,
        initial_prompt=PROMPT,
    )
    text = " ".join(s.text.strip() for s in segments).strip()
    return {"text": text, "ms": round((time.perf_counter() - start) * 1000)}
