# Steward

Self-hosted household stewardship: stock, shopping, and money. Domain glossary in [`CONTEXT.md`](CONTEXT.md).

## Quick start

```bash
# API
export RUSTUP_TOOLCHAIN=stable
cargo run -p steward-server

# Web (other terminal) — Node >= 22.19 required for Lingui CLI
cd web && npm install --legacy-peer-deps && npm run dev
```

Open http://127.0.0.1:5173 — register a Person, create a Household, then use Stock, Shopping, Money, and Catalog.

Copy [`.env.example`](.env.example) to `.env` if you need non-default bind/database paths.

## V1 surface

**HTTP API** under `/api/v1` (Bearer session after register/login):

- Auth: register, login, logout, `/me`
- Households, members, system Calendars (`expiry`, `meal_plan`)
- Catalog: Products, Stores, Store Prices, Recipes
- Stock: Locations, Stock Entries, `POST /api/v1/commands/stock/consume` (FEFO/FIFO)
- Money: personal Budget transactions; Funds with Accounting Entries via `fund/expense` and `fund/transfer`
- Shopping Lists on Budget/Fund; `set-in-cart` and `purchase` commands (price required; posts Stock + money)
- SSE: `GET /api/v1/events`

**Web PWA**: auth, shell navigation, and screens for the pillars above (Lingui en/ru/es, theme preference).

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
