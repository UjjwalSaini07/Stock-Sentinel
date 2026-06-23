# Multi-stage Dockerfile for Backend (Dev & Prod)

# Stage 1: Base image with python 3.11-slim
FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1
WORKDIR /app

# Install system dependencies if any are needed (e.g., curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Development Stage ---
FROM base AS development
COPY . .
EXPOSE 8000
# Run uvicorn with hot-reload enabled
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# --- Production Stage ---
FROM base AS production

# Create a non-privileged user for security
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/bash appuser

COPY --chown=appuser:appgroup . .

USER appuser

EXPOSE 8000

# Run uvicorn with multiple workers for production
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
# CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
