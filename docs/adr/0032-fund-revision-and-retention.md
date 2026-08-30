# Fund balances derived; Revision + retention

Member Balances are derived from immutable accounting entries after the latest **Revision**, not from ad-hoc mutable totals. A privileged actor may post a Revision that records exact balances at a point in time (special entry type). Configurable data retention (e.g. 180 days) deletes older ordinary Transactions and folds them into **Revision 0**, whose values may update on compaction; later Revisions stay immutable. Current balance = last Revision + subsequent entries.
