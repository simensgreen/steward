# Commands for money and state machines

Invariant-heavy writes (purchase completion, Money Request lifecycle, in-Fund Transfer, Stock consumption, Rules execution) go through domain **commands**, not free CRUD update/delete of history. “Settle Up” is not a server command (ADR-0037). Descriptive resources may use ordinary CRUD. Aligns HTTP API + MCP with invariants (ADR-0020).
