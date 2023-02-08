FROM python:3.11-slim
RUN apt-get update && apt-get -y install curl && apt-get -y install git

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | POETRY_HOME=/opt/poetry python3 && \
    cd /usr/local/bin && \
    ln -s /opt/poetry/bin/poetry && \
    poetry config virtualenvs.create false

COPY ./app/pyproject.toml ./app/poetry.lock* /app/

RUN cd /app && poetry install --no-root --no-dev

COPY ./app /app

# CMD ["waitress-serve", "--port=80", "--threads=12", "app.app:server"]
CMD gunicorn -b 0.0.0.0:80 --workers 10 --threads 10 app.app:server
# CMD ["uvicorn", "app.app:server", "--host", "0.0.0.0", "--port", "80"]
