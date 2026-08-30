# Steward

Household stewardship platform (self-host first). Domain language: [CONTEXT.md](CONTEXT.md). Decisions: [docs/adr/](docs/adr/).

## Layout

| Path | Role |
| --- | --- |
| `CONTEXT.md` | Domain glossary only |
| `docs/adr/` | Architecture decisions |
| `crates/server/` | Rust axum API (`steward-server`) |
| `web/` | Solid + Vite PWA (DaisyUI, Lingui, Biome) |
| `lefthook.yml` | Pre-commit: Biome, `cargo fmt`, clippy |
| `data/` | Local SQLite (gitignored) |

## Commands

Set `RUSTUP_TOOLCHAIN` before every `cargo` invocation (e.g. `stable`).

```bash
export RUSTUP_TOOLCHAIN=stable
cargo fmt --all
cargo clippy --workspace --all-targets -- -D warnings
cargo check -p steward-server
cargo run -p steward-server
```

```bash
cd web
# Lingui CLI needs Node >= 22.19 (import.meta.main)
npm install --legacy-peer-deps
npm run dev
npm run check    # lingui compile + biome + tsc
npm run build
npm run extract  # after adding UI strings
npm run compile
```

```bash
git init                 # once
npx lefthook install     # once per clone
npx lefthook run pre-commit
./scripts/pre-commit.sh  # same checks without requiring git hooks
```

## Env (names only)

| Name | Purpose |
| --- | --- |
| `STEWARD_DATABASE_URL` | SQLite URL (default `sqlite:data/steward.db?mode=rwc`) |
| `STEWARD_BIND` | Listen address (default `127.0.0.1:8080`) |
| `RUSTUP_TOOLCHAIN` | Toolchain for agent/CI cargo calls |
| `RUST_LOG` / `RUST_LOG` via tracing env filter | Log level |

## Always

- Domain terms from `CONTEXT.md`; do not invent synonyms in code comments or UI without updating CONTEXT
- Add Rust deps with `cargo add` in the crate; never hand-edit dependency versions in `Cargo.toml` as the primary workflow
- User-visible web strings via Lingui macros; run `npm run extract` then translate `web/src/locales/{en,ru,es}/`
- Theme/locale preferences: system detection with profile override (localStorage stub until Person API)
- Log messages English ASCII; log start before long ops and end after

## Ask first

- New ADR-worthy stack or domain ownership changes
- Adding Postgres / MCP crate / auth implementation scope

## Never

- Secrets in repo or AGENTS.md
- Free CRUD that mutates Fund Accounting Entry history (commands only — ADR-0034)
- Hardcoded UI copy outside Lingui
- Committing without Biome / rustfmt / clippy (use lefthook)
