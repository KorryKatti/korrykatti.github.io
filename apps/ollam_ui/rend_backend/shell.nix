{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    (pkgs.python3.withPackages (ps: [
      ps.fastapi
      ps.uvicorn
      ps.pydantic
      ps.duckduckgo-search
    ]))
    pkgs.bash
    pkgs.coreutils
    pkgs.nix
  ];
}
