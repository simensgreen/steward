# Sync: REST writes + SSE

Clients write through the REST HTTP API. Live updates use Server-Sent Events so changes appear immediately without polling. PWA offline is a limited read cache plus a queue for aisle/stock-style actions; full offline money is out of v1. This pairs with ADR-0020 (API as source of truth).
