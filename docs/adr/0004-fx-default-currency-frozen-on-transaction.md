# FX: per-Person Default Currency, frozen on Transaction

Each Person has one Default Currency for personal display. Ledger books use the owning ledger’s Default Currency (Person Budget or Fund—see ADR-0008 / ADR-0035). When a Transaction is posted in another currency, Steward stores an FX multiplier at posting time relative to that ledger. Product/catalog dual-currency display uses the **current** rate for the viewer’s Default Currency.
