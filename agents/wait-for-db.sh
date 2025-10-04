#!/bin/bash

set -e

echo "⏳ Waiting for database file..."
while [ ! -f /data/healthcare_data.db ]; do
  sleep 2
done

echo "✅ Database found at /data/healthcare_data.db"
exec uvicorn app:app --host 0.0.0.0 --port 8000 --reload
