# Accounting Entry: deltas, source command, idempotency

Fund books are immutable Accounting Entries: normalized participant deltas in Fund Default Currency, a source command, and an idempotency key. Member Balance is derived as latest Revision plus later deltas—not command-specific history formats and not independently mutated totals.
