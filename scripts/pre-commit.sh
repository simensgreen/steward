#!/usr/bin/env bash
# Same checks as lefthook pre-commit (usable without git hooks).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export RUSTUP_TOOLCHAIN="${RUSTUP_TOOLCHAIN:-stable}"

cd "$ROOT/web"
npx biome check --write .

cd "$ROOT"
cargo fmt --all
cargo clippy --workspace --all-targets --fix --allow-dirty --allow-staged --allow-no-vcs || true
cargo clippy --workspace --all-targets -- -D warnings

echo "pre-commit checks ok"
