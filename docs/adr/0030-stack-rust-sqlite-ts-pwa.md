**Status**: accepted

# Stack: Rust axum, SQLite default, Solid PWA

API: Rust (axum/tokio), SQLx with **SQLite by default** and Postgres as a later option for hosted/multi-writer. Web: **Solid + Vite PWA** (TypeScript). WebAuthn via browser API / `@simplewebauthn/browser` on the client; verification in Rust. Sync and MCP as in ADR-0020 and ADR-0028.
