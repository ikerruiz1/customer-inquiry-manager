# ==============================================================================
# Stage 1: Frontend Build Stage
# ==============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /build

# Copy frontend source files if available
COPY frontend/package*.json ./
RUN if [ -f package.json ]; then npm ci --ignore-scripts; fi

COPY frontend/ ./
RUN if [ -f package.json ]; then npm run build; else mkdir -p dist; fi

# ==============================================================================
# Stage 2: Production Python Runtime Stage
# ==============================================================================
FROM python:3.12-slim AS runner

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH="/app" \
    PORT=8000

WORKDIR /app

# Install minimal OS dependencies for network & TLS verification
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated non-privileged user and group (Principle of Least Privilege)
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /sbin/nologin -m -d /home/appuser appuser

# Install Python application dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code and runtime configuration
COPY company_profile.json .
COPY app/ ./app/

# Copy built frontend assets from Stage 1 into static mount directory
COPY --from=frontend-builder /build/dist ./static

# Ensure correct file permissions for non-root execution
RUN chown -R appuser:appgroup /app /home/appuser

# Switch to non-privileged user
USER appuser

# Expose internal ASGI listener port
EXPOSE 8000

# Native container health check targeting the liveness probe
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://127.0.0.1:8000/health/live || exit 1

# Graceful ASGI startup with Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--timeout-graceful-shutdown", "10"]
