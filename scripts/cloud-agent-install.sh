#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for Steward: Rust API + Solid/Vite web PWA.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export RUSTUP_TOOLCHAIN="${RUSTUP_TOOLCHAIN:-stable}"

echo "Installing Rust dependencies for steward-server"
cd "$ROOT"
cargo fetch --locked
cargo build -p steward-server
echo "Rust dependencies ready"

echo "Installing web dependencies"
cd "$ROOT/web"
npm install --legacy-peer-deps
echo "Compiling Lingui catalogs"
npm run compile
echo "Web dependencies ready"
