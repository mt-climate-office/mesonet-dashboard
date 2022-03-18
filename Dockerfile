FROM python:3.9-slim
RUN apt-get update && apt-get -y install curl

# Install Poetry
RUN curl -sSL https://raw.githubusercontent.com/python-poetry/poetry/master/get-poetry.py | POETRY_HOME=/opt/poetry python && \
    cd /usr/local/bin && \
    ln -s /opt/poetry/bin/poetry && \
    poetry config virtualenvs.create false

COPY ./app/pyproject.toml ./app/poetry.lock* /app/

RUN cd /app && poetry install --no-root --no-dev

COPY ./app /app

CMD gunicorn -b 0.0.0.0:80 app.test:server
#CMD ["uvicorn", "app.app:server", "--host", "0.0.0.0", "--port", "80"]
