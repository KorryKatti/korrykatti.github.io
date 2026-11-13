FROM python:3.11-alpine

# Use the official uv binary from Astral
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Install system dependencies for Python packages
RUN apk add --no-cache \
    gcc \
    musl-dev \
    libffi-dev \
    freetype-dev \
    libpng-dev \
    openjpeg-dev \
    tiff-dev \
    zlib-dev \
    build-base \
    bash \
    sudo \
    nodejs \
    npm

WORKDIR /app

# Install Python dependencies using uv
# --system flag tells uv to install into the container's main python environment
COPY requirements.txt .
RUN uv pip install --no-cache --system -r requirements.txt

# Copy application files
COPY . .

# Create a non-root user and allow sudo
RUN adduser -D runner && \
    echo "runner ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/runner && \
    chmod 0440 /etc/sudoers.d/runner
USER runner

EXPOSE 10000

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=10000
ENV HOME=/home/runner
ENV PYTHONUNBUFFERED=1

CMD ["python", "main.py"]