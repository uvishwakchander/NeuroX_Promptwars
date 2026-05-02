FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

# Cloud Run sets the PORT environment variable.
ENV PORT=8080

CMD ["sh", "-c", "uvicorn execution.relay_nudge_server:app --host 0.0.0.0 --port ${PORT}"]
