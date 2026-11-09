# ==========================================================
# DevSprint Unified Production Cloud Run Container
# Builds React Frontend & FastAPI Backend into single container
# ==========================================================

# Stage 1: Build React 19 Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /build

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Production Python 3.12 Server
FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ .

# Copy compiled frontend from Stage 1 into backend's static_dist
COPY --from=frontend-builder /build/dist ./static_dist

# Cloud Run defaults to 8080
ENV PORT=8080
ENV ENVIRONMENT=production
EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]

