# Revision and retention are serialized

Compaction and privileged Revision posting are serialized with accounting writes. Each Revision records the exact included-entry boundary; newer entries stay outside that boundary so derivation never skips or doubles an entry across compaction.
