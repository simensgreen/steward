# Steward

Self-hosted household stewardship: stock, shopping, and money. Domain glossary in [`CONTEXT.md`](CONTEXT.md).

## Quick start

```bash
# API
export RUSTUP_TOOLCHAIN=stable
cargo run -p steward-server

# Web (other terminal)
cd web && npm install --legacy-peer-deps && npm run dev
```

Open http://127.0.0.1:5173 — language and theme controls are on the first screen; API health proxies to the server on port 8080.

Copy [`.env.example`](.env.example) to `.env` if you need non-default bind/database paths.

## Pre-commit

```bash
git init                   # once per clone
npx lefthook install
# or without hooks:
./scripts/pre-commit.sh
```

Hooks run Biome (`web/`), `cargo fmt`, and clippy with autofix where possible.

## Docs for agents

See [`AGENTS.md`](AGENTS.md).
