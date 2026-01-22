# last working 3.11-slim, then image goes drifting
FROM python@sha256:38a28170d13a276d42b7dd55cae54440b581d773549d361d19089ec47d4791c5

ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PIP_NO_CACHE_DIR=1
ENV PYTHONUNBUFFERED=1

WORKDIR /usr/src/app
COPY requirements ./requirements

RUN pip install --no-cache-dir -r requirements.txt
COPY ./ .
