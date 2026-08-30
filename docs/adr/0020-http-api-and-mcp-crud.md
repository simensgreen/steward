# HTTP API full CRUD; MCP thin crud-by-type

Integrations use an HTTP API over Steward resources. Descriptive resources may be ordinary CRUD; invariant-heavy money/stock/state writes use **command** endpoints (ADR-0034). Agents use MCP with a reduced surface (e.g. `crud` / commands by resource type). MCP is a façade over the API, not a second domain model.
