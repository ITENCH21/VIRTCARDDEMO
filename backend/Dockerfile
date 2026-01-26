FROM python:3.11-slim

WORKDIR /app
RUN apt-get update \
    && apt-get install --yes --no-install-recommends gcc libc-dev git \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
