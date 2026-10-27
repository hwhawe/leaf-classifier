FROM python:3.11-slim

WORKDIR /app

# Dependensi sistem minimal untuk Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Hugging Face Spaces (Docker SDK) mengekspos port 7860 secara default
ENV PORT=7860
EXPOSE 7860

CMD ["python", "app.py"]
