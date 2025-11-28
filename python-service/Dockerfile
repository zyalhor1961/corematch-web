FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Don't expose a hardcoded port here, let Railway handle it
# EXPOSE 8000 

# Run using the shell form so $PORT variable is expanded correctly
CMD sh -c "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"