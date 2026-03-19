FROM nixos/nix:latest

WORKDIR /app

# Update nix channel
RUN nix-channel --update

# Install Python (only what you need)
RUN nix-env -iA nixpkgs.python3

# Copy app
COPY . .

# Install Python deps
RUN python3 -m pip install --no-cache-dir -r requirements.txt

# Expose port for Render
EXPOSE 10000

# Start server
CMD ["python3", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]