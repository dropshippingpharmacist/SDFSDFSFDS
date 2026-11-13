FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 DEBIAN_FRONTEND=noninteractive HF_HOME=/models/hf U2NET_HOME=/models/u2net
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements-server.txt .
RUN pip install --no-cache-dir -r requirements-server.txt
# bake the speech and cut-out models into the image so the first job doesn't wait for downloads
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small.en', device='cpu', compute_type='int8'); WhisperModel('base.en', device='cpu', compute_type='int8')" \
 && python -c "from rembg import new_session; new_session('u2net_human_seg')"
COPY . .
EXPOSE 10000
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-10000} --timeout-keep-alive 75"]
