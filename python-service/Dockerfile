FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Default port for local development
ENV PORT=8000

# Run uvicorn - the main.py handles PORT via os.environ
CMD ["python", "main.py"]