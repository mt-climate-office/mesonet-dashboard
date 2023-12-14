FROM python:3.11-slim
RUN apt-get update && apt-get -y install curl && apt-get -y install git && apt-get -y install gunicorn

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | POETRY_HOME=/opt/poetry python3 && \
    cd /usr/local/bin && \
    ln -s /opt/poetry/bin/poetry && \
    poetry config virtualenvs.create false

COPY ./mt_counties.geojson ./app/pyproject.toml ./app/poetry.lock* /app/
COPY ./normals/* /app/normals/

WORKDIR /app
RUN poetry install --no-root --no-dev

COPY ./app /app
RUN rm -rf ./.venv

CMD gunicorn -b 0.0.0.0:80 --threads 10 mdb.app:server
