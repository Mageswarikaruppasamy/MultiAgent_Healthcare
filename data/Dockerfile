FROM python:3.11-slim

WORKDIR /app

# Install python dependencies (faker for dataset generation)
RUN pip install faker

COPY generate_dataset.py .

CMD ["python", "generate_dataset.py"]
