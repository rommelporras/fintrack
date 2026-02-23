FROM python:3.14.0rc3-slim

WORKDIR /app

RUN pip install uv==0.7.2

COPY pyproject.toml uv.lock ./
RUN UV_PROJECT_ENVIRONMENT=/opt/venv uv sync --frozen --no-dev

COPY . .

ENV PATH="/opt/venv/bin:$PATH"
