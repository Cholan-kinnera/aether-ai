FROM python:3.14-slim
COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /bin/uv
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
WORKDIR /app
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --locked --no-dev --no-install-project
COPY src ./src
RUN uv sync --locked --no-dev
RUN useradd --create-home appuser
USER appuser
ENV PATH=/app/.venv/bin:$PATH PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn aether.api:app --host 0.0.0.0 --port ${PORT}"]
