FROM nixos/nix:latest

WORKDIR /app

# Update nix channels
RUN nix-channel --update

# Copy app files (shell.nix needed for pre-build step)
COPY . .

# Pre-build the nix environment to cache it as a Docker layer
# This avoids rebuilding on every container start
RUN nix-shell shell.nix --run "echo Nix environment pre-built successfully"

EXPOSE 10000

# Run server inside nix-shell so python3 sees fastapi/uvicorn/pydantic
# (nix-env installs packages in separate store paths; nix-shell wraps them together)
CMD ["nix-shell", "shell.nix", "--run", "python3 -m uvicorn main:app --host 0.0.0.0 --port 10000"]