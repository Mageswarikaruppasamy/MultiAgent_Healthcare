# data/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN pip install faker

# Copy the script
COPY generate_dataset.py .

# Create data directory
RUN mkdir -p /app/data

# Run the data generation script
CMD ["python", "generate_dataset.py"]