FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl gcc g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

COPY wait-for-db.sh .
RUN chmod +x wait-for-db.sh

CMD ["./wait-for-db.sh"]
