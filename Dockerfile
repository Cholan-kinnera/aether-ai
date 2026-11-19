FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src ./src
RUN useradd --create-home appuser
USER appuser
ENV PYTHONPATH=/app/src PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "uvicorn aether.api:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
