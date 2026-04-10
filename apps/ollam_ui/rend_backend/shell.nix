{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    (pkgs.python3.withPackages (ps: [
      ps.fastapi
      ps.uvicorn
      ps.pydantic
      ps.ddgs
    ]))
    pkgs.bash
    pkgs.coreutils
    pkgs.nix
  ];
}
