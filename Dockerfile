FROM python:3.11-slim
RUN apt-get update && apt-get -y install curl

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | POETRY_HOME=/opt/poetry python3 && \
    cd /usr/local/bin && \
    ln -s /opt/poetry/bin/poetry && \
    poetry config virtualenvs.create false

COPY ./app /app
WORKDIR /app
RUN rm -rf ./.venv
RUN poetry install --no-root --no-dev

CMD gunicorn -b 0.0.0.0:80 --workers 10 --threads 10 mdb.app:server