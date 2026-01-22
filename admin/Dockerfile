FROM python:3.11-slim


RUN apt-get update && apt-get -y install libpq-dev gcc git
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PIP_NO_CACHE_DIR=1
ENV PYTHONUNBUFFERED=1

WORKDIR /usr/src/app
COPY requirements.txt ./requirements.txt

RUN pip install --no-cache-dir -r requirements.txt
COPY ./ .
